// Isolated rehearsal: source is opened read-only; only the copied database migrates.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sqlite = require(path.join(root, 'backend/node_modules/sqlite3'));
const migrate = require(path.join(root, 'backend/src/config/migrations/pixDiagnostics')).migratePixDiagnostics;
const open = (file, mode) => new Promise((resolve, reject) => {
  const db = new sqlite.Database(file, mode, error => error ? reject(error) : resolve(db));
});
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
async function main() {
  const at = new Date().toISOString();
  const folder = path.join(root, '.local-security', 'pix-migration-' + at.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder, { recursive: true });
  const source = path.join(root, 'backend/data/courtmanager.sqlite');
  const digest = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  const before = digest();
  const db = await open(source, sqlite.OPEN_READONLY);
  try {
    await new Promise((resolve, reject) => {
      const backup = db.backup(path.join(folder, 'backup.sqlite'), error => {
        if (error) return reject(error);
        backup.step(-1, stepError => backup.finish(finishError => stepError || finishError ? reject(stepError || finishError) : resolve()));
      });
    });
  } finally { await close(db); }
  const target = path.join(folder, 'rehearsal.sqlite');
  fs.copyFileSync(path.join(folder, 'backup.sqlite'), target, fs.constants.COPYFILE_EXCL);
  const copy = await open(target, sqlite.OPEN_READWRITE);
  copy.allAsync = sql => new Promise((resolve, reject) => copy.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  copy.getAsync = sql => new Promise((resolve, reject) => copy.get(sql, (error, row) => error ? reject(error) : resolve(row)));
  copy.runAsync = sql => new Promise((resolve, reject) => copy.run(sql, error => error ? reject(error) : resolve()));
  const financial = async () => JSON.stringify([
    await copy.allAsync('SELECT id,state,gateway_ref,response_json FROM PaymentIntents ORDER BY id'),
    await copy.allAsync('SELECT id,status,valor,gateway_ref FROM FaturasSaaS ORDER BY id'),
    await copy.allAsync('SELECT * FROM Pagamentos ORDER BY id'),
  ]);
  let report;
  try {
    await copy.runAsync('PRAGMA foreign_keys=ON');
    const original = await financial();
    await copy.runAsync('BEGIN');
    try { await migrate(copy); await migrate(copy); await copy.runAsync('COMMIT'); }
    catch (error) { await copy.runAsync('ROLLBACK'); throw error; }
    report = { at, migrationsRun: 2, financialRowsUnchanged: original === await financial(),
      integrity: (await copy.getAsync('PRAGMA integrity_check')).integrity_check,
      foreignKeyErrors: (await copy.allAsync('PRAGMA foreign_key_check')).length,
      legacyInvoicesPreserved: (await copy.getAsync('SELECT COUNT(*) AS n FROM SaasPixLegacyInvoices')).n,
      sourceUnchanged: before === digest(), productionDatabaseMigrated: false };
  } finally { await close(copy); }
  fs.writeFileSync(path.join(__dirname, 'migration-rehearsal.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!report.sourceUnchanged || !report.financialRowsUnchanged || report.integrity !== 'ok' || report.foreignKeyErrors) process.exitCode = 1;
}
main().catch(error => { console.error('Migration rehearsal failed:', error.code || error.name); process.exitCode = 1; });
