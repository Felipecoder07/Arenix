// Isolated development harness: no cron, no SMTP credentials, no production DB.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { resolveInstance, verifySnapshot } = require('./homologacao_instance.cjs');
const target = resolveInstance();
const manifest = verifySnapshot(target);
const config = JSON.parse(fs.readFileSync(path.join(target, 'config.json')));
assert.equal(config.NODE_ENV, 'development');
require('./homologacao_credentials.cjs').validateTestCredentials(config);
// Avoid inherited secrets, dotenv from the workspace, and proxy configuration.
for (const name of Object.keys(process.env)) {
  if (!/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(name)) delete process.env[name];
}
Object.assign(process.env, config, { NODE_PATH: path.join(root, 'backend/node_modules') });
require('node:module').Module._initPaths();
process.chdir(path.join(target, 'backend'));
assert.equal(fs.existsSync('.env'), false, 'Unexpected dotenv in isolated instance');
global.fetch = require('./homologacao_network.cjs').installNetworkGuard(config, target, manifest.digest);
const db = require(path.join(target, 'backend/src/config/database'));
async function initialize() {
  const databases = await db.allAsync('PRAGMA database_list');
  assert.equal(path.resolve(databases.find(row => row.name === 'main').file), path.join(target, 'backend/data/courtmanager.sqlite'));
  await new Promise((resolve, reject) => {
    let pending = 0, scheduling = true, firstError;
    const originals = {};
    const finished = () => {
      if (scheduling || pending) return;
      Object.assign(db, originals);
      firstError ? reject(firstError) : resolve();
    };
    for (const method of ['run', 'get', 'all', 'exec']) {
      originals[method] = db[method];
      db[method] = function (...args) {
        const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
        pending++;
        return originals[method].call(this, ...args, function (error, ...values) {
          if (error && !/duplicate column name/i.test(error.message)) firstError ||= error;
          try { callback?.call(this, error, ...values); }
          catch (failure) { firstError ||= failure; }
          finally { pending--; finished(); }
        });
      };
    }
    try { require(path.join(target, 'backend/src/config/init_db'))(); } catch (error) { firstError = error; }
    scheduling = false;
    finished();
  });
  await require(path.join(target, 'backend/src/config/securitySchema')).ensureSecuritySchema(db);
  if (!(await db.getAsync('SELECT COUNT(*) AS count FROM Arenas')).count) {
    const login = JSON.parse(fs.readFileSync(path.join(target, 'login.json')));
    const password = await require('bcrypt').hash(login.password, 12);
    await db.runAsync('BEGIN');
    try {
      for (const id of [1, 2]) {
        await db.runAsync('INSERT INTO Arenas(id,nome,slug,status,notif_reserva_email,notif_cancelamento_email,notif_pagamento_email) VALUES(?,?,?,1,0,0,0)', [id, 'Homologacao ' + id, 'homologacao-' + id]);
        await db.runAsync("INSERT INTO Quadras(id,tenant_id,nome,preco_base,status) VALUES(?,?,?,10000,'Ativa')", [id, id, 'Quadra teste ' + id]);
      }
      await db.runAsync("INSERT INTO Usuarios(tenant_id,nome,email,senha_hash,perfil,ativo) VALUES(1,'Administrador homologacao',?,?,'Administrador',1)", [login.email, password]);
      const buyerEmail = config.MERCADO_PAGO_TEST_BUYER_EMAIL
        ? require('./homologacao_instance.cjs').testBuyerEmail(config)
        : 'comprador@example.com';
      await db.runAsync("INSERT INTO Clientes(id,tenant_id,nome,email) VALUES(1,1,'Comprador Homologacao',?)", [buyerEmail]);
      await db.runAsync("INSERT INTO Reservas(id,tenant_id,cliente_id,quadra_id,data_reserva,hora_inicio,hora_fim,valor_total,status,status_pagamento,grupo_id) VALUES(1,1,1,1,'2099-12-01','10:00','11:00',10000,'Pendente','Pendente','homologacao-1')");
      await db.runAsync('COMMIT');
    } catch (error) { await db.runAsync('ROLLBACK'); throw error; }
  }
  assert.deepEqual(await db.allAsync('PRAGMA foreign_key_check'), []);
  const { encrypt } = require(path.join(target, 'backend/src/utils/security'));
  for (const [key, value] of [['mp_client_secret', config.HOMOLOGACAO_OAUTH_SECRET], ['mp_master_access_token', config.MERCADO_PAGO_MASTER_ACCESS_TOKEN]]) {
    if (value) await db.runAsync('INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES(?,?)', [key, encrypt(value)]);
  }
  if (process.argv.includes('--initialize-only')) {
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    console.log('Isolated SQLite initialized; foreign keys OK. No application jobs started.');
    return;
  }
  const app = require(path.join(target, 'backend/src/app'));
  const server = app.listen(Number(config.PORT), '127.0.0.1', () => console.log('Homologation API: http://127.0.0.1:' + config.PORT));
  server.on('error', () => { console.error('Homologation port unavailable.'); process.exit(1); });
}
initialize().catch(error => { console.error('Isolated initialization failed:', error.code || error.name); process.exit(1); });
