const logger = require('../utils/safeLogger').forModule('publicController');
const {fetch}=require('../utils/providerHttp');
const { modalities, getReservationPrice, timeMinutes } = require('../utils/bookingPrice');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { criarCobrancaPix, criarCobrancaCartao, resolverContextoWebhookMercadoPago, liquidarWebhookMercadoPago } = require('../services/gatewayService');
const { getTodayString, getLocalTimeString } = require('../utils/dateUtils');

/**
 * Controller Público — Vitrine do Tenant (Sem Necessidade de Autenticação JWT)
 */

// Helper para normalizar slug
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper para cancelar automaticamente reservas pendentes vencidas (mais de 15 min ou data no passado)
const expirarReservasAntigas = tenantId => require('../services/bookingCancellationService').expireUnpaid(tenantId);

// 1. Resolver Dados da Arena pelo Slug
const getTenantBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const arena = await db.getAsync(
      `SELECT id, nome, endereco, telefone, email, fuso_horario, horario_abertura, horario_fechamento, status, slug, foto_capa, criado_em,
              CASE WHEN gateway_access_token IS NOT NULL AND TRIM(gateway_access_token)!='' THEN gateway_public_key ELSE NULL END AS gateway_public_key
       FROM Arenas 
       WHERE slug = ? AND status != -1`,
      [slug]
    );

    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada. Verifique o link e tente novamente.' });
    }

    if (arena.status === 0) {
      return res.status(403).json({
        blocked: true,
        error: 'Esta arena está com os agendamentos temporariamente suspensos. Entre em contato com o local.'
      });
    }

    // Calcula o horário consolidado de funcionamento da arena com base no menor horário de abertura e maior de fechamento das quadras ativas
    const quadrasHours = await db.getAsync(
      `SELECT MIN(hora_abertura) as min_abertura, MAX(hora_fechamento) as max_fechamento 
       FROM Quadras 
       WHERE tenant_id = ? AND status = 'Ativa'`,
      [arena.id]
    );

    const horaAberturaFinal = (quadrasHours && quadrasHours.min_abertura)
      ? quadrasHours.min_abertura
      : (arena.horario_abertura || '06:00');

    const horaFechamentoFinal = (quadrasHours && quadrasHours.max_fechamento)
      ? quadrasHours.max_fechamento
      : (arena.horario_fechamento || '23:00');

    res.json({
      arena: {
        ...arena,
        horario_abertura: horaAberturaFinal,
        horario_fechamento: horaFechamentoFinal
      }
    });
  } catch (err) {
    logger.error('[Public Controller Error] getTenantBySlug:', err);
    res.status(err.status || 500).json({ error: 'Erro ao carregar dados da arena.' });
  }
};

// 2. Buscar Quadras Ativas pelo Slug da Arena
const getQuadrasBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const quadras = await db.allAsync(
      `SELECT id, nome, tipo, modalidades, preco_base, hora_abertura, hora_fechamento, status
       FROM Quadras 
       WHERE tenant_id = ? AND status = 'Ativa'`,
      [arena.id]
    );

    const formatted = quadras.map(q => {
      let modalidades = [];
      if (q.modalidades) {
        try {
          modalidades = typeof q.modalidades === 'string' ? JSON.parse(q.modalidades) : q.modalidades;
        } catch {
          modalidades = [{ nome: q.tipo || 'Beach Tennis', preco: q.preco_base || 80 }];
        }
      } else if (q.tipo) {
        modalidades = q.tipo === 'Areia' 
          ? [
              { nome: 'Beach Tennis', preco: q.preco_base || 80 },
              { nome: 'Vôlei de Praia', preco: q.preco_base || 80 },
              { nome: 'Futevôlei', preco: q.preco_base || 80 }
            ]
          : [{ nome: q.tipo, preco: q.preco_base || 80 }];
      }

      const normalized = (Array.isArray(modalidades) ? modalidades : []).map(m => {
        if (typeof m === 'string') return { nome: m, preco: (q.preco_base != null ? q.preco_base : 8000) / 100 };
        return { nome: m.nome, preco: Number(m.preco != null ? m.preco : q.preco_base || 8000) / 100 };
      });

      return { ...q, preco_base: (q.preco_base != null ? q.preco_base : 8000) / 100, modalidades: normalized };
    });

    res.json({ quadras: formatted });
  } catch (err) {
    logger.error('[Public Controller Error] getQuadrasBySlug:', err);
    res.status(500).json({ error: 'Erro ao buscar quadras.' });
  }
};

// 3. Matriz de Disponibilidade de Horários (100% Privado sem expor nomes de terceiros - RN-02)
const getDisponibilidadeBySlug = async (req, res) => {
  const { slug } = req.params;
  const quadraIdFiltro = req.query.quadra_id ? Number.parseInt(req.query.quadra_id, 10) : null;
  const esporteFiltro = req.query.esporte || null;

  try {
    const arena = await db.getAsync('SELECT id, horario_abertura, horario_fechamento, fuso_horario FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const zone = arena.fuso_horario || 'America/Sao_Paulo';
    const dataFiltro = req.query.data || getTodayString(zone);

    // Busca quadras ativas da arena
    let queryQuadras = 'SELECT id, nome, tipo, modalidades, preco_base, hora_abertura, hora_fechamento FROM Quadras WHERE tenant_id = ? AND status = \'Ativa\'';
    const paramsQuadras = [arena.id];
    if (quadraIdFiltro) {
      queryQuadras += ' AND id = ?';
      paramsQuadras.push(quadraIdFiltro);
    }
    const quadras = await db.allAsync(queryQuadras, paramsQuadras);

    // 1. Cancela automaticamente reservas pendentes com mais de 15 minutos sem pagamento ou no passado
    await expirarReservasAntigas(arena.id);

    // Busca reservas ocupadas no dia (NUNCA expõe cliente_id ou nome do atleta - RN-02)
    // Apenas reservas efetivamente CONFIRMADAS/PAGAS ocupam a grade pública
    const reservasOcupadas = await db.allAsync(
      `SELECT quadra_id, hora_inicio, hora_fim
       FROM Reservas
       WHERE tenant_id = ? AND data_reserva = ? AND status != 'Cancelada'`,
      [arena.id, dataFiltro]
    );

    // Busca bloqueios de quadra no dia
    const bloqueios = await db.allAsync(
      `SELECT quadra_id, hora_inicio, hora_fim, motivo
       FROM Bloqueios
       WHERE quadra_id IN (SELECT id FROM Quadras WHERE tenant_id = ?) AND data_bloqueio = ?`,
      [arena.id, dataFiltro]
    );

    const todayStr = getTodayString(zone);
    const currentTimeStr = getLocalTimeString(zone);
    const isHoje = dataFiltro === todayStr;

    const resultadoPorQuadra = quadras.map(q => {
      const normalizedModalidades=modalities(q);
      const requested=esporteFiltro && esporteFiltro!=='Todos' ? esporteFiltro : undefined;
      if(requested && !normalizedModalidades.some(m=>m.nome===requested)) return null;
      const precoSlot=getReservationPrice(q,requested);
      // Define os horários reais da quadra/arena (Ex: das 06:00 às 23:00)
      const hAbertura = q.hora_abertura || arena.horario_abertura || '06:00';
      const hFechamento = q.hora_fechamento || arena.horario_fechamento || '23:00';

      const slotsHorarios=[];
      for(let minute=timeMinutes(hAbertura);minute+60<=timeMinutes(hFechamento);minute+=60) {
        slotsHorarios.push(String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'));
      }

      const slots = slotsHorarios.map(hInicio => {
        const [h, m] = hInicio.split(':').map(Number);
        const hFim = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Checa se o horário no dia de hoje já passou
        const jaPassou = isHoje && hInicio <= currentTimeStr;

        // Checa se coincide com reserva existente
        const temReserva = reservasOcupadas.some(r => String(r.quadra_id) === String(q.id) && (
          r.hora_inicio < hFim && r.hora_fim > hInicio
        ));

        // Checa se coincide com bloqueio
        const temBloqueio = bloqueios.some(b => String(b.quadra_id) === String(q.id) && (
          b.hora_inicio < hFim && b.hora_fim > hInicio
        ));

        let statusSlot = 'disponivel';
        if (jaPassou) {
          statusSlot = 'passado';
        } else if (temReserva || temBloqueio) {
          statusSlot = 'ocupado';
        }

        return {
          hora_inicio: hInicio,
          hora_fim: hFim,
          status: statusSlot,
          preco: precoSlot / 100
        };
      });

      return {
        quadra_id: q.id,
        quadra_nome: q.nome,
        tipo: q.tipo || 'Areia',
        modalidades: normalizedModalidades,
        preco_base: precoSlot / 100,
        hora_abertura: hAbertura,
        hora_fechamento: hFechamento,
        slots
      };
    });

    res.json({
      arena_id: arena.id,
      data: dataFiltro,
      quadras: resultadoPorQuadra.filter(Boolean)
    });
  } catch (err) {
    logger.error('[Public Controller Error] getDisponibilidadeBySlug:', err);
    res.status(500).json({ error: 'Erro ao verificar disponibilidade.' });
  }
};

/**
 * Gerador de Payload Pix EMV QRCPS (Padrão Oficial Banco Central do Brasil)
 * Permite que o pagamento vá DIRETO para a conta bancária do Dono da Arena
 */
function gerarPixEMV({ chave, nome, cidade = 'SAO PAULO', valor, txid = '***' }) {
  const cleanChave = (chave || '').trim();
  if (!cleanChave) return '';

  const cleanNome = (nome || 'ARENA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 25)
    .toUpperCase();

  const cleanCidade = (cidade || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 15)
    .toUpperCase();

  const valStr = Number.parseFloat(valor).toFixed(2);
  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  const formatField = (id, value) => {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const gui = formatField('00', 'BR.GOV.BCB.PIX');
  const key = formatField('01', cleanChave);
  const merchantAccount = formatField('26', `${gui}${key}`);

  const payloadParts = [
    formatField('00', '01'),
    merchantAccount,
    formatField('52', '0000'),
    formatField('53', '986'),
    formatField('54', valStr),
    formatField('58', 'BR'),
    formatField('59', cleanNome),
    formatField('60', cleanCidade),
    formatField('62', formatField('05', cleanTxid)),
  ];

  const payloadString = payloadParts.join('') + '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < payloadString.length; i++) {
    crc ^= (payloadString.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }

  const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return `${payloadString}${crcHex}`;
}

// 4. Checkout Rápido sem Senha — Agendamento (Único ou Múltiplos Horários) + Gerar Pix
const agendarReservaPublica = async (req, res) => {
  const { slug } = req.params;
  const { nome, telefone, cpf, email, quadra_id, data_reserva, hora_inicio, hora_fim, itens, esporte } = req.body;
  const paymentMethod = req.body.payment_method === 'card' ? 'card' : 'pix';

  if (paymentMethod === 'card' && process.env.ENABLE_PUBLIC_BOOKING_CARD !== 'true') {
    return res.status(403).json({ error: 'Pagamento com cartão indisponível para reservas. Escolha Pix.' });
  }

  const listaItens = getBookingItems({ itens, quadra_id, data_reserva, hora_inicio, hora_fim, esporte });
  if (!listaItens) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios e selecione ao menos um horário.' });
  }

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
  }

  let reservasCriadasIds = [];
  try {
    const arena = await db.getAsync(
      'SELECT id, nome, email, telefone, chave_pix, titular_pix, cidade_pix, pix_checkout_mode, gateway_access_token, gateway_public_key FROM Arenas WHERE slug = ? AND status = 1',
      [slug]
    );
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada ou indisponível.' });
    }

    const hasGateway = !!(arena.gateway_access_token?.trim());
    const hasChavePix = !!(arena.chave_pix?.trim());
    const pixMode = arena.pix_checkout_mode === 'chave_pix' ? 'chave_pix'
      : arena.pix_checkout_mode === 'mercado_pago' ? 'mercado_pago'
      : hasGateway ? 'mercado_pago' : 'chave_pix';

    if (paymentMethod === 'card' && (!hasGateway || !arena.gateway_public_key?.trim())) {
      return res.status(400).json({ error: 'Pagamento com cartão não está configurado para esta arena.' });
    }

    if (paymentMethod === 'pix' && ((pixMode === 'mercado_pago' && !hasGateway) || (pixMode === 'chave_pix' && !hasChavePix))) {
      return res.status(400).json({
        payment_not_configured: true,
        telefone_arena: arena.telefone || null,
        error: pixMode === 'chave_pix'
          ? 'Esta arena ainda não cadastrou uma chave Pix para reservas online. Entre em contato com a recepção.'
          : 'Esta arena ainda não conectou o Mercado Pago para reservas online. Entre em contato com a recepção.'
      });
    }

    const clientCookies=require('../services/sessionService').cookies(req);
    if(clientCookies.cm_session) req.user=await require('../services/sessionService').authenticate(req);
    const clientAccess=require('../services/clientAccessService');
    const created = await db.transaction(async()=>{
      const inserted=await require('../services/bookingService').createBookings({tenantId:arena.id,items:listaItens,actor:req.user,contact:{nome,email,telefone,cpf}});
      const guestAccess=await clientAccess.createGuestAccess(arena.id,inserted.grupoId);
      const placeholders=inserted.reservasCriadasIds.map(() => '?').join(',');
      const staticCopiaCola = paymentMethod === 'pix' && pixMode === 'chave_pix'
        ? gerarPixEMV({ chave: arena.chave_pix.trim(), nome: arena.titular_pix || arena.nome || 'Arena',
          cidade: arena.cidade_pix || 'SAO PAULO', valor: inserted.valorTotalGeral / 100,
          txid: `RES${inserted.reservasCriadasIds[0]}` }) : null;
      await db.runAsync(`UPDATE Reservas SET pix_checkout_mode=?, pix_copia_cola=? WHERE id IN (${placeholders})`,
        [paymentMethod === 'pix' ? pixMode : null, staticCopiaCola, ...inserted.reservasCriadasIds]);
      return {inserted,guestAccess,staticCopiaCola};
    });
    const {inserted,guestAccess,staticCopiaCola}=created;
    const valorTotalGeral = inserted.valorTotalGeral / 100;
    reservasCriadasIds = inserted.reservasCriadasIds;
    const primeiraReservaId = reservasCriadasIds[0];
    clientAccess.setGuestCookies(res,guestAccess);

    let pixData = null;
    let pixFailure = null;
    if (paymentMethod === 'pix') {
      try {
        if (pixMode === 'chave_pix') {
          pixData = { gateway_ref: `PIX_ESTATICO_${primeiraReservaId}`, copia_cola: staticCopiaCola,
            qr_code: await require('qrcode').toDataURL(staticCopiaCola) };
        } else {
          pixData = await criarCobrancaPix(primeiraReservaId, inserted.valorTotalGeral, arena.id);
        }
      } catch (eGateway) {
        pixFailure = require('../utils/paymentProviderError').paymentErrorBody(eGateway);
        const safeMsg = String(eGateway?.message || '').replace(/[\r\n]/g, '');
        logger.warn('[Public Checkout Warning] Falha ao gerar Pix no gateway:', safeMsg);
      }
    }

    if (paymentMethod === 'card') {
      logAuditEvent(0, 'Reserva Publica Multi-Slot', `Atleta agendou ${reservasCriadasIds.length} reserva(s) para pagamento com cartão.`, req.ip);
      return res.status(201).json({
        message: 'Reserva criada. Conclua o pagamento com cartão.',
        reserva_id: primeiraReservaId,
        reservas_ids: reservasCriadasIds,
        valor_total: valorTotalGeral,
        payment_method: 'card'
      });
    }

    if (paymentMethod === 'pix' && !pixData) {
      const placeholders = reservasCriadasIds.map(() => '?').join(',');
      await db.runAsync(`UPDATE Reservas SET observacoes_cancelamento='Cobranca pendente de conciliacao' WHERE id IN (${placeholders})`, reservasCriadasIds);
      return res.status(202).json({
        payment_pending_review: true,
        payment_state: pixFailure?.next_action === 'correct_configuration' ? 'failed' : 'unknown',
        payment_error: pixFailure,
        reserva_id: primeiraReservaId,
        reservas_ids: reservasCriadasIds,
        message: 'Reserva registrada, mas não foi possível confirmar a cobrança Pix. Consulte o status antes de tentar novamente.'
      });
    }

    logAuditEvent(
      0,
      'Reserva Publica Multi-Slot',
      `Atleta '${nome}' agendou ${reservasCriadasIds.length} reserva(s) [IDs: ${reservasCriadasIds.join(', ')}] totalizando R$ ${valorTotalGeral.toFixed(2)}.`,
      req.ip
    );

    res.status(201).json({
      message: 'Reserva(s) realizada(s) com sucesso! Realize o pagamento via Pix para garantir a vaga.',
      reserva_id: primeiraReservaId,
      reservas_ids: reservasCriadasIds,
      gateway_ref: pixData.gateway_ref,
      copia_cola: pixData.copia_cola,
      qr_code: pixData.qr_code || await require('qrcode').toDataURL(pixData.copia_cola),
      manual_confirmation: pixMode === 'chave_pix',
      valor_total: valorTotalGeral,
      expira_em_minutos: pixMode === 'chave_pix' ? null : 15
    });
  } catch (err) {
    if (reservasCriadasIds.length > 0) {
      try {
        const placeholders = reservasCriadasIds.map(() => '?').join(',');
        await db.runAsync(`UPDATE Reservas SET observacoes_cancelamento='Cobranca pendente de conciliacao' WHERE id IN (${placeholders})`, reservasCriadasIds);
      } catch (rollbackErr) {
        logger.warn('[Public Checkout Catch Rollback Error]:', rollbackErr.message);
      }
    }
    logger.error('[Public Controller Error] agendarReservaPublica:', err);
    res.status(err.status||500).json({ error: require('../utils/security').publicError(err,'Erro ao concluir o agendamento.') });
  }
};

const pagarReservaCartaoPublica = async (req, res) => {
  const { slug } = req.params;
  const ids = req.body.reservas_ids;
  const card = req.body.card_data;
  try {
    if (!Array.isArray(ids) || !ids.length || ids.length > 24 || !card ||
        typeof card.token !== 'string' || card.token.length > 8192 ||
        typeof card.payment_method_id !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(card.payment_method_id) ||
        typeof card.cardholderEmail !== 'string' || card.cardholderEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.cardholderEmail) ||
        typeof card.identificationNumber !== 'string' || !/^\d{5,20}$/.test(card.identificationNumber) ||
        typeof card.identificationType !== 'string' || !/^[A-Z]{2,8}$/i.test(card.identificationType) ||
        !Number.isInteger(Number(card.installments)) || Number(card.installments) < 1 || Number(card.installments) > 24) {
      return res.status(400).json({ error: 'Dados de pagamento inválidos.' });
    }
    const arena = await db.getAsync('SELECT id,gateway_access_token,gateway_public_key FROM Arenas WHERE slug=? AND status=1',[slug]);
    if (!arena?.gateway_access_token || !arena.gateway_public_key) return res.status(400).json({ error: 'Pagamento com cartão não está configurado para esta arena.' });
    const reservations = await db.allAsync(`SELECT id,tenant_id,grupo_id,valor_total FROM Reservas WHERE tenant_id=? AND id IN (${ids.map(()=>'?').join(',')})`,[arena.id,...ids]);
    if (reservations.length !== ids.length || new Set(reservations.map(row=>row.grupo_id)).size !== 1) return res.status(404).json({ error: 'Reservas não encontradas.' });
    const first = reservations[0];
    if (!first.grupo_id || reservations.some(row=>row.grupo_id!==first.grupo_id)) return res.status(409).json({ error: 'Grupo de reservas inválido.' });
    const total = reservations.reduce((sum,row)=>sum+Number(row.valor_total),0);
    if (!Number.isSafeInteger(total) || total <= 0) return res.status(400).json({ error: 'Valor de pagamento inválido.' });
    const payment = await criarCobrancaCartao(first.id,total,{
      token: card.token,
      payment_method_id: card.payment_method_id,
      issuer_id: card.issuerId,
      installments: Number(card.installments),
      email: card.cardholderEmail.trim().toLowerCase(),
      identification: { type: card.identificationType, number: card.identificationNumber }
    },arena.id);
    if (['rejected','cancelled'].includes(payment.status)) {
      await require('../services/bookingCancellationService').requestCancellation(ids,{tenantId:arena.id,onlyUnpaid:true,reason:'Pagamento com cartão recusado'});
    }
    return res.json({ payment_status: payment.status, gateway_ref: payment.gateway_ref });
  } catch (err) {
    logger.error('[Public Controller Error] pagarReservaCartaoPublica:', err);
    return res.status(err.status || 502).json({ error: require('../utils/security').publicError(err,'Não foi possível confirmar o pagamento. A reserva ficará pendente para verificação.') });
  }
};

const { cadastrarAtletaPublico,loginAtletaPublico,googleAuthAtletaPublico,getPerfilAtleta,atualizarPerfilAtleta,solicitarRecuperacaoSenhaAtleta,redefinirSenhaAtleta } = require('./athleteAuthController');

async function consultarELiquidarMercadoPago(reservaId, arenaId, gatewayAccessToken) {
  const transacao = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = ? AND status = "Pendente"', [reservaId]);
  if (!transacao?.gateway_ref || transacao.gateway_ref.startsWith('sim_') || transacao.gateway_ref.startsWith('PIX_')) {
    return null;
  }

  try {
    const context = await resolverContextoWebhookMercadoPago(transacao.gateway_ref);
    if (context) {
      await liquidarWebhookMercadoPago(transacao.gateway_ref, context);
      return await db.getAsync('SELECT id, status, status_pagamento FROM Reservas WHERE id = ? AND tenant_id = ?', [reservaId, arenaId]);
    }
  } catch (eMp) {
    logger.warn('[Public Polling Warning] Erro ao consultar API do Mercado Pago:', eMp.message);
  }
  return null;
}

// 11. Consultar Status do Pagamento da Reserva para Polling do Pix
const getStatusReservaPublica = async (req, res) => {
  const { slug, reserva_id } = req.params;

  try {
    let reserva = await db.getAsync('SELECT id, tenant_id, status, status_pagamento FROM Reservas WHERE id = ?', [reserva_id]);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (slug) {
      const arenaBySlug = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
      if (!arenaBySlug || Number(arenaBySlug.id) !== Number(reserva.tenant_id)) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }
    }

    const arena = await db.getAsync('SELECT id, gateway_access_token FROM Arenas WHERE id = ? AND status = 1', [reserva.tenant_id]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    if (reserva.status_pagamento === 'Pendente') {
      const atualizada = await consultarELiquidarMercadoPago(reserva_id, arena.id, arena.gateway_access_token);
      if (atualizada) {
        reserva = atualizada;
      }
    }

    res.json({
      reserva_id: reserva.id,
      status: reserva.status,
      status_pagamento: reserva.status_pagamento
    });
  } catch (err) {
    logger.error('[Public Controller Error] getStatusReservaPublica:', err);
    res.status(500).json({ error: 'Erro ao consultar status da reserva.' });
  }
};

// 12. Cancelar Reserva Pendente por Desistência Rápida (Ao Fechar Modal sem Pagar)
const cancelarPendentePublico = async (req,res) => {
  try {
    const arena=await db.getAsync('SELECT id FROM Arenas WHERE slug=? AND status=1',[req.params.slug]);
    if(!arena) return res.status(404).json({error:'Arena não encontrada.'});
    const result=await require('../services/bookingCancellationService').requestCancellation(req.body.reservas_ids || [req.body.reserva_id],{tenantId:arena.id,onlyUnpaid:true,authorize:row=>require('../services/clientAccessService').canAccessReservation(req,row),reason:'Desistência do Cliente',reasonId:-1});
    res.status(result.pending?202:200).json({...result,message:result.pending?'Cancelamento solicitado. O horário permanece reservado até confirmar o pagamento.':'Reserva cancelada. Vaga liberada.'});
  } catch(error) {res.status(error.status||500).json({error:require('../utils/security').publicError(error)});}
};

// 13. Buscar Reservas do Atleta (por Token JWT e vínculo verificado)
const getMinhasReservasAtleta = async (req, res) => {
  const { slug } = req.params;
  const decoded=req.user;

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    await expirarReservasAntigas(arena.id);

    const member = await require('../services/clientAccessService').membership(req.user,arena.id,false);
    if(!member) return res.json([]);
    const clientIds=[member.id];


    const arenaInfo = await db.getAsync('SELECT id, nome, endereco, telefone, email, chave_pix, titular_pix FROM Arenas WHERE id = ?', [arena.id]);

    const reservas = await db.allAsync(
      `SELECT MIN(r.id) as id, r.quadra_id, q.nome as quadra_nome, r.data_reserva, 
              MIN(r.hora_inicio) as hora_inicio, MAX(r.hora_fim) as hora_fim, 
              SUM(r.valor_total)/100.0 as valor_total, COUNT(r.id) as total_horarios,
              c.cpf as cliente_cpf,
              CASE 
                WHEN MAX(CASE WHEN r.status != 'Cancelada' THEN 1 ELSE 0 END) = 0 THEN 'Cancelada'
                WHEN MAX(CASE WHEN r.status = 'Cancelamento pendente' THEN 1 ELSE 0 END) = 1 THEN 'Cancelamento pendente'
                WHEN MAX(CASE WHEN r.status = 'Confirmada' THEN 1 ELSE 0 END) = 1 THEN 'Confirmada'
                ELSE 'Pendente'
              END as status,
              CASE 
                WHEN MIN(CASE WHEN r.status_pagamento = 'Pago' THEN 1 ELSE 0 END) = 1 THEN 'Pago'
                WHEN MAX(CASE WHEN r.status = 'Cancelada' OR r.status_pagamento IN ('Estornado', 'Expirado', 'Cancelado (Pendente Estorno)', 'Desistência', 'Cancelado') THEN 1 ELSE 0 END) = 1 THEN MAX(r.status_pagamento)
                ELSE 'Pendente'
              END as status_pagamento,
              MAX(r.criado_em) as criado_em, r.codigo_validacao_cancelamento,
              tg.metodo as metodo_gateway, tg.status as status_gateway, tg.atualizado_em as data_gateway,
              p.metodo as metodo_pagamento, p.registrado_em as data_pagamento
       FROM Reservas r
       JOIN Quadras q ON r.quadra_id = q.id
       JOIN Clientes c ON r.cliente_id = c.id
       LEFT JOIN (
         SELECT tg1.reserva_id, tg1.gateway_ref, tg1.metodo, tg1.status, tg1.atualizado_em
         FROM TransacoesGateway tg1
         INNER JOIN (
           SELECT reserva_id, MAX(id) as max_id FROM TransacoesGateway GROUP BY reserva_id
         ) tg2 ON tg1.id = tg2.max_id
       ) tg ON r.id = tg.reserva_id
       LEFT JOIN (
         SELECT p1.reserva_id, p1.metodo, p1.registrado_em
         FROM Pagamentos p1
         INNER JOIN (
           SELECT reserva_id, MAX(id) as max_id FROM Pagamentos GROUP BY reserva_id
         ) p2 ON p1.id = p2.max_id
       ) p ON r.id = p.reserva_id
       WHERE r.tenant_id = ? AND r.cliente_id IN (${clientIds.map(() => '?').join(',')})
       GROUP BY COALESCE(NULLIF(r.grupo_id, ''), CAST(r.id AS TEXT))
       ORDER BY CASE 
                  WHEN MAX(CASE WHEN r.status = 'Cancelada' OR r.status_pagamento IN ('Estornado', 'Expirado', 'Cancelado (Pendente Estorno)', 'Desistência') THEN 1 ELSE 0 END) = 1 AND MAX(CASE WHEN r.status = 'Confirmada' OR r.status_pagamento = 'Pago' THEN 1 ELSE 0 END) = 0 THEN 3
                  WHEN (MIN(r.status) = 'Pendente' OR MIN(r.status_pagamento) = 'Pendente') AND r.data_reserva >= date('now', 'localtime') THEN 0
                  WHEN r.data_reserva >= date('now', 'localtime') THEN 1
                  ELSE 2 
                END, 
                CASE WHEN r.data_reserva >= date('now', 'localtime') THEN r.data_reserva END ASC,
                CASE WHEN r.data_reserva >= date('now', 'localtime') THEN MIN(r.hora_inicio) END ASC,
                r.data_reserva DESC, 
                MIN(r.hora_inicio) DESC`,
      [arena.id, ...clientIds]
    );

    const result = reservas.map(r => ({
      ...r,
      arena: {
        nome: arenaInfo?.nome || 'Arena',
        endereco: arenaInfo?.endereco || '',
        telefone: arenaInfo?.telefone || '',
        email: arenaInfo?.email || '',
        titular_pix: arenaInfo?.titular_pix || arenaInfo?.nome || ''
      }
    }));

    res.json(result);
  } catch (err) {
    logger.error('[Public Controller Error] getMinhasReservasAtleta:', err);
    res.status(500).json({ error: 'Erro ao buscar reservas do atleta.' });
  }
};

// 14. Solicitar Recuperação de Senha do Atleta


function calcularExpiracaoSegundos(criadoEm) {
  const criadoEmRaw = criadoEm ? String(criadoEm).replace(' ', 'T') : new Date().toISOString();
  const criadoEmStr = criadoEmRaw.endsWith('Z') ? criadoEmRaw : `${criadoEmRaw}Z`;
  const criadoEmTime = new Date(criadoEmStr).getTime();
  const agoraTime = Date.now();
  const decorridoSegundos = Math.max(0, Math.floor((agoraTime - criadoEmTime) / 1000));
  const restanteSegundos = Math.max(0, (15 * 60) - decorridoSegundos);
  const expiraEmMinutos = Math.ceil(restanteSegundos / 60);
  return { restanteSegundos, expiraEmMinutos };
}

async function resolverPixDados(reserva, arena) {
  let transacao = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = ? ORDER BY id DESC', [reserva.id]);
  const modo = reserva.pix_checkout_mode || (transacao ? 'mercado_pago'
    : arena.pix_checkout_mode === 'chave_pix' ? 'chave_pix'
    : arena.pix_checkout_mode === 'mercado_pago' ? 'mercado_pago'
    : arena.gateway_access_token?.trim() ? 'mercado_pago' : 'chave_pix');
  if (modo === 'chave_pix') {
    if (reserva.pix_copia_cola) {
      return { gatewayRef: `PIX_ESTATICO_${reserva.id}`, copiaCola: reserva.pix_copia_cola,
        qrCode: await require('qrcode').toDataURL(reserva.pix_copia_cola), manualConfirmation: true };
    }
    if (!arena.chave_pix?.trim()) return { errorConfig: true };
    const full = await db.getAsync('SELECT * FROM Reservas WHERE id=?', [reserva.id]);
    const members = await require('../services/paymentLedgerService').scopeReservations(full);
    let balance = 0;
    for (const member of members) {
      const paid = await db.getAsync('SELECT COALESCE(SUM(valor),0) AS total FROM Pagamentos WHERE reserva_id=?', [member.id]);
      balance += Math.max(0, member.valor_total - paid.total);
    }
    const copiaCola = gerarPixEMV({ chave: arena.chave_pix.trim(), nome: arena.titular_pix || arena.nome || 'Arena',
      cidade: arena.cidade_pix || 'SAO PAULO', valor: balance / 100, txid: `RES${reserva.id}` });
    return { gatewayRef: `PIX_ESTATICO_${reserva.id}`, copiaCola,
      qrCode: await require('qrcode').toDataURL(copiaCola), manualConfirmation: true };
  }
  if (!arena.gateway_access_token?.trim()) return { errorConfig: true };
  let gatewayRef = transacao?.gateway_ref || null;
  let copiaCola = null;
  let qrCode = null;
  let expiresAt = null;

  try {
      const service = require('../services/paymentIntentService');
      const intent = await service.consultPix(reserva.id, arena.id);
      if (intent?.state === 'failed') return { paymentPendingReview: true, payment_state: 'failed',
        payment_error: require('../utils/paymentProviderError').paymentErrorBody(
          require('../utils/paymentProviderError').normalizePaymentError(
            require('../utils/paymentProviderError').paymentError('PIX_PROVIDER_REJECTED'), intent.id)) };
      const pixData = service.cachedResponse(intent);
      if (pixData) {
        gatewayRef = pixData.gateway_ref || gatewayRef;
        copiaCola = pixData.copia_cola;
        qrCode = pixData.qr_code;
        expiresAt = pixData.expira_em;
      }
  } catch (eGateway) {
    const safeMsg = String(eGateway?.message || '').replace(/[\r\n]/g, '');
    logger.warn('[Public Controller Warning] Erro ao re-gerar Pix via gatewayService:', safeMsg);
  }

  if (!copiaCola) {
    return { paymentPendingReview: true };
  }

  if (!qrCode) {
    qrCode = await require('qrcode').toDataURL(copiaCola);
  }

  return { gatewayRef, copiaCola, qrCode, expiresAt };
}

// 16. Recuperar/Obter Dados do Pix de uma Reserva Pendente
const obterPixReservaPendente = async (req, res) => {
  const { slug, reserva_id } = req.params;

  try {
    const arena = await db.getAsync(
      'SELECT id, nome, email, telefone, chave_pix, titular_pix, cidade_pix, pix_checkout_mode, gateway_access_token FROM Arenas WHERE slug = ? AND status = 1',
      [slug]
    );
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    await expirarReservasAntigas(arena.id);

    const reserva = await db.getAsync(
      `SELECT r.id, r.tenant_id, r.cliente_id, r.quadra_id, q.nome as quadra_nome, 
              r.data_reserva, r.hora_inicio, r.hora_fim, r.valor_total, 
              r.status, r.status_pagamento, r.criado_em, r.pix_checkout_mode, r.pix_copia_cola,
              c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone, c.cpf as cliente_cpf
       FROM Reservas r
       JOIN Quadras q ON r.quadra_id = q.id
       LEFT JOIN Clientes c ON r.cliente_id = c.id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [reserva_id, arena.id]
    );

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (['Cancelada','Cancelamento pendente'].includes(reserva.status) || reserva.status_pagamento === 'Expirado') {
      return res.status(400).json({ error: 'Esta reserva foi cancelada ou expirou por falta de pagamento.' });
    }

    if (reserva.status_pagamento === 'Pago') {
      return res.json({
        reserva_id: reserva.id,
        status: reserva.status,
        status_pagamento: 'Pago',
        message: 'Esta reserva já foi paga com sucesso!'
      });
    }

    const pixDados = await resolverPixDados(reserva, arena);
    const current = await db.getAsync('SELECT status,status_pagamento FROM Reservas WHERE id=?', [reserva.id]);
    if (current.status_pagamento === 'Pago' || ['Cancelada', 'Cancelamento pendente'].includes(current.status)) {
      return res.json({ reserva_id: reserva.id, ...current });
    }
    if (pixDados.errorConfig) {
      return res.status(400).json({
        payment_not_configured: true,
        telefone_arena: arena.telefone || null,
        error: 'Esta arena não tem a forma de Pix da reserva configurada. Entre em contato com a recepção.'
      });
    }
    if (pixDados.paymentPendingReview) {
      return res.status(202).json({
        payment_pending_review: true,
        payment_state: pixDados.payment_state || 'unknown',
        payment_error: pixDados.payment_error,
        reserva_id: reserva.id,
        message: 'Não foi possível confirmar a cobrança Pix. Consulte o status antes de tentar novamente.'
      });
    }

    const { restanteSegundos, expiraEmMinutos } = calcularExpiracaoSegundos(reserva.criado_em);

    res.json({
      reserva_id: reserva.id,
      quadra_nome: reserva.quadra_nome,
      data_reserva: reserva.data_reserva,
      hora_inicio: reserva.hora_inicio,
      hora_fim: reserva.hora_fim,
      valor_total: reserva.valor_total / 100,
      status: reserva.status,
      status_pagamento: reserva.status_pagamento,
      gateway_ref: pixDados.gatewayRef,
      copia_cola: pixDados.copiaCola,
      qr_code: pixDados.qrCode,
      expira_em: pixDados.expiresAt || null,
      manual_confirmation: Boolean(pixDados.manualConfirmation),
      expira_em_minutos: pixDados.manualConfirmation ? null : expiraEmMinutos,
      expira_em_segundos: pixDados.manualConfirmation ? null : restanteSegundos
    });
  } catch (err) {
    logger.error('[Public Controller Error] obterPixReservaPendente:', err);
    res.status(500).json({ error: 'Erro ao consultar dados do Pix da reserva.' });
  }
};

const cancelarReservaAtleta = async (req,res) => {
  try {
    const arena=await db.getAsync('SELECT id,nome,telefone,fuso_horario FROM Arenas WHERE slug=? AND status=1',[req.params.slug]);
    if(!arena) return res.status(404).json({error:'Arena não encontrada.'});
    const owns=row=>require('../services/clientAccessService').ownsReservation(req.user,row);
    const row=await db.getAsync('SELECT r.id,r.tenant_id,r.cliente_id,r.data_reserva,r.hora_inicio,r.hora_fim,r.valor_total,q.nome AS quadra_nome FROM Reservas r JOIN Quadras q ON q.id=r.quadra_id AND q.tenant_id=r.tenant_id WHERE r.id=? AND r.tenant_id=?',[req.params.id,arena.id]);
    if(!row||!await owns(row)) return res.status(404).json({error:'Reserva não encontrada.'});
    const zone = arena.fuso_horario || 'America/Sao_Paulo';
    const today = getTodayString(zone);
    if(row.data_reserva<today || (row.data_reserva===today&&row.hora_inicio<=getLocalTimeString(zone))) return res.status(400).json({error:'O horário já começou.'});
    await require('../services/bookingCancellationService').requestCancellation([row.id],{tenantId:arena.id,authorize:owns,reason:'Desistência do Cliente',reasonId:-1});
    await require('../services/gatewayService').estornarPagamentoPix(row.id,arena.id);
    const state=await db.getAsync('SELECT status,status_pagamento FROM Reservas WHERE id=?',[row.id]);
    const pending=state.status==='Cancelamento pendente';
    res.status(pending?202:200).json({success:true,status:state.status,refund_status:pending?'pending':'none',message:pending?'Cancelamento solicitado. Aguarde confirmação do pagamento ou devolução.':'Reserva cancelada.',arena:{nome:arena.nome,telefone:arena.telefone||''},reserva:{id:row.id,quadra_nome:row.quadra_nome,data_reserva:row.data_reserva,hora_inicio:row.hora_inicio,hora_fim:row.hora_fim,valor_total:row.valor_total/100}});
  }catch(error){res.status(error.status||500).json({error:require('../utils/security').publicError(error)});}
};

// Exclusão Definitiva de Conta de Atleta (LGPD) — Requer Autenticação Estrita JWT
const excluirContaAtleta = async(req,res)=>{
  try {
    const arena=await db.getAsync('SELECT id FROM Arenas WHERE slug=? AND status=1',[req.params.slug]);
    if(!arena) return res.status(404).json({error:'Arena não encontrada.'});
    const user=await db.getAsync('SELECT senha_hash FROM Usuarios WHERE id=?',[req.user.id]);
    if(typeof req.body.senha!=='string'||!await require('bcrypt').compare(req.body.senha,user.senha_hash)) return res.status(403).json({error:'Confirme sua senha.'});
    await db.transaction(async()=>{
    const members=await db.allAsync('SELECT cliente_id,tenant_id FROM ClientMemberships WHERE usuario_id=? AND verified=1',[req.user.id]);
    for(const m of members) await db.runAsync("UPDATE Clientes SET nome='Conta removida',email=NULL,telefone=NULL,cpf=NULL,avatar_url=NULL,ativo=0 WHERE id=? AND tenant_id=?",[m.cliente_id,m.tenant_id]);
    await db.runAsync("UPDATE Usuarios SET ativo=0,nome='Conta removida',email=? WHERE id=?",['deleted-'+req.user.id+'@invalid.local',req.user.id]);
    await require('../services/sessionService').revokeUser(req.user.id);
    });
    await require('../services/sessionService').logout(req,res);
    res.json({success:true,message:'Conta desativada. Histórico financeiro preservado.'});
  } catch(e){res.status(500).json({error:'Nao foi possivel excluir a conta.'});}
};

module.exports = {
  getTenantBySlug,
  getQuadrasBySlug,
  getDisponibilidadeBySlug,
  agendarReservaPublica,
  pagarReservaCartaoPublica,
  cadastrarAtletaPublico,
  loginAtletaPublico,
  googleAuthAtletaPublico,
  getPerfilAtleta,
  atualizarPerfilAtleta,
  getStatusReservaPublica,
  cancelarPendentePublico,
  getMinhasReservasAtleta,
  solicitarRecuperacaoSenhaAtleta,
  redefinirSenhaAtleta,
  obterPixReservaPendente,
  cancelarReservaAtleta,
  excluirContaAtleta
};




function getBookingItems({ itens, quadra_id, data_reserva, hora_inicio, hora_fim, esporte }) {
  if (Array.isArray(itens) && itens.length > 0) return itens;
  if (quadra_id && data_reserva && hora_inicio && hora_fim) return [{ quadra_id, data_reserva, hora_inicio, hora_fim, esporte }];
  return null;
}
