require('dotenv').config();
const db = require('../src/config/database');

async function main() {
  try {
    require('../src/config/init_db')();
    await require('../src/config/securitySchema').ensureSecuritySchema(db);
    const result = await require('../src/services/bootstrapMasterService').bootstrapMaster(db);
    console.log('Inicializacao Master:', result);
  } catch (error) {
    console.error('Falha na inicializacao Master:', error.message);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
}

main().catch(() => { console.error('Falha ao encerrar a inicializacao Master.'); process.exitCode = 1; });
