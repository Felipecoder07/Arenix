const cron = require('node-cron');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

const processSaaS = async () => {
  console.log('[SaaS CRON] Iniciando processamento financeiro diário...');
  
  try {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    // 1. Gerar Novas Faturas
    const arenasParaFaturar = await db.allAsync(`
      SELECT a.id as tenant_id, a.plano_id, p.valor_mensal 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.status = 1 AND a.dia_vencimento = ?
    `, [currentDay]);

    for (let arena of arenasParaFaturar) {
      const existeFatura = await db.getAsync(`
        SELECT id FROM FaturasSaaS 
        WHERE tenant_id = ? AND strftime('%Y-%m', data_vencimento) = ?
      `, [arena.tenant_id, `${currentYear}-${String(currentMonth).padStart(2, '0')}`]);

      if (!existeFatura) {
        await db.runAsync(`
          INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, data_vencimento, status)
          VALUES (?, ?, ?, ?, 'Pendente')
        `, [arena.tenant_id, arena.plano_id, arena.valor_mensal, todayStr]);
        console.log(`[SaaS CRON] Fatura gerada para Arena ID: ${arena.tenant_id}`);
      }
    }

    // 2. Verificar Inadimplência e Bloquear
    const configTolerancia = await db.getAsync(`SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'dias_tolerancia_bloqueio'`);
    const tolerancia = configTolerancia ? parseInt(configTolerancia.valor) : 5;

    const faturasAtrasadas = await db.allAsync(`
      SELECT f.id, f.tenant_id, f.data_vencimento 
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.status = 'Pendente' AND a.status = 1
      AND (julianday(?) - julianday(f.data_vencimento)) > ?
    `, [todayStr, tolerancia]);

    for (let fatura of faturasAtrasadas) {
      await db.runAsync(`UPDATE FaturasSaaS SET status = 'Atrasada' WHERE id = ?`, [fatura.id]);
      await db.runAsync(`UPDATE Arenas SET status = 0 WHERE id = ?`, [fatura.tenant_id]);
      logAuditEvent(null, 'SaaS: Bloqueio Automático', `Inadimplência na fatura #${fatura.id}. Arena ID: ${fatura.tenant_id}`, 'CRON JOB');
      console.log(`[SaaS CRON] Arena ID: ${fatura.tenant_id} bloqueada por inadimplência.`);
    }

    console.log('[SaaS CRON] Processamento finalizado com sucesso.');
  } catch (err) {
    console.error('[SaaS CRON] Erro ao processar billing:', err);
  }
};

const startSaaSCron = () => {
  cron.schedule('0 0 * * *', () => {
    processSaaS();
  });
  console.log('Serviço de CRON Financeiro (SaaS) inicializado.');
};

module.exports = { startSaaSCron, processSaaS };
