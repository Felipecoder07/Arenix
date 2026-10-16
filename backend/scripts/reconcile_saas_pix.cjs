// Consult an existing SaaS attempt. Never emits a payment or rotates its key.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const invoiceId = Number(process.argv.find(a => a.startsWith('--invoice='))?.slice(10));
if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) throw new Error('Use --invoice=ID');
const db = require('../src/config/database');
async function main() {
  const attempt = await require('../src/services/saasPixService').consult(invoiceId);
  if (!attempt) throw new Error('No existing attempt');
  const diagnostic = JSON.parse(attempt.diagnostic_json || '{}');
  console.log(JSON.stringify({ invoiceId, state: attempt.state, hasPaymentReference: Boolean(attempt.gateway_ref),
    hasPix: Boolean(attempt.response_json), diagnostic: require('../src/utils/paymentProviderError').sanitizeDiagnostic(diagnostic), paymentCreated: false }));
}
main().catch(error => { console.error('Reconciliation failed:', error.paymentCode || error.code || error.name); process.exitCode = 1; }).finally(() => db.close());
