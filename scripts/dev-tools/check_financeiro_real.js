const db = require('./src/config/database');

async function checkFinanceiro() {
  try {
    const mrrQuery = await db.getAsync(`
      SELECT SUM(p.valor_mensal) as total_mrr 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id 
      WHERE a.status = 1 AND (a.trial_expira_em IS NULL OR date(a.trial_expira_em) <= date('now'))
    `);

    const faturamentoReal = await db.getAsync(`
      SELECT SUM(valor) as total_pago 
      FROM FaturasSaaS 
      WHERE status = 'Paga'
    `);

    const faturasPagas = await db.allAsync(`
      SELECT f.id, f.tenant_id, a.nome as arena, f.valor, f.data_pagamento, f.status 
      FROM FaturasSaaS f 
      JOIN Arenas a ON f.tenant_id = a.id 
      WHERE f.status = 'Paga'
    `);

    console.log('\n=============================================================');
    console.log('=== FATURAS REALMENTE PAGAS NO SISTEMA (ENTROU NO CAIXA) ===');
    console.log('=============================================================');
    console.table(faturasPagas);
    console.log('💰 Total Faturado Efetivamente no Caixa: R$', faturamentoReal.total_pago || 0);
    console.log('📈 MRR Recorrente Contratado dos Planos: R$', mrrQuery.total_mrr || 0);
    console.log('=============================================================\n');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkFinanceiro();
