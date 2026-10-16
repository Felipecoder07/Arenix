// Copies code only. Never copies an existing database, uploads or production secrets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const { resolveInstance, prepareSnapshot } = require('./homologacao_instance.cjs');
const target = resolveInstance();
if (fs.existsSync(target)) throw new Error('Instance already exists; preserved without overwriting.');
const test = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env.homologacao')));
require('./homologacao_credentials.cjs').validateTestCredentials(test);
const current = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env')));
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65525) throw new Error('Invalid port.');
prepareSnapshot(target);
const random = () => crypto.randomBytes(32).toString('hex');
const config = {
  NODE_ENV: 'development', PORT: String(port), LISTEN_HOST: '127.0.0.1', RELAY_PORT: String(port + 10),
  FRONTEND_URL: 'http://localhost:5183',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5183,http://localhost:5186,http://127.0.0.1:3100',
  JWT_SECRET: random(), SECRETS_KEYRING: JSON.stringify({ homologacao: random() }),
  SECRETS_ACTIVE_KEY_ID: 'homologacao',
  GOOGLE_CLIENT_ID: current.GOOGLE_CLIENT_ID || '',
  MERCADO_PAGO_PUBLIC_KEY: test.MERCADO_PAGO_PUBLIC_KEY,
  MERCADO_PAGO_ACCESS_TOKEN: test.MERCADO_PAGO_ACCESS_TOKEN,
  MERCADO_PAGO_MASTER_ACCESS_TOKEN: test.MERCADO_PAGO_MASTER_ACCESS_TOKEN || '',
  MERCADO_PAGO_TEST_SELLER_ID: test.MERCADO_PAGO_TEST_SELLER_ID || '',
  MERCADO_PAGO_TEST_MASTER_ID: test.MERCADO_PAGO_TEST_MASTER_ID || '',
  MERCADO_PAGO_CLIENT_ID: test.MERCADO_PAGO_CLIENT_ID || '',
  HOMOLOGACAO_OAUTH_SECRET: test.MERCADO_PAGO_CLIENT_SECRET || '',
  MERCADO_PAGO_REDIRECT_URI: test.MERCADO_PAGO_REDIRECT_URI || '',
  OAUTH_TEST_ACCOUNT_IDS: test.OAUTH_TEST_ACCOUNT_IDS || '',
  MERCADO_PAGO_TEST_BUYER_EMAIL: test.MERCADO_PAGO_TEST_BUYER_EMAIL || '',
  APP_TIMEZONE: 'America/Sao_Paulo',
};
fs.writeFileSync(path.join(target, 'config.json'), JSON.stringify(config, null, 2));
fs.writeFileSync(path.join(target, 'login.json'), JSON.stringify({ email: 'admin@homologacao.example.test', password: random() }, null, 2));
console.log('Isolated source snapshot prepared. Fresh database will be initialized by run_homologacao.js.');
console.log('Only explicit test configuration was copied. SMTP and cron are disabled.');
