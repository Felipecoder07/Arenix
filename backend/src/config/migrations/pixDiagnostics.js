// Additive migration. Historical attempts are never reclassified from missing evidence.
async function migratePixDiagnostics(db) {
  const columns = await db.allAsync('PRAGMA table_info(PaymentIntents)');
  for (const [name, type] of Object.entries({
    diagnostic_json: 'TEXT', receiver_id: 'TEXT', credential_fingerprint: 'TEXT',
    request_encrypted: 'TEXT', request_hash: 'TEXT', expires_at: 'TEXT',
    reconcile_count: 'INTEGER NOT NULL DEFAULT 0', last_reconciled: 'INTEGER', next_reconcile: 'INTEGER',
  })) {
    if (!columns.some(column => column.name === name)) await db.runAsync(`ALTER TABLE PaymentIntents ADD COLUMN ${name} ${type}`);
  }
  await db.runAsync(`CREATE TABLE IF NOT EXISTS SaasPixAttempts (
    id TEXT PRIMARY KEY, invoice_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL, receiver_id TEXT, credential_fingerprint TEXT,
    state TEXT NOT NULL DEFAULT 'creating', gateway_ref TEXT, response_json TEXT,
    diagnostic_json TEXT, request_encrypted TEXT, request_hash TEXT,
    created INTEGER NOT NULL, updated INTEGER NOT NULL, legacy INTEGER NOT NULL DEFAULT 0,
    reconcile_count INTEGER NOT NULL DEFAULT 0, last_reconciled INTEGER, next_reconcile INTEGER
  )`);
  await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS one_open_saas_pix ON SaasPixAttempts(invoice_id)
    WHERE state IN ('creating','pending','unknown','paid')`);
  // Retain knowledge of invoices that may have been submitted using the old key.
  await db.runAsync('CREATE TABLE IF NOT EXISTS SaasPixLegacyInvoices(invoice_id INTEGER PRIMARY KEY)');
  if (!await db.getAsync('SELECT 1 FROM SecurityMigrations WHERE version=10')) {
    if (await db.getAsync("SELECT 1 FROM sqlite_master WHERE type='table' AND name='FaturasSaaS'")) {
      await db.runAsync('INSERT OR IGNORE INTO SaasPixLegacyInvoices SELECT id FROM FaturasSaaS');
    }
    await db.runAsync('INSERT OR IGNORE INTO SecurityMigrations(version) VALUES(10)');
  }
}
module.exports = { migratePixDiagnostics };
