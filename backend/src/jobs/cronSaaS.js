const logger = require('../utils/safeLogger').forModule('cronSaaS');
const cron = require('node-cron');
const db = require('../config/database');
const dates = require('../utils/dateUtils');
const { alinharVencimento, congelarPeriodos, dataCadastro } = require('../services/saasCalendarService');
const { enviarAvisosVencimento } = require('../services/saasBillingService');
const { executarBloqueioInadimplencia } = require('./bloqueioInadimplencia');
const { executarLimpezaFantasmas } = require('./limpezaFantasmas');
const { processarOutbox } = require('./reconciliacaoOutbox');

// A transaction protects catch-up against simultaneous cron/manual executions.
async function gerarFaturasVencidas(hoje = dates.getTodayString()) {
  return db.transaction(async () => {
    const arenas = await db.allAsync(`SELECT a.*, p.nome AS plano_nome, p.valor_mensal, p.valor_anual
      FROM Arenas a JOIN PlanosSaaS p ON p.id = a.plano_id
      WHERE a.status = 1 AND (a.trial_expira_em IS NULL OR a.trial_expira_em <= ?)`, [hoje]);
    let geradas = 0;
    for (const arena of arenas) {
      const faturas = (await congelarPeriodos(arena)).filter(f => ['Paga', 'Pendente', 'Atrasada'].includes(f.status));
      // Start with the earliest known invoice, not the most recent one: advance
      // payments must not hide gaps. For a new subscription use its actual start.
      let vencimento = faturas[0]?.data_vencimento || arena.trial_expira_em || dataCadastro(arena.criado_em);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw new Error('Data inicial de assinatura inválida.');
      let dia = arena.dia_vencimento || Number(vencimento.slice(8, 10));
      if (!faturas.length) {
        // A full first cycle starts when the trial ends (also repairs legacy
        // trial arenas that still have the old hard-coded day 10).
        dia = Number(vencimento.slice(8, 10));
        await db.runAsync('UPDATE Arenas SET dia_vencimento = ? WHERE id = ?', [dia, arena.id]);
      }
      while (vencimento <= hoje) {
        const cobradas = faturas.filter(f => f.data_vencimento <= vencimento && f.periodo_fim > vencimento);
        if (cobradas.length) {
          vencimento = alinharVencimento(cobradas.reduce((end, f) => f.periodo_fim > end ? f.periodo_fim : end, vencimento), dia);
          continue;
        }
        const ciclo = arena.ciclo_cobranca || 'mensal';
        let fim = dates.calcularProximaDataVencimento(vencimento, dia, ciclo);
        // A previously billed future interval must never be billed twice.
        const futura = faturas.find(f => f.data_vencimento > vencimento && f.data_vencimento < fim);
        let valor = ciclo === 'anual'
          ? arena.valor_anual * 12
          : arena.valor_mensal;
        if (!Number.isSafeInteger(valor) || valor <= 0) {
          logger.error('Preço indisponível para geração de fatura SaaS', { arena_id: arena.id, ciclo });
          break;
        }
        if (futura) {
          const dias = (Date.parse(futura.data_vencimento) - Date.parse(vencimento)) / 86400000;
          const diasCiclo = (Date.parse(fim) - Date.parse(vencimento)) / 86400000;
          valor = Math.round(valor * dias / diasCiclo);
          fim = futura.data_vencimento;
        }
        const descricao = `Assinatura Plano ${arena.plano_nome} - ${dates.formatarCompetencia(vencimento, ciclo)}${futura ? ' (proporcional)' : ''}`;
        await db.runAsync(`INSERT INTO FaturasSaaS
          (tenant_id, plano_id, valor, ciclo, descricao, data_vencimento, periodo_fim, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendente')`, [arena.id, arena.plano_id, valor, ciclo, descricao, vencimento, fim]);
        geradas++;
        vencimento = alinharVencimento(fim, dia);
      }
    }
    return { geradas };
  });
}

const processSaaS = async () => {
  try {
    await gerarFaturasVencidas();
    await enviarAvisosVencimento();
    await executarBloqueioInadimplencia();
    await executarLimpezaFantasmas();
    await processarOutbox();
    logger.log('[SaaS CRON] Processamento financeiro finalizado.');
  } catch (err) {
    logger.error('[SaaS CRON] Falha ao processar billing:', err);
  }
};

const startSaaSCron = () => {
  cron.schedule('* * * * *', () => {
    require('../services/comunicadoService').processar().catch(error => logger.error('[Comunicados CRON]', error));
  });
  cron.schedule('0 0 * * *', processSaaS, { timezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo' });
  cron.schedule('*/5 * * * *', () => {
    processarOutbox().catch(error => logger.error('[Reconciliação CRON Error]', error));
  });
  logger.log('Serviço de CRON Financeiro (SaaS) inicializado.');
};
module.exports = { startSaaSCron, processSaaS, gerarFaturasVencidas };
