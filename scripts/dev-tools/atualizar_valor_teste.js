const db = require('./src/config/database');

async function atualizarFatura() {
  try {
    // 1. Atualizar o valor mensal do Plano Basic (ID 1) para R$ 0,50
    await db.runAsync("UPDATE PlanosSaaS SET valor_mensal = 0.50, valor_anual = 0.40 WHERE id = 1");

    // 2. Atualizar o valor da fatura pendente da 'arena teste' (tenant_id = 8) para R$ 0,50
    await db.runAsync("UPDATE FaturasSaaS SET valor = 0.50 WHERE tenant_id = 8 AND status = 'Pendente'");

    const fatura = await db.getAsync("SELECT f.*, p.nome as plano_nome, p.valor_mensal as plano_valor FROM FaturasSaaS f JOIN PlanosSaaS p ON f.plano_id = p.id WHERE f.tenant_id = 8 AND f.status = 'Pendente'");
    console.log('\n=============================================================');
    console.log('✅ FATURA DA ARENA TESTE ATUALIZADA COM SUCESSO!');
    console.log('=============================================================');
    console.log('Fatura ID:', fatura.id);
    console.log('Plano:', fatura.plano_nome);
    console.log('Novo Valor da Fatura:', `R$ ${fatura.valor}`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error('Erro ao atualizar fatura:', err);
  } finally {
    process.exit(0);
  }
}

atualizarFatura();
