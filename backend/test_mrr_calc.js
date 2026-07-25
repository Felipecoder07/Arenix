const db = require('./src/config/database');

async function testMrr() {
  try {
    const mrrTotal = await db.getAsync(`
      SELECT SUM(p.valor_mensal) as total 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id 
      WHERE a.status = 1
    `);

    const mrrSemTrial = await db.getAsync(`
      SELECT SUM(p.valor_mensal) as total 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id 
      WHERE a.status = 1 AND (a.trial_expira_em IS NULL OR date(a.trial_expira_em) <= date('now'))
    `);

    const arenas = await db.allAsync(`
      SELECT a.id, a.nome, a.status, a.trial_expira_em, p.nome as plano, p.valor_mensal 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id
    `);

    console.log('\n=== Arenas e Seus Planos ===');
    console.table(arenas);
    console.log('📌 MRR Atual (Todas Ativas):', `R$ ${mrrTotal.total || 0}`);
    console.log('📌 MRR Real (Excluindo Arenas em Trial Grátis):', `R$ ${mrrSemTrial.total || 0}\n`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

testMrr();
