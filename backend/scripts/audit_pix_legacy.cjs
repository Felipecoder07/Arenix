// Read-only inventory; no startup, migrations, credentials or provider calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite = require('sqlite3');
const root = path.resolve(__dirname, '../..');
const instance = process.argv.some(arg => arg.startsWith('--instance='))
  ? require('./homologacao_instance.cjs').resolveInstance() : null;
const source = path.join(instance || root, 'backend/data/courtmanager.sqlite');
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
async function main() {
  const before = digest();
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite.Database(source, sqlite.OPEN_READONLY, error => error ? reject(error) : resolve(connection));
  });
  const all = sql => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  const report = { at: new Date().toISOString(), instance: instance ? path.basename(instance) : 'workspace', mode: 'read-only', providerQueried: false, correctionsApplied: false };
  try {
    await all('PRAGMA query_only=ON');
    const tables = new Set((await all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name));
    report.reservationAttempts = tables.has('PaymentIntents') ? await all(`SELECT reserva_id,tenant_id,state,
      COUNT(*) AS attempts, SUM(CASE WHEN gateway_ref IS NULL OR gateway_ref='' THEN 1 ELSE 0 END) AS withoutReference
      FROM PaymentIntents WHERE method='Pix' GROUP BY reserva_id,tenant_id,state ORDER BY reserva_id`) : [];
    report.saasAttempts = tables.has('SaasPixAttempts') ? await all(`SELECT invoice_id,tenant_id,state,COUNT(*) AS attempts
      FROM SaasPixAttempts GROUP BY invoice_id,tenant_id,state ORDER BY invoice_id`) : [];
    report.openInvoices = tables.has('FaturasSaaS') ? await all(`SELECT id,tenant_id,status,
      CASE WHEN gateway_ref IS NULL OR gateway_ref='' THEN 0 ELSE 1 END AS hasReference
      FROM FaturasSaaS WHERE status IN ('Pendente','Atrasada') ORDER BY id`) : [];
    report.pixMigrationPresent = tables.has('SaasPixAttempts') && tables.has('SaasPixLegacyInvoices');
    report.action = 'Preserve historical attempts. Missing reference is not proof of failure. Reconcile each uncertain operation with its original receiving account before any correction.';
  } finally { await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
  report.sourceUnchanged = before === digest();
  const target = path.join(root, 'artifacts/pix', report.at.replace(/[:.]/g, '-') + '-legacy-audit.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: path.relative(root, target), reservationGroups: report.reservationAttempts.length,
    saasGroups: report.saasAttempts.length, openInvoices: report.openInvoices.length, sourceUnchanged: report.sourceUnchanged }));
}
main().catch(error => { console.error('Read-only Pix audit failed:', error.code || error.name); process.exitCode = 1; });
