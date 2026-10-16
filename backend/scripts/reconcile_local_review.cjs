// One-time reconciliation for the reviewed LOCAL database. No application jobs or network.
// Default: rehearsal on a private copy. --apply: backup, then identical transaction locally.
const sqlite = require('sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'backend/data/courtmanager.sqlite');
const apply = process.argv.includes('--apply');
const mode = apply ? 'apply' : 'rehearsal';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const privateDir = path.join(root, '.local-security', `review-${stamp}`);
const open = (file, flags) => new Promise((resolve, reject) => {
  const db = new sqlite.Database(file, flags, error => error ? reject(error) : resolve(db));
});
const run = (db, sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, function(error) { error ? reject(error) : resolve(this); }));
const all = (db, sql, args = []) => new Promise((resolve, reject) => db.all(sql, args, (error, rows) => error ? reject(error) : resolve(rows)));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));

async function reconcile(db) {
  await run(db, 'BEGIN IMMEDIATE');
  try {
    const beforeInvoices = await all(db, 'SELECT * FROM FaturasSaaS ORDER BY id');
    const beforeArenas = await all(db, 'SELECT * FROM Arenas ORDER BY id');
    const logs = await all(db, 'SELECT id,evento,detalhes FROM LogsAuditoria ORDER BY id');
    const changed = [];
    for (const [arenaId, invoiceId, logId] of [[2, 4, 293], [4, 6, 402]]) {
      const arena = beforeArenas.find(a => a.id === arenaId);
      const invoice = beforeInvoices.find(f => f.id === invoiceId);
      assert.equal(arena?.status, 0, `Arena ${arenaId}: estado divergente`);
      assert.equal(invoice?.tenant_id, arenaId);
      assert.equal(invoice.status, 'Atrasada');
      assert.equal(invoice.valor, 4999);
      const statusLogs = logs.filter(l => /^SaaS:/.test(l.evento) && /Bloqueio|Desbloqueio|Status Alterado/.test(l.evento)
        && new RegExp(`(?:Arena[^\\n]*?ID:\\s*${arenaId}\\b)`, 'i').test(l.detalhes || ''));
      const latest = statusLogs.at(-1);
      assert.equal(latest?.id, logId, `Arena ${arenaId}: histórico de status mudou`);
      assert.equal(latest.evento, 'SaaS: Bloqueio Automático por Inadimplência');
      assert.match(latest.detalhes, new RegExp(`fatura #${invoiceId}\\b`));
      if (arena.motivo_bloqueio === 'inadimplencia') continue;
      assert.equal(arena.motivo_bloqueio, null, 'Não sobrescrever motivo já registrado');
      await run(db, "UPDATE Arenas SET motivo_bloqueio='inadimplencia' WHERE id=? AND status=0 AND motivo_bloqueio IS NULL", [arenaId]);
      await run(db, 'INSERT INTO LogsAuditoria (tenant_id,usuario_id,evento,detalhes,ip) VALUES (?,0,?,?,?)', [arenaId,
        'SaaS: Conciliação local de motivo', `Arena ID: ${arenaId}; motivo inadimplencia comprovado pelo log ${logId} e fatura #${invoiceId}. Status bloqueado preservado.`, 'local-review']);
      changed.push(arenaId);
    }
    const columns = await all(db, 'PRAGMA table_info(FaturasSaaS)');
    const migrated = !columns.some(c => c.name === 'gateway_estornado_ref');
    if (migrated) await run(db, 'ALTER TABLE FaturasSaaS ADD COLUMN gateway_estornado_ref TEXT');
    const testIds = [18, 19, 20, 21, 22, 23, 24];
    assert.equal(beforeInvoices.filter(f => f.tenant_id === 1 && testIds.includes(f.id)).length, 7);
    const classificationEvent = 'SaaS: Classificação local de dados de teste';
    if (!logs.some(l => l.evento === classificationEvent)) {
      await run(db, 'INSERT INTO LogsAuditoria (tenant_id,usuario_id,evento,detalhes,ip) VALUES (1,0,?,?,?)', [classificationEvent,
        'Responsável confirmou na revisão de 08/10/2026: faturas 18 a 24 da arena 1 são apenas testes. Não representam contratação ou recebimentos reais. Registros preservados; esta classificação não filtra os relatórios da aplicação.', 'local-review']);
    }
    const afterInvoices = await all(db, 'SELECT * FROM FaturasSaaS ORDER BY id');
    assert.deepEqual(afterInvoices.map(({ gateway_estornado_ref, ...row }) => row), beforeInvoices.map(({ gateway_estornado_ref, ...row }) => row));
    const afterArenas = await all(db, 'SELECT * FROM Arenas ORDER BY id');
    assert.deepEqual(afterArenas, beforeArenas.map(a => changed.includes(a.id) ? { ...a, motivo_bloqueio: 'inadimplencia' } : a));
    assert.deepEqual(await all(db, 'PRAGMA integrity_check'), [{ integrity_check: 'ok' }]);
    await run(db, 'COMMIT');
    return { arenas_reconciled: changed, migration_added: migrated, test_invoice_ids: testIds, invoice_values_and_statuses_unchanged: true, integrity: 'ok' };
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}

(async () => {
  fs.mkdirSync(privateDir, { recursive: true });
  const backup = path.join(privateDir, 'before.sqlite');
  const reader = await open(source, sqlite.OPEN_READONLY);
  try { await run(reader, 'VACUUM INTO ?', [backup]); } finally { await close(reader); }
  const destination = apply ? source : path.join(privateDir, 'rehearsal.sqlite');
  if (!apply) fs.copyFileSync(backup, destination);
  const db = await open(destination, sqlite.OPEN_READWRITE);
  let result;
  try {
    result = await reconcile(db);
    if (!apply) {
      const repeated = await reconcile(db);
      assert.deepEqual(repeated.arenas_reconciled, []);
      assert.equal(repeated.migration_added, false);
      result.idempotency_verified = true;
    }
  } finally { await close(db); }
  const report = { generated_at: new Date().toISOString(), mode, backup: path.relative(root, backup), ...result };
  const output = path.join(root, 'artifacts/master-final', `local-reconciliation-${mode}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
