const cron = require('node-cron');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
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

    // 1. Gerar Novas Faturas (Ignora arenas em período de TRIAL ativo)
    const arenasParaFaturar = await db.allAsync(`
      SELECT a.id as tenant_id, a.plano_id, p.valor_mensal 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.status = 1 
        AND a.dia_vencimento = ?
        AND (a.trial_expira_em IS NULL OR date(a.trial_expira_em) <= date(?))
    `, [currentDay, todayStr]);

    for (let arena of arenasParaFaturar) {
      // Verifica se já existe fatura gerada para este mês OU se a arena já pagou adiantado cobrindo o período
      const mesAtualStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const existeFatura = await db.getAsync(`
        SELECT id, status FROM FaturasSaaS 
        WHERE tenant_id = ? AND (
          strftime('%Y-%m', data_vencimento) = ?
          OR (status = 'Paga' AND strftime('%Y-%m', data_vencimento) >= ?)
        )
      `, [arena.tenant_id, mesAtualStr, mesAtualStr]);

      if (!existeFatura) {
        await db.runAsync(`
          INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, data_vencimento, status)
          VALUES (?, ?, ?, ?, 'Pendente')
        `, [arena.tenant_id, arena.plano_id, arena.valor_mensal, todayStr]);
        console.log(`[SaaS CRON] Fatura de R$${arena.valor_mensal} gerada para Arena ID: ${arena.tenant_id}`);
      }
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
