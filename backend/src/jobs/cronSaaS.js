const cron = require('node-cron');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { formatarCompetencia, calcularProximaDataVencimento } = require('../utils/dateUtils');
const { enviarAvisosVencimento } = require('../services/saasBillingService');
const { executarBloqueioInadimplencia } = require('./bloqueioInadimplencia');

const processSaaS = async () => {
  console.log('[SaaS CRON] Iniciando processamento financeiro diário...');
  
  try {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 1. Gerar Novas Faturas
    // A) Arenas cujo vencimento recorrente é hoje (ou último dia do mês para dias 29/30/31)
    const queryVencimento = (currentDay === lastDayOfMonth)
      ? '(a.dia_vencimento = ? OR a.dia_vencimento > ?)'
      : 'a.dia_vencimento = ?';
    const paramsVencimento = (currentDay === lastDayOfMonth)
      ? [currentDay, currentDay, todayStr]
      : [currentDay, todayStr];

    const arenasRecorrentes = await db.allAsync(`
      SELECT a.id as tenant_id, a.nome as arena_nome, a.plano_id, a.ciclo_cobranca, a.dia_vencimento,
             p.nome as plano_nome, p.valor_mensal, p.valor_anual 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.status = 1 
        AND ${queryVencimento}
        AND (a.trial_expira_em IS NULL OR date(a.trial_expira_em) <= date(?))
    `, paramsVencimento);

    // B) Arenas cujo trial expirou hoje ou recentemente e que ainda não possuem NENHUMA fatura gerada
    const arenasTrialExpiradas = await db.allAsync(`
      SELECT a.id as tenant_id, a.nome as arena_nome, a.plano_id, a.ciclo_cobranca, a.dia_vencimento,
             p.nome as plano_nome, p.valor_mensal, p.valor_anual
      FROM Arenas a
      JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.status = 1
        AND a.trial_expira_em IS NOT NULL
        AND date(a.trial_expira_em) <= date(?)
        AND NOT EXISTS (SELECT 1 FROM FaturasSaaS f WHERE f.tenant_id = a.id)
    `, [todayStr]);

    // Combinar listas sem duplicidade por tenant_id
    const arenasParaFaturarMap = new Map();
    [...arenasRecorrentes, ...arenasTrialExpiradas].forEach(a => arenasParaFaturarMap.set(a.tenant_id, a));
    const arenasParaFaturar = Array.from(arenasParaFaturarMap.values());

    for (let arena of arenasParaFaturar) {
      const mesAtualStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // A. Verifica se já existe fatura gerada para este mês (pendente ou em processamento)
      const faturaMesAtual = await db.getAsync(`
        SELECT id FROM FaturasSaaS 
        WHERE tenant_id = ? AND strftime('%Y-%m', data_vencimento) = ?
      `, [arena.tenant_id, mesAtualStr]);

      if (faturaMesAtual) {
        continue;
      }

      // B. Verifica se a última fatura paga cobre o período atual (ex: plano anual ou adiantamento)
      const ultimaPaga = await db.getAsync(`
        SELECT data_vencimento, ciclo FROM FaturasSaaS
        WHERE tenant_id = ? AND status = 'Paga'
        ORDER BY data_vencimento DESC, id DESC
        LIMIT 1
      `, [arena.tenant_id]);

      if (ultimaPaga) {
        const diaVenc = arena.dia_vencimento || currentDay;
        const coberturaAte = calcularProximaDataVencimento(
          ultimaPaga.data_vencimento,
          diaVenc,
          ultimaPaga.ciclo || arena.ciclo_cobranca || 'mensal'
        );
        // Se a data coberta é superior à data de hoje, o plano ainda está pago
        if (coberturaAte > todayStr) {
          continue;
        }
      }

      const ciclo = arena.ciclo_cobranca || 'mensal';
      let valorFinal = arena.valor_mensal;

      if (ciclo === 'anual') {
        const precoMensalAnual = (arena.valor_anual && arena.valor_anual > 0)
          ? arena.valor_anual
          : (arena.valor_mensal * 0.8);
        valorFinal = parseFloat((precoMensalAnual * 12).toFixed(2));
      }

      const competenciaNome = formatarCompetencia(todayStr, ciclo);
      const descricao = `Assinatura Plano ${arena.plano_nome || 'SaaS'} - ${competenciaNome}`;

      await db.runAsync(`
        INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, ciclo, descricao, data_vencimento, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Pendente')
      `, [arena.tenant_id, arena.plano_id, valorFinal, ciclo, descricao, todayStr]);
      console.log(`[SaaS CRON] Fatura de R$${valorFinal} (${ciclo}) gerada para Arena ID: ${arena.tenant_id} (${descricao})`);
    }

    // 2. Enviar Avisos de Vencimento Próximo (faturas vencendo nos próximos 3 dias)
    await enviarAvisosVencimento();

    // 3. Executar Job de Bloqueio por Inadimplência (RN-13)
    await executarBloqueioInadimplencia();

    // 4. Executar Job de Limpeza de Cadastros Fantasma (abandonos sem nenhum pagamento)
    const { executarLimpezaFantasmas } = require('./limpezaFantasmas');
    await executarLimpezaFantasmas();

    console.log('[SaaS CRON] Processamento financeiro finalizado com sucesso.');
  } catch (err) {
    console.error('[SaaS CRON Error] Falha ao processar billing:', err);
  }
};

const startSaaSCron = () => {
  cron.schedule('0 0 * * *', () => {
    processSaaS();
  });
  console.log('Serviço de CRON Financeiro (SaaS) inicializado.');
};

module.exports = { startSaaSCron, processSaaS };
