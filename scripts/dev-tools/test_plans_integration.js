require('dotenv').config();
const db = require('./src/config/database');
const saasBillingService = require('./src/services/saasBillingService');

async function runTest() {
  console.log('\n🧪 TESTANDO CONEXÃO DINÂMICA DOS PLANOS COM O BANCO');

  try {
    // 1. Verificar planos cadastrados
    const planos = await db.allAsync('SELECT * FROM PlanosSaaS');
    console.log('✅ Planos no Banco (PlanosSaaS):', planos.map(p => `${p.id}: ${p.nome} (R$ ${p.valor_mensal})`));

    // 2. Simular criação de arena com plano Pro (ID 2 ou nome 'pro')
    const proPlano = planos.find(p => p.nome.toLowerCase() === 'pro') || planos[0];
    
    const resArena = await db.runAsync(`
      INSERT INTO Arenas (nome, email, status, plano_id, trial_expira_em)
      VALUES ('Arena Teste Plano Dinamico', 'planodinamico@arena.com', 1, ?, '2026-08-30')
    `, [proPlano.id]);

    const arenaId = resArena.lastID;

    // 3. Buscar dados da arena criada
    const arenaCriada = await db.getAsync(`
      SELECT a.*, p.nome as plano_nome, p.valor_mensal, p.max_quadras
      FROM Arenas a
      JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [arenaId]);

    console.log('✅ Arena Criada com Sucesso:');
    console.log(`   - Nome: ${arenaCriada.nome}`);
    console.log(`   - Plano Vinculado: ${arenaCriada.plano_nome} (ID ${arenaCriada.plano_id})`);
    console.log(`   - Valor Mensalidade: R$ ${arenaCriada.valor_mensal}`);
    console.log(`   - Limite de Quadras: ${arenaCriada.max_quadras}`);

    // Limpeza
    await db.runAsync('DELETE FROM Arenas WHERE id = ?', [arenaId]);
    console.log('🎉 TESTE CONCLUÍDO COM 100% DE SUCESSO!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
  }
}

runTest();
