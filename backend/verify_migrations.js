require('dotenv').config();
const initDb = require('./src/config/init_db');
initDb();
const db = require('./src/config/database');

setTimeout(async () => {
  try {
    // 1. Verificar colunas de FaturasSaaS
    const cols = await db.allAsync('PRAGMA table_info(FaturasSaaS)');
    console.log('\n=== FaturasSaaS colunas ===');
    cols.forEach(c => console.log(`  ${c.name} [${c.type}]`));

    const required = ['gateway_ref', 'copia_cola', 'qr_expira_em', 'metodo_pagamento'];
    const missing = required.filter(r => !cols.find(c => c.name === r));
    if (missing.length === 0) {
      console.log('  ✅ Todas as colunas novas presentes.');
    } else {
      console.log('  ❌ Faltando:', missing.join(', '));
    }

    // 2. Verificar coluna trial_expira_em em Arenas
    const arenasCols = await db.allAsync('PRAGMA table_info(Arenas)');
    const trialCol = arenasCols.find(c => c.name === 'trial_expira_em');
    console.log('\n=== Arenas — trial_expira_em ===');
    console.log(trialCol ? '  ✅ Coluna presente.' : '  ❌ Coluna AUSENTE.');

    // 3. Verificar seed mp_master_access_token em ConfiguracoesSaaS
    const mpToken = await db.getAsync("SELECT chave, valor FROM ConfiguracoesSaaS WHERE chave = 'mp_master_access_token'");
    console.log('\n=== ConfiguracoesSaaS — mp_master_access_token ===');
    console.log(mpToken ? `  ✅ Seed presente. valor='${mpToken.valor}'` : '  ❌ Seed AUSENTE.');

    console.log('\n✅ Verificação concluída.\n');
  } catch (e) {
    console.error('ERRO:', e.message);
  } finally {
    process.exit(0);
  }
}, 1500);
