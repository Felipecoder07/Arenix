const logger = require('../utils/safeLogger').forModule('tenantAssinaturaRoutes');
const { requirePermission } = require('../utils/permissions');
const { simulationAllowed } = require('../utils/security');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');
const saasBillingService = require('../services/saasBillingService');
const logAuditEvent = require('../utils/auditLogger');
const { formatarCompetencia, calcularProximaDataVencimento, calcularDiasRestantesTrial, NOMES_MESES } = require('../utils/dateUtils');
const { fimPeriodo, alinharVencimento } = require('../services/saasCalendarService');

// Todas as rotas requerem usuário autenticado com perfil Administrador ou Gerente da Arena
router.use(verifyToken);
router.use(requirePermission('subscription.manage'));

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/tenant/assinatura/plano
// Retorna os dados do plano atual da arena, limites, uso e cálculo de vigência/cobertura.
// ─────────────────────────────────────────────────────────────────────────────
function calcularMetricasCoberturaEAssinatura({ arena, todasFaturas, faturasPagas, faturasPendentes, diaVenc, cicloArena, hojeStr }) {
  let coberturaAte = null;
  let proximoVencimento = null;
  let mesesAdiantados = 0;
  let proximaCompetencia = null;

  if (faturasPagas.length > 0) {
    const ultimaPaga = faturasPagas[faturasPagas.length - 1];
    coberturaAte = fimPeriodo(ultimaPaga, diaVenc);
    proximoVencimento = alinharVencimento(coberturaAte, diaVenc);

    const [anoHoje, mesHoje] = hojeStr.split('-').map(Number);
    const [anoCob, mesCob] = coberturaAte.split('-').map(Number);
    const diffMeses = (anoCob - anoHoje) * 12 + (mesCob - mesHoje);
    mesesAdiantados = Math.max(0, diffMeses - 1);
  } else if (arena.trial_expira_em && arena.trial_expira_em > hojeStr) {
    coberturaAte = arena.trial_expira_em;
    proximoVencimento = arena.trial_expira_em;
    mesesAdiantados = 0;
  } else {
    proximoVencimento = calcularProximaDataVencimento(null, diaVenc, cicloArena);
    coberturaAte = null;
    mesesAdiantados = 0;
  }

  let faturaAtual = null;
  if (faturasPendentes.length > 0) {
    faturaAtual = faturasPendentes[0];
    proximoVencimento = faturaAtual.data_vencimento;
    proximaCompetencia = formatarCompetencia(faturaAtual.data_vencimento, faturaAtual.ciclo || cicloArena);
  } else {
    const ultimaFatura = todasFaturas.length > 0 ? todasFaturas[todasFaturas.length - 1] : null;
    const dataProx = ultimaFatura 
      ? alinharVencimento(fimPeriodo(ultimaFatura, diaVenc), diaVenc)
      : arena.trial_expira_em || calcularProximaDataVencimento(null, diaVenc, cicloArena);
    proximoVencimento = dataProx;
    proximaCompetencia = formatarCompetencia(dataProx, cicloArena);
  }

  return { coberturaAte, proximoVencimento, mesesAdiantados, proximaCompetencia, faturaAtual };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/tenant/assinatura/plano
// Retorna os dados do plano atual da arena, limites, uso e cálculo de vigência/cobertura.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/plano', async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const arena = await db.getAsync(`
      SELECT a.id, a.nome, a.status as arena_status, a.dia_vencimento, a.trial_expira_em, a.ciclo_cobranca,
             p.id as plano_id, p.nome as plano_nome, p.max_quadras, p.max_usuarios, p.valor_mensal, p.valor_anual
      FROM Arenas a
      LEFT JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [tenantId]);

    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const countQuadras = await db.getAsync('SELECT COUNT(*) as total FROM Quadras WHERE tenant_id = ? AND status != "Excluida"', [tenantId]);
    const countUsuarios = await db.getAsync("SELECT COUNT(*) as total FROM Usuarios WHERE tenant_id = ? AND ativo = 1 AND (perfil IS NULL OR (perfil != 'Cliente' AND perfil != 'cliente'))", [tenantId]);

    const todasFaturas = await db.allAsync(`
      SELECT id, valor, data_vencimento, data_pagamento, status, ciclo, descricao, periodo_fim
      FROM FaturasSaaS
      WHERE tenant_id = ?
      ORDER BY data_vencimento ASC, id ASC
    `, [tenantId]);

    const faturasPagas = todasFaturas.filter(f => f.status === 'Paga');
    const faturasPendentes = todasFaturas.filter(f => f.status === 'Pendente' || f.status === 'Atrasada');

    const diaVenc = arena.dia_vencimento || 10;
    const cicloArena = arena.ciclo_cobranca || 'mensal';
    const hojeStr = require('../utils/dateUtils').getTodayString();

    const { coberturaAte, proximoVencimento, mesesAdiantados, proximaCompetencia, faturaAtual } = calcularMetricasCoberturaEAssinatura({
      arena,
      todasFaturas,
      faturasPagas,
      faturasPendentes,
      diaVenc,
      cicloArena,
      hojeStr
    });

    const emTrial = !!(arena.trial_expira_em && arena.trial_expira_em > hojeStr);
    const diasRestantesTrial = emTrial ? calcularDiasRestantesTrial(arena.trial_expira_em) : 0;

    res.json({
      arena_id: arena.id,
      arena_nome: arena.nome,
      arena_status: arena.arena_status,
      dia_vencimento: arena.dia_vencimento,
      trial_expira_em: arena.trial_expira_em,
      em_trial: emTrial,
      dias_restantes_trial: diasRestantesTrial,
      ciclo_cobranca: cicloArena,
      cobertura_ate: coberturaAte,
      proximo_vencimento: proximoVencimento,
      meses_adiantados: mesesAdiantados,
      proxima_competencia: proximaCompetencia,
      plano: {
        id: arena.plano_id,
        nome: arena.plano_nome || 'Nenhum',
        valor_mensal: arena.valor_mensal ? arena.valor_mensal / 100 : 0,
        valor_anual: arena.valor_anual ? arena.valor_anual / 100 : 0,
        max_quadras: arena.max_quadras || 0,
        max_usuarios: arena.max_usuarios || 0,
      },
      uso: {
        quadras_usadas: countQuadras ? countQuadras.total : 0,
        usuarios_usados: countUsuarios ? countUsuarios.total : 0,
      },
      fatura_atual: faturaAtual ? { ...faturaAtual, valor: faturaAtual.valor / 100 } : null,
    });
  } catch (err) {
    logger.error('[Tenant Assinatura API Error]', err);
    res.status(500).json({ error: 'Erro ao buscar dados da assinatura.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/tenant/assinatura/faturas
// Retorna a lista de faturas do SaaS pertencentes exclusivamente à arena logada com competência.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/faturas', async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const faturas = await db.allAsync(`
      SELECT f.id, f.valor, f.data_vencimento, f.data_pagamento, f.status,
             f.gateway_ref, f.copia_cola, f.qr_expira_em, f.metodo_pagamento,
             f.ciclo, f.descricao, f.periodo_fim,
             p.nome as plano_nome
      FROM FaturasSaaS f
      JOIN PlanosSaaS p ON f.plano_id = p.id
      WHERE f.tenant_id = ?
      ORDER BY f.data_vencimento DESC, f.id DESC
    `, [tenantId]);

    const hoje = require('../utils/dateUtils').getTodayString();
    const [anoH, mesH] = hoje.split('-').map(Number);

    const faturasFormatadas = faturas.map(f => {
      const periodoFim = fimPeriodo(f, Number(f.data_vencimento.slice(8, 10)));
      const formatDate = date => date.split('-').reverse().join('/');
      const competencia = `${formatDate(f.data_vencimento)} a ${formatDate(periodoFim)}`;
      const [anoV, mesV] = (f.data_vencimento || hoje).split('-').map(Number);
      const isAntecipada = (anoV > anoH) || (anoV === anoH && mesV > mesH);
      return {
        ...f,
        valor: f.valor / 100,
        periodo_fim: periodoFim,
        competencia,
        antecipada: isAntecipada
      };
    });

    res.json(faturasFormatadas);
  } catch (err) {
    logger.error('[Tenant Assinatura API Error]', err);
    res.status(500).json({ error: 'Erro ao buscar faturas da assinatura.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/tenant/assinatura/faturas/:id/gerar-pix
// Gera (ou retorna Pix ativo) para a fatura informada.
// Validação rígida: a fatura DEVE pertencer ao tenant_id do usuário logado!
// ─────────────────────────────────────────────────────────────────────────────
router.get('/faturas/:id/pix', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Fatura inválida.' });
    const invoice = await db.getAsync('SELECT * FROM FaturasSaaS WHERE id=? AND tenant_id=?', [id, req.user.tenant_id]);
    if (!invoice) return res.status(404).json({ error: 'Fatura não encontrada.' });
    const attempt = await require('../services/saasPixService').consult(id);
    const current = await db.getAsync('SELECT status FROM FaturasSaaS WHERE id=?', [id]);
    let pix = null;
    if (['Pendente', 'Atrasada'].includes(current.status) && attempt?.state === 'pending') {
      try { pix = JSON.parse(attempt.response_json); } catch { /* No usable cached QR. */ }
      if (!pix?.copia_cola || !(Date.parse(pix.expira_em) > Date.now())) pix = null;
    }
    let paymentError;
    try {
      const diagnostic = JSON.parse(attempt?.diagnostic_json || '{}');
      if (diagnostic.category === 'PIX_LEGACY_REVIEW_REQUIRED') {
        const errors = require('../utils/paymentProviderError');
        paymentError = errors.paymentErrorBody(errors.normalizePaymentError(errors.paymentError(diagnostic.category), attempt.id));
      }
    } catch { /* Preserve compatibility with older diagnostics. */ }
    res.json({ status: current.status, pago: current.status === 'Paga', payment_state: attempt?.state || 'none', pix,
      ...(!pix && paymentError ? { payment_error: paymentError } : {}) });
  } catch (error) { res.status(error.status || 500).json(require('../utils/paymentProviderError').paymentErrorBody(error)); }
});

async function gerarPixComFatura(faturaId) {
  try { return await saasBillingService.gerarPixFaturaSaaS(faturaId); }
  catch (error) { error.fatura_id = faturaId; throw error; }
}

router.post('/faturas/:id/gerar-pix', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const faturaId = Number.parseInt(req.params.id, 10);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }
  if (isNaN(faturaId)) {
    return res.status(400).json({ error: 'ID de fatura inválido.' });
  }

  try {
    const fatura = await db.getAsync('SELECT tenant_id FROM FaturasSaaS WHERE id = ?', [faturaId]);
    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }
    if (fatura.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Esta fatura não pertence à sua arena.' });
    }

    const pixData = await gerarPixComFatura(faturaId);
    res.json(pixData);
  } catch (err) {
    logger.error('[Tenant Assinatura Gerar Pix Error]', err);
    res.status(err.status || 500).json(require('../utils/paymentProviderError').paymentErrorBody(err, 'Erro ao gerar Pix da fatura.'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.1 POST /api/tenant/assinatura/faturas/:id/simular-pagamento
// Simula a liquidação imediata da fatura para fins de teste/demonstração.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/faturas/:id/simular-pagamento', async (req, res) => {
  if (!simulationAllowed()) {
    return res.status(403).json({ error: 'A simulação de pagamentos está desabilitada em ambiente de produção.' });
  }

  const tenantId = req.user.tenant_id;
  const faturaId = Number.parseInt(req.params.id, 10);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }
  if (isNaN(faturaId)) {
    return res.status(400).json({ error: 'ID de fatura inválido.' });
  }

  try {
    const fatura = await db.getAsync(`
      SELECT f.id, f.tenant_id, f.plano_id, f.valor, f.status, f.gateway_ref,
             a.nome as arena_nome, a.status as arena_status, p.nome as plano_nome
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      JOIN PlanosSaaS p ON f.plano_id = p.id
      WHERE f.id = ?
    `, [faturaId]);

    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    if (fatura.tenant_id !== tenantId) {
      logAuditEvent(
        req.user.id,
        'SaaS: Tentativa Não Autorizada de Simulação',
        `Usuário tentou simular pagamento da fatura #${faturaId} de outra arena (Tenant Fatura: ${fatura.tenant_id}, Tenant Usuário: ${tenantId}).`,
        req.headers['x-forwarded-for'] || req.ip
      );
      return res.status(403).json({ error: 'Acesso negado. Esta fatura não pertence à sua arena.' });
    }

    let gatewayRef = fatura.gateway_ref;
    if (!gatewayRef) {
      gatewayRef = `SIM_SAAS_FATURA_${fatura.id}_${Date.now()}`;
      await db.runAsync(`
        UPDATE FaturasSaaS
        SET gateway_ref = ?, metodo_pagamento = 'Pix Online'
        WHERE id = ?
      `, [gatewayRef, fatura.id]);
    }

    const liquidacaoResult = await saasBillingService.liquidarFaturaSaaS(gatewayRef);

    logAuditEvent(
      req.user.id,
      'SaaS: Simulação de Pagamento',
      `Pagamento simulado para fatura #${faturaId} (Plano ${fatura.plano_nome}, R$ ${fatura.valor.toFixed(2)}) da Arena '${fatura.arena_nome}'.`,
      req.headers['x-forwarded-for'] || req.ip
    );

    res.json({
      message: 'Pagamento simulado e aprovado com sucesso!',
      fatura_id: fatura.id,
      status: 'Paga',
      pago: true,
      plano_nome: fatura.plano_nome,
      arena_desbloqueada: liquidacaoResult.arena_desbloqueada,
      plano_atualizado: liquidacaoResult.plano_atualizado,
    });
  } catch (err) {
    logger.error('[Tenant Assinatura Simular Pagamento Error]', err);
    res.status(400).json({ error: require('../utils/security').publicError(err, 'Erro ao processar simulação de pagamento.') });
  }
});

async function verificarStatusMercadoPagoAoVivo(fatura) {
  if (fatura.status === 'Paga' || !fatura.gateway_ref) return null;
  try {
    const token = await saasBillingService.getMasterAccessToken();
    if (token) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${fatura.gateway_ref}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (mpRes.ok) {
        const mpData = await mpRes.json();
        if (mpData.status === 'approved') {
          const resLiquida = await saasBillingService.liquidarFaturaSaaS(fatura.gateway_ref, mpData);
          const arena = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [fatura.tenant_id]);
          return {
            fatura_id: fatura.id,
            status: 'Paga',
            data_pagamento: require('../utils/dateUtils').getTodayString(),
            pago: true,
            arena_ativa: arena?.status === 1,
            arena_desbloqueada: resLiquida.arena_desbloqueada
          };
        }
      }
    }
  } catch (mpErr) {
    logger.error('[Status Polling MP Live Check Error]', mpErr.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/tenant/assinatura/status-pagamento/:gateway_ref
// Usado pelo Polling do frontend para verificar se o Pix da mensalidade foi pago.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status-pagamento/:gateway_ref', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { gateway_ref } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    let fatura = await db.getAsync(`
      SELECT f.id, f.status, f.data_pagamento, f.tenant_id, f.gateway_ref, a.status as arena_status
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.gateway_ref = ? OR f.id = ?
    `, [gateway_ref, gateway_ref]);

    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }
    if (fatura.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    await require('../services/saasPixService').consult(fatura.id);
    fatura = { ...fatura, ...await db.getAsync('SELECT status,data_pagamento,gateway_ref FROM FaturasSaaS WHERE id=?', [fatura.id]) };
    const liveApproved = await verificarStatusMercadoPagoAoVivo(fatura);
    if (liveApproved) {
      return res.json(liveApproved);
    }

    const recheckArena = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [tenantId]);

    res.json({
      fatura_id: fatura.id,
      status: fatura.status,
      data_pagamento: fatura.data_pagamento,
      pago: fatura.status === 'Paga',
      arena_ativa: recheckArena ? recheckArena.status === 1 : fatura.arena_status === 1,
    });
  } catch (err) {
    logger.error('[Tenant Assinatura Status Polling Error]', err);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/tenant/assinatura/planos-disponiveis
// Retorna a lista de todos os planos SaaS disponíveis para upgrade/troca.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/planos-disponiveis', async (req, res) => {
  try {
    const planos = await db.allAsync(`
      SELECT id, nome, max_quadras, max_usuarios, valor_mensal, valor_anual
      FROM PlanosSaaS
      ORDER BY valor_mensal ASC
    `);
    res.json(planos.map(p => ({ ...p, valor_mensal: p.valor_mensal / 100, valor_anual: p.valor_anual / 100 })));
  } catch (err) {
    logger.error('[Tenant Assinatura Planos Error]', err);
    res.status(500).json({ error: 'Erro ao buscar planos disponíveis.' });
  }
});

async function validarCapacidadeNovoPlano(tenantId, novoPlano) {
  const [countQuadras, countUsuarios] = await Promise.all([
    db.getAsync('SELECT COUNT(*) as total FROM Quadras WHERE tenant_id = ? AND status != "Excluida"', [tenantId]),
    db.getAsync("SELECT COUNT(*) as total FROM Usuarios WHERE tenant_id = ? AND ativo = 1 AND (perfil IS NULL OR (perfil != 'Cliente' AND perfil != 'cliente'))", [tenantId])
  ]);

  const quadrasAtuais = countQuadras ? countQuadras.total : 0;
  const usuariosAtuais = countUsuarios ? countUsuarios.total : 0;

  if (novoPlano.max_quadras > 0 && quadrasAtuais > novoPlano.max_quadras) {
    throw new Error(`Sua arena possui ${quadrasAtuais} quadras ativas, excedendo o limite de ${novoPlano.max_quadras} do plano ${novoPlano.nome}. Remova ou arquive quadras excedentes antes de migrar para este plano.`);
  }

  if (novoPlano.max_usuarios > 0 && usuariosAtuais > novoPlano.max_usuarios) {
    throw new Error(`Sua arena possui ${usuariosAtuais} funcionários ativos, excedendo o limite de ${novoPlano.max_usuarios} do plano ${novoPlano.nome}. Remova ou desative funcionários excedentes antes de migrar para este plano.`);
  }
}

function calcularValoresUpgradePlano(novoPlano, ciclo) {
  const { httpError } = require('../utils/security');
  if (ciclo !== undefined && !['mensal', 'anual'].includes(ciclo)) throw httpError(400, 'Ciclo inválido.');
  if (/enterprise/i.test(novoPlano.nome) || novoPlano.valor_mensal === 0) {
    throw httpError(409, 'Este plano deve ser contratado com um consultor.');
  }
  const cicloEscolhido = ciclo === 'anual' ? 'anual' : 'mensal';
  let valorFinal = novoPlano.valor_mensal;
  let descricaoFinal = `Assinatura Plano ${novoPlano.nome} (Mensal)`;

  if (cicloEscolhido === 'anual') {
    valorFinal = novoPlano.valor_anual * 12;
    descricaoFinal = `Assinatura Plano ${novoPlano.nome} (Anual - 12 meses)`;
  }

  if (!Number.isSafeInteger(valorFinal) || valorFinal <= 0) throw httpError(409, 'Preço indisponível para este ciclo.');
  return { cicloEscolhido, valorFinal, descricaoFinal };
}

async function obterOuCriarFaturaUpgrade({ tenantId, novoPlano, valorFinal, cicloEscolhido, descricaoFinal, hoje, valorConfirmado }) {
  return db.transaction(async () => {
    const { httpError } = require('../utils/security');
    const planoAtual = await db.getAsync('SELECT * FROM PlanosSaaS WHERE id = ?', [novoPlano.id]);
    const precoAtual = calcularValoresUpgradePlano(planoAtual, cicloEscolhido).valorFinal;
    if (precoAtual !== valorFinal || (valorConfirmado !== undefined && valorConfirmado !== precoAtual)) {
      throw httpError(409, 'O preço do plano mudou. Consulte os planos e confirme novamente.');
    }
    await validarCapacidadeNovoPlano(tenantId, planoAtual);
    const pendentes = await db.allAsync(
      "SELECT * FROM FaturasSaaS WHERE tenant_id = ? AND status IN ('Pendente', 'Atrasada') ORDER BY id DESC", [tenantId]);
    const divergente = pendentes.some(f => Number(f.plano_id) !== Number(novoPlano.id) ||
      Number(f.valor) !== Number(valorFinal) || (f.ciclo || 'mensal') !== cicloEscolhido);
    if (divergente) {
      throw require('../utils/security').httpError(409,
        'Regularize as faturas em aberto antes de trocar de plano ou ciclo. Os Pix emitidos continuam vinculados às faturas originais.');
    }
    let faturaId = pendentes[0]?.id;
    if (!faturaId) {
      const arena = await db.getAsync('SELECT plano_id, ciclo_cobranca FROM Arenas WHERE id = ?', [tenantId]);
      if (arena.plano_id === novoPlano.id && (arena.ciclo_cobranca || 'mensal') === cicloEscolhido) {
        throw httpError(409, 'Este plano e ciclo já estão ativos. Consulte suas faturas para renovar.');
      }
      const result = await db.runAsync(`
        INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, ciclo, descricao, data_vencimento, periodo_fim, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendente')`,
      [tenantId, novoPlano.id, valorFinal, cicloEscolhido, descricaoFinal, hoje,
        calcularProximaDataVencimento(hoje, Number(hoje.slice(8, 10)), cicloEscolhido)]);
      faturaId = result.lastID;
    }
    await db.runAsync('UPDATE Arenas SET fatura_plano_pendente_id = ? WHERE id = ?', [faturaId, tenantId]);
    return faturaId;
  });
}

// 7. POST /api/tenant/assinatura/solicitar-upgrade
// Processa a solicitação de upgrade/troca de plano feita pelo gestor da arena.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/solicitar-upgrade', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { plano_id, ciclo, valor_confirmado_centavos } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }
  if (!plano_id) {
    return res.status(400).json({ error: 'ID do plano desejado não fornecido.' });
  }

  try {
    const [arena, novoPlano] = await Promise.all([
      db.getAsync('SELECT id, nome, plano_id, status FROM Arenas WHERE id = ?', [tenantId]),
      db.getAsync('SELECT * FROM PlanosSaaS WHERE id = ?', [plano_id])
    ]);

    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }
    if (!novoPlano) {
      return res.status(404).json({ error: 'Plano solicitado não encontrado.' });
    }

    await validarCapacidadeNovoPlano(tenantId, novoPlano);

    const { cicloEscolhido, valorFinal, descricaoFinal } = calcularValoresUpgradePlano(novoPlano, ciclo);
    const hoje = require('../utils/dateUtils').getTodayString();

    const faturaId = await obterOuCriarFaturaUpgrade({
      tenantId,
      novoPlano,
      valorFinal,
      cicloEscolhido,
      descricaoFinal,
      hoje,
      valorConfirmado: valor_confirmado_centavos
    });

    const pixData = await gerarPixComFatura(faturaId);

    logAuditEvent(
      req.user.id,
      'SaaS: Solicitação de Upgrade',
      `Arena '${arena.nome}' (ID: ${tenantId}) solicitou upgrade para o Plano ${novoPlano.nome} (Ciclo: ${cicloEscolhido}, Fatura #${faturaId}, Valor: R$ ${valorFinal}).`,
      req.headers['x-forwarded-for'] || req.ip
    );

    res.json({
      fatura_id: faturaId,
      valor: valorFinal / 100,
      ciclo: cicloEscolhido,
      descricao: descricaoFinal,
      plano_nome: novoPlano.nome,
      pix: pixData
    });
  } catch (err) {
    logger.error('[Solicitar Upgrade Error]', err);
    res.status(err.status || 400).json({ ...require('../utils/paymentProviderError').paymentErrorBody(err, 'Erro ao processar solicitação de upgrade.'), fatura_id: err.fatura_id });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.1 POST /api/tenant/assinatura/adiantar-fatura
// Permite que o gestor gere e pague a próxima fatura do plano antecipadamente.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adiantar-fatura', async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const { arena, planoNome, ciclo, valorFinal, faturaId, dataVencimento, descricaoFinal } = await db.transaction(async () => {
      const arena = await db.getAsync(`
        SELECT a.id, a.nome, a.plano_id, a.dia_vencimento, a.ciclo_cobranca, a.trial_expira_em,
               p.id as plano_id_real, p.nome as plano_nome, p.valor_mensal, p.valor_anual
        FROM Arenas a
        JOIN PlanosSaaS p ON a.plano_id = p.id
        WHERE a.id = ?
      `, [tenantId]);

      if (!arena) {
        throw require('../utils/security').httpError(404, 'Arena ou plano não encontrado.');
      }

      let ciclo = arena.ciclo_cobranca || 'mensal';
      let planoNome = arena.plano_nome;
      let valorFinal = arena.valor_mensal;

      if (ciclo === 'anual') {
        valorFinal = arena.valor_anual * 12;
      }

      // 1. Verificar se já existe uma fatura pendente/atrasada (Idempotência)
      let faturaPendente = await db.getAsync(`
        SELECT f.id, f.valor, f.plano_id, f.status, f.data_vencimento, f.ciclo, f.descricao, p.nome AS plano_nome
        FROM FaturasSaaS f LEFT JOIN PlanosSaaS p ON p.id = f.plano_id
        WHERE f.tenant_id = ? AND f.status IN ('Pendente', 'Atrasada')
        ORDER BY f.data_vencimento ASC, f.id ASC
        LIMIT 1
      `, [tenantId]);

      let faturaId;
      let dataVencimento;
      let descricaoFinal;

      if (faturaPendente) {
        // Reutiliza a fatura pendente existente
        faturaId = faturaPendente.id;
        valorFinal = faturaPendente.valor;
        ciclo = faturaPendente.ciclo || 'mensal';
        planoNome = faturaPendente.plano_nome || 'Plano da fatura';
        dataVencimento = faturaPendente.data_vencimento;
        descricaoFinal = faturaPendente.descricao || `Assinatura Plano ${planoNome} - ${formatarCompetencia(dataVencimento, ciclo)}`;
      } else {
        if (!Number.isSafeInteger(valorFinal) || valorFinal <= 0) {
          throw require('../utils/security').httpError(409, 'Preço indisponível para este ciclo. Solicite a configuração do plano antes de antecipar.');
        }
        // Busca a última fatura existente da arena para avançar +1 ciclo a partir dela
        const ultimaFaturaExistente = await db.getAsync(`
          SELECT data_vencimento, ciclo, periodo_fim
          FROM FaturasSaaS
          WHERE tenant_id = ? AND status IN ('Paga', 'Pendente', 'Atrasada')
          ORDER BY data_vencimento DESC, id DESC
          LIMIT 1
        `, [tenantId]);

        let dia = arena.dia_vencimento || 10;
        if (ultimaFaturaExistente && ultimaFaturaExistente.data_vencimento) {
          // Avança exatamente 1 ciclo a partir da última fatura registrada
          dataVencimento = alinharVencimento(fimPeriodo(ultimaFaturaExistente, dia), dia);
        } else {
          // Primeira fatura da arena: calcula a partir da data atual
          dataVencimento = arena.trial_expira_em || require('../utils/dateUtils').getTodayString();
          dia = Number(dataVencimento.slice(8, 10));
          await db.runAsync('UPDATE Arenas SET dia_vencimento = ? WHERE id = ?', [dia, tenantId]);
        }

        const competenciaNome = formatarCompetencia(dataVencimento, ciclo);
        descricaoFinal = `Assinatura Plano ${arena.plano_nome} - ${competenciaNome} (Antecipada)`;

        // Insere nova fatura antecipada
        const result = await db.runAsync(`
          INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, ciclo, descricao, data_vencimento, periodo_fim, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendente')
        `, [tenantId, arena.plano_id, valorFinal, ciclo, descricaoFinal, dataVencimento,
          calcularProximaDataVencimento(dataVencimento, dia, ciclo)]);
        faturaId = result.lastID;
      }

      // 2. Gerar cobrança Pix
      return { arena, planoNome, ciclo, valorFinal, faturaId, dataVencimento, descricaoFinal };
    });

    const pixData = await gerarPixComFatura(faturaId);

    // 3. Log de auditoria
    logAuditEvent(
      req.user.id,
      'SaaS: Adiantamento de Fatura',
      `Arena '${arena.nome}' (ID: ${tenantId}) solicitou adiantamento da fatura #${faturaId} de R$ ${(valorFinal / 100).toFixed(2)} (Vencimento: ${dataVencimento}, Descrição: ${descricaoFinal}).`,
      req.headers['x-forwarded-for'] || req.ip
    );

    res.json({
      fatura_id: faturaId,
      valor: valorFinal / 100,
      ciclo: ciclo,
      descricao: descricaoFinal,
      data_vencimento: dataVencimento,
      competencia: formatarCompetencia(dataVencimento, ciclo),
      plano_nome: planoNome,
      pix: pixData
    });
  } catch (err) {
    logger.error('[Adiantar Fatura Error]', err);
    res.status(err.status || 400).json({ ...require('../utils/paymentProviderError').paymentErrorBody(err, 'Erro ao processar adiantamento de fatura.'), fatura_id: err.fatura_id });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET /api/tenant/assinatura/faturas/:id/recibo
// Retorna os dados completos da fatura liquidada para visualização/impressão do recibo.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/faturas/:id/recibo', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const faturaId = Number.parseInt(req.params.id, 10);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const fatura = await db.getAsync(`
      SELECT f.id, f.valor, f.data_vencimento, f.data_pagamento, f.status,
             f.gateway_ref, f.metodo_pagamento, f.ciclo, f.descricao, f.periodo_fim,
             p.nome as plano_nome, p.max_quadras, p.max_usuarios,
             a.nome as arena_nome, a.email as arena_email, a.telefone as arena_telefone, a.endereco as arena_endereco, a.slug as arena_slug
      FROM FaturasSaaS f
      JOIN PlanosSaaS p ON f.plano_id = p.id
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.id = ? AND f.tenant_id = ?
    `, [faturaId, tenantId]);

    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }
    if (!fatura.status || fatura.status.toLowerCase() !== 'paga') {
      return res.status(400).json({ error: 'O recibo só fica disponível após a confirmação do pagamento.' });
    }

    const valorNumerico = Number(fatura.valor) / 100;

    res.json({
      recibo_numero: `REC-${String(fatura.id).padStart(6, '0')}`,
      data_emissao: new Date().toISOString(),
      fatura: {
        id: fatura.id,
        valor: valorNumerico,
        ciclo: fatura.ciclo || 'mensal',
        descricao: fatura.descricao || `Assinatura Plano ${fatura.plano_nome}`,
        data_vencimento: fatura.data_vencimento,
        periodo_fim: fimPeriodo(fatura, Number(fatura.data_vencimento.slice(8, 10))),
        data_pagamento: fatura.data_pagamento,
        metodo_pagamento: fatura.metodo_pagamento || null,
        gateway_ref: fatura.gateway_ref || null,
        status: fatura.status
      },
      plano: {
        nome: fatura.plano_nome,
        max_quadras: fatura.max_quadras,
        max_usuarios: fatura.max_usuarios
      },
      arena: {
        nome: fatura.arena_nome,
        email: fatura.arena_email,
        telefone: fatura.arena_telefone,
        endereco: fatura.arena_endereco,
        slug: fatura.arena_slug
      },
      emissor: {
        empresa: process.env.BILLING_ISSUER_NAME || null,
        cnpj: process.env.BILLING_ISSUER_CNPJ || null,
        suporte: process.env.BILLING_SUPPORT_EMAIL || null
      }
    });
  } catch (err) {
    logger.error('[Tenant Assinatura Recibo Error]', err);
    res.status(500).json({ error: 'Erro ao gerar recibo da fatura.' });
  }
});

module.exports = router;
