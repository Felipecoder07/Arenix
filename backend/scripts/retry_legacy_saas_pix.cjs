// Explicit operator recovery only. One persisted submission per legacy attempt,
// original idempotency key and receiving account; never called automatically.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const db = require('../src/config/database');
const { hash } = require('../src/utils/security');
const pix = require('../src/utils/pixPayment');
const errors = require('../src/utils/paymentProviderError');
const service = require('../src/services/saasPixService');
const invoiceId = Number(process.argv.find(a => a.startsWith('--invoice='))?.slice(10));
const expected = Number(process.argv.find(a => a.startsWith('--expected-cents='))?.slice(17));
if (!process.argv.includes('--submit') || !Number.isSafeInteger(invoiceId) || invoiceId <= 0 || !Number.isSafeInteger(expected) || expected <= 0) {
  throw new Error('Use --invoice=ID --expected-cents=CENTS --submit after explicit operator authorization');
}
async function main() {
  const token = await require('../src/services/saasBillingService').getMasterAccessToken();
  if (!token) throw new Error('Credential unavailable');
  const receiver = await service.masterReceiver(token);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS SaasPixOperatorRecovery (
    attempt_id TEXT PRIMARY KEY, invoice_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
    request_hash TEXT NOT NULL, request_encrypted TEXT, state TEXT NOT NULL, diagnostic_json TEXT,
    created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
  const { attempt, payload } = await db.transaction(async () => {
    const invoice = await db.getAsync(`SELECT f.*, a.email AS arena_email FROM FaturasSaaS f
      JOIN Arenas a ON a.id=f.tenant_id WHERE f.id=?`, [invoiceId]);
    const attempt = await db.getAsync('SELECT * FROM SaasPixAttempts WHERE invoice_id=? ORDER BY created DESC LIMIT 1', [invoiceId]);
    if (!invoice || !attempt || !attempt.legacy || attempt.state !== 'unknown' ||
        !['Pendente','Atrasada'].includes(invoice.status) || invoice.gateway_ref || attempt.gateway_ref ||
        invoice.valor !== expected || attempt.amount_cents !== expected || invoice.tenant_id !== attempt.tenant_id ||
        attempt.credential_fingerprint !== hash(token) || String(attempt.receiver_id) !== String(receiver) ||
        attempt.id !== `saas-invoice-${invoiceId}-${Math.round(expected * 100)}`) throw new Error('Recovery preconditions failed');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.arena_email || '')) throw new Error('Valid invoice payer email required');
    const payload = { transaction_amount: expected / 100, description: `Mensalidade SaaS Arenix — Fatura #${invoiceId}`,
      payment_method_id: 'pix', external_reference: attempt.id,
      date_of_expiration: new Date(Date.now() + 86400000).toISOString(),
      payer: { email: invoice.arena_email }, metadata: { fatura_saas_id: invoiceId, tenant_id: invoice.tenant_id, origem: 'saas_billing' } };
    const snapshot = pix.requestSnapshot(payload);
    await db.runAsync(`INSERT INTO SaasPixOperatorRecovery
      (attempt_id,invoice_id,amount_cents,request_hash,request_encrypted,state,created,updated)
      VALUES(?,?,?,?,?,'sending',?,?)`, [attempt.id, invoiceId, expected, snapshot.hash, snapshot.encrypted, Date.now(), Date.now()]);
    return { attempt, payload };
  });
  try {
    const payment = await errors.readPaymentResponse(await require('../src/utils/providerHttp').fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': attempt.id }, body: JSON.stringify(payload),
    }));
    const response = await service.savePayment(attempt, payment);
    await db.runAsync("UPDATE SaasPixOperatorRecovery SET state='resolved',updated=? WHERE attempt_id=?", [Date.now(), attempt.id]);
    console.log(JSON.stringify({ invoiceId, amount: expected / 100, providerStatus: payment.status, pixAvailable: Boolean(response?.copia_cola), originalKeyPreserved: true }));
  } catch (error) {
    const failure = errors.normalizePaymentError(error, attempt.id);
    await db.runAsync("UPDATE SaasPixOperatorRecovery SET state='unknown',diagnostic_json=?,updated=? WHERE attempt_id=?",
      [JSON.stringify(failure.diagnostic), Date.now(), attempt.id]);
    await db.runAsync("UPDATE SaasPixAttempts SET diagnostic_json=?,updated=? WHERE id=? AND state='unknown'", [JSON.stringify(failure.diagnostic), Date.now(), attempt.id]);
    console.log(JSON.stringify({ invoiceId, pixAvailable: false, originalKeyPreserved: true, diagnostic: failure.diagnostic }));
    process.exitCode = 1;
  }
}
main().catch(error => { console.error('Recovery stopped:', error.code || error.name); process.exitCode = 1; }).finally(() => db.close());
