// One isolated TEST Pix control request. The operation is recorded before sending
// so an uncertain result cannot silently become a second payment on rerun.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveInstance, verifySnapshot, config, testBuyerEmail } = require('./homologacao_instance.cjs');
const { installNetworkGuard } = require('./homologacao_network.cjs');

function controlBuyerEmail(settings, args, operation) {
  if (args.some(arg => arg.startsWith('--buyer-username='))) {
    throw new Error('A username does not establish an email. Configure MERCADO_PAGO_TEST_BUYER_EMAIL explicitly.');
  }
  // Legacy uncertain operations can only reuse the exact persisted payer.
  return testBuyerEmail({ MERCADO_PAGO_TEST_BUYER_EMAIL: settings.MERCADO_PAGO_TEST_BUYER_EMAIL ||
    (args.includes('--retry') ? operation?.payerCandidate : '') });
}
async function main() {
  const folder = resolveInstance();
  const manifest = verifySnapshot(folder);
  const settings = config(folder);
  const operationFile = path.join(folder, 'pix-control-operation.json');
  const retry = process.argv.includes('--retry');
  let operation = fs.existsSync(operationFile) ? JSON.parse(fs.readFileSync(operationFile, 'utf8')) : undefined;
  const email = controlBuyerEmail(settings, process.argv, operation);
  if (fs.existsSync(operationFile)) {
    operation = JSON.parse(fs.readFileSync(operationFile, 'utf8'));
    const ambiguous = operation.status === 'uncertain' ||
      (operation.status === 'rejected_or_unknown' && Number(operation.result?.http_status) >= 500);
    if (!retry || !ambiguous || operation.payerCandidate !== email ||
      operation.amount !== 1 || !/^cm-control-[0-9a-f-]{36}$/.test(operation.reference) ||
      operation.idempotencyKey !== operation.reference) {
      throw new Error('Existing Pix control cannot be retried with different parameters.');
    }
  } else {
    if (retry) throw new Error('No uncertain Pix control operation exists to retry.');
    const reference = 'cm-control-' + crypto.randomUUID();
    operation = { reference, idempotencyKey: reference, amount: 1, currency: 'BRL',
      payerCandidate: email, createdAt: new Date().toISOString(), status: 'not_sent' };
    fs.writeFileSync(operationFile, JSON.stringify(operation, null, 2), { flag: 'wx' });
  }
  const reference = operation.reference;
  const guardedFetch = installNetworkGuard(settings, folder, manifest.digest);
  try {
    operation.status = 'sending';
    fs.writeFileSync(operationFile, JSON.stringify(operation, null, 2));
    const response = await guardedFetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST', headers: { Authorization: 'Bearer ' + settings.MERCADO_PAGO_ACCESS_TOKEN,
        'Content-Type': 'application/json', 'X-Idempotency-Key': reference },
      body: JSON.stringify({ transaction_amount: 1, description: 'Controle Pix CourtManager',
        external_reference: reference, payment_method_id: 'pix',
        payer: { email, first_name: 'Teste', last_name: 'Comprador' } }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json().catch(() => ({}));
    const safe = require('../src/utils/paymentProviderError').responseDiagnostic(response, body);
    operation.status = response.ok ? 'created'
      : response.status >= 500 || response.status === 429 ? 'uncertain' : 'rejected_or_unknown';
    operation.result = { ...safe, paymentId: /^\d+$/.test(String(body.id)) ? String(body.id) : undefined,
      providerStatus: /^[a-z_]{1,40}$/.test(body.status || '') ? body.status : undefined,
      liveMode: typeof body.live_mode === 'boolean' ? body.live_mode : undefined,
      currency: body.currency_id === 'BRL' ? 'BRL' : undefined,
      amountMatches: Number(body.transaction_amount) === 1,
      qrPresent: Boolean(body.point_of_interaction?.transaction_data?.qr_code) };
    fs.writeFileSync(operationFile, JSON.stringify(operation, null, 2));
    console.log(JSON.stringify({ status: operation.status, result: operation.result }, null, 2));
    if (!response.ok || body.live_mode !== false || !operation.result.amountMatches) process.exitCode = 1;
  } catch (error) {
    operation.status = 'uncertain';
    operation.errorClass = error.name || 'Error';
    const networkCode = error.cause?.code || error.code || '';
    operation.networkCode = /^[A-Z_]{3,40}$/.test(networkCode) ? networkCode : undefined;
    fs.writeFileSync(operationFile, JSON.stringify(operation, null, 2));
    console.error('Pix control result uncertain; inspect the saved reference before retrying.');
    process.exitCode = 1;
  }
}
if (require.main === module) main().catch(error => { console.error('Pix control preparation failed:', error.message); process.exitCode = 1; });
module.exports = { controlBuyerEmail };
