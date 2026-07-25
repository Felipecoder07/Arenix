const db = require('./src/config/database');

async function simularTrialExpirado() {
  try {
    const arenaId = 8; // 'arena teste'
    
    // 1. Expirar o trial da arena (definir data no passado) e bloquear
    await db.runAsync(`
      UPDATE Arenas 
      SET trial_expira_em = '2026-07-22', status = 0 
      WHERE id = ?
    `, [arenaId]);

    // 2. Remover faturas de teste não pagas anteriores
    await db.runAsync("DELETE FROM FaturasSaaS WHERE tenant_id = ? AND status != 'Paga'", [arenaId]);

    // 3. Gerar fatura pendente para a arena
    const hoje = new Date().toISOString().split('T')[0];
    const resFat = await db.runAsync(`
      INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, data_vencimento, status)
      VALUES (?, 1, 49.99, ?, 'Pendente')
    `, [arenaId, hoje]);

    console.log('\n=============================================================');
    console.log('✅ SIMULAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('=============================================================');
    console.log(`🏟️  Arena: 'arena teste' (ID: ${arenaId})`);
    console.log(`📅 Trial Expirado Em: 2026-07-22 (Vencido)`);
    console.log(`🔒 Status da Arena: 0 (Bloqueada por Inadimplência)`);
    console.log(`💳 Fatura Gerada (ID: ${resFat.lastID}): R$ 49,99 — Status: Pendente`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Erro na simulação:', err);
  } finally {
    process.exit(0);
  }
}

simularTrialExpirado();
