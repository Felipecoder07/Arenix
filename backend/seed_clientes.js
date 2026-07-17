const db = require('./src/config/database');
async function seed() {
  await db.runAsync("INSERT INTO Clientes (tenant_id, nome, telefone) VALUES (1, 'João Silva', '11999999999')");
  await db.runAsync("INSERT INTO Clientes (tenant_id, nome, telefone) VALUES (1, 'Maria Souza', '11888888888')");
  console.log('Clientes inseridos com sucesso');
}
seed();
