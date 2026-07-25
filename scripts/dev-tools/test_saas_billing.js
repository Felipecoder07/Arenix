require('dotenv').config();
const db = require('./src/config/database');
const saasBillingService = require('./src/services/saasBillingService');
const { processSaaS } = require('./src/jobs/cronSaaS');

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 SUÍTE DE TESTES DE INTEGRAÇÃO & REGRESSÃO — SAAS BILLING');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(` ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.log(` ❌ FAIL: ${testName} — ${details}`);
      failed++;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TESTE 1: Schema de Banco de Dados
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🔹 TESTE 1: Verificação de Schema do Banco de Dados');
    const colsFaturas = await db.allAsync('PRAGMA table_info(FaturasSaaS)');
    const colNames = colsFaturas.map(c => c.name);
    assert(colNames.includes('gateway_ref'), 'Coluna FaturasSaaS.gateway_ref existe');
    assert(colNames.includes('copia_cola'), 'Coluna FaturasSaaS.copia_cola existe');
    assert(colNames.includes('qr_expira_em'), 'Coluna FaturasSaaS.qr_expira_em existe');
    assert(colNames.includes('metodo_pagamento'), 'Coluna FaturasSaaS.metodo_pagamento existe');

    const colsArenas = await db.allAsync('PRAGMA table_info(Arenas)');
    const arenaColNames = colsArenas.map(c => c.name);
    assert(arenaColNames.includes('trial_expira_em'), 'Coluna Arenas.trial_expira_em existe');

    const mpSeed = await db.getAsync("SELECT * FROM ConfiguracoesSaaS WHERE chave = 'mp_master_access_token'");
    assert(mpSeed !== undefined, 'Chave mp_master_access_token cadastrada em ConfiguracoesSaaS');

    // ─────────────────────────────────────────────────────────────────────────
    // TESTE 2: Comportamento sem Token Master (Mensagem de Erro Informativa)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TESTE 2: Proteção de Geração de Pix sem Access Token do Master');
    
    // Garante token vazio para o teste
    await db.runAsync("UPDATE ConfiguracoesSaaS SET valor = '' WHERE chave = 'mp_master_access_token'");
    
    // Insere arena e fatura de teste
    const resArenaTest = await db.runAsync(`
      INSERT INTO Arenas (nome, email, status, dia_vencimento, plano_id)
      VALUES ('Arena Teste Billing', 'teste@arena.com', 1, 15, 1)
    `);
    const testTenantId = resArenaTest.lastID;

    const resFaturaTest = await db.runAsync(`
      INSERT INTO FaturasSaaS (tenant_id, plano_id, valor, data_vencimento, status)
      VALUES (?, 1, 49.99, '2026-08-15', 'Pendente')
    `, [testTenantId]);
    const testFaturaId = resFaturaTest.lastID;

    try {
      await saasBillingService.gerarPixFaturaSaaS(testFaturaId);
      assert(false, 'Geração de Pix sem Token Master', 'Deveria ter lançado um erro.');
    } catch (err) {
      assert(
        err.message.includes('Master ainda não configurou'),
        'Mensagem clara orientando o Master a configurar o Access Token',
        `Mensagem recebida: "${err.message}"`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TESTE 3: Liquidação da Fatura + Auto-Desbloqueio da Arena
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TESTE 3: Liquidação de Fatura + Auto-Desbloqueio de Arena Inadimplente');

    // Bloqueia a arena de teste
    await db.runAsync('UPDATE Arenas SET status = 0 WHERE id = ?', [testTenantId]);
    const arenaAntes = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [testTenantId]);
    assert(arenaAntes.status === 0, 'Arena inicialmente BLOQUEADA (status = 0)');

    // Associa um gateway_ref fictício à fatura
    const mockRef = 'test_ref_' + Date.now();
    await db.runAsync('UPDATE FaturasSaaS SET gateway_ref = ? WHERE id = ?', [mockRef, testFaturaId]);

    // Executa a liquidação
    const resultLiquida = await saasBillingService.liquidarFaturaSaaS(mockRef);
    assert(resultLiquida.sucesso === true, 'Liquidação executada com sucesso');
    assert(resultLiquida.arena_desbloqueada === true, 'Flag arena_desbloqueada indica true');

    const faturaDepois = await db.getAsync('SELECT status, data_pagamento FROM FaturasSaaS WHERE id = ?', [testFaturaId]);
    assert(faturaDepois.status === 'Paga', 'Status da fatura alterado para Paga');
    assert(faturaDepois.data_pagamento !== null, 'Data de pagamento registrada na fatura');

    const arenaDepois = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [testTenantId]);
    assert(arenaDepois.status === 1, 'Arena REATIVADA automaticamente (status = 1)!');

    // ─────────────────────────────────────────────────────────────────────────
    // TESTE 4: Idempotência de Liquidação (Webhook repetido)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TESTE 4: Idempotência da Liquidação (Múltiplos disparos de Webhook)');

    const resultLiquidaRepetida = await saasBillingService.liquidarFaturaSaaS(mockRef);
    assert(resultLiquidaRepetida.sucesso === true, 'Retorno 200 OK sem erro no webhook repetido');
    assert(resultLiquidaRepetida.mensagem.includes('já estava paga'), 'Identificou que fatura já foi liquidada previamente');

    // ─────────────────────────────────────────────────────────────────────────
    // TESTE 5: Período de Trial (Não faturar arenas em trial ativo)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TESTE 5: Proteção de Período Trial no Cron');

    const hojeInt = new Date().getDate();
    const trialAmanha = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Arena em trial ativo
    const resTrial = await db.runAsync(`
      INSERT INTO Arenas (nome, email, status, dia_vencimento, plano_id, trial_expira_em)
      VALUES ('Arena Trial Ativo', 'trial@arena.com', 1, ?, 1, ?)
    `, [hojeInt, trialAmanha]);
    const trialTenantId = resTrial.lastID;

    // Roda o cron
    await processSaaS();

    // Verifica se a arena em trial recebeu fatura
    const faturaTrial = await db.getAsync('SELECT id FROM FaturasSaaS WHERE tenant_id = ?', [trialTenantId]);
    assert(faturaTrial === undefined, 'Arena em trial ativo NÃO recebeu fatura indevidamente');

    // Limpeza de dados de teste
    await db.runAsync('DELETE FROM FaturasSaaS WHERE tenant_id IN (?, ?)', [testTenantId, trialTenantId]);
    await db.runAsync('DELETE FROM Arenas WHERE id IN (?, ?)', [testTenantId, trialTenantId]);

    console.log('\n=============================================================');
    console.log(`📊 RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
    console.log('=============================================================\n');

    if (failed === 0) {
      console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
    }

  } catch (err) {
    console.error('❌ ERRO NA SUÍTE DE TESTES:', err);
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
