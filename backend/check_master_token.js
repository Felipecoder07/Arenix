require('dotenv').config();
const db = require('./src/config/database');

async function checkToken() {
  try {
    const row = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'mp_master_access_token'");
    console.log('\n=== Token no SQLite (ConfiguracoesSaaS) ===');
    console.log(row);
    console.log('=== Token no process.env.MERCADO_PAGO_ACCESS_TOKEN ===');
    console.log(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkToken();
