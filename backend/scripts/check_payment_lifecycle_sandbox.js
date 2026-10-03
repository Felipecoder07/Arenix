// Explicit sandbox integration, never run as part of the unit suite.
// Uses current application services with an in-memory database and TEST credentials.
// No SMTP, cron, real database, or production credential is loaded.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../..');
const config = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env.homologacao')));
const token = config.MERCADO_PAGO_ACCESS_TOKEN;
const browserMode = process.argv.includes('--browser');
const cardMethod = process.argv.includes('--mastercard') ? 'master' : 'visa';
let cardBrowser;
assert.ok(token?.startsWith('TEST-'), 'Only explicitly configured TEST credentials are accepted.');
for (const name of Object.keys(process.env)) {
  if (/^(EMAIL_|MERCADO_?PAGO|MP_|GOOGLE_|SECRETS_|VITEST|LISTEN_HOST|TRUST_PROXY|CORS_ALLOWED_ORIGINS|FRONTEND_URL|APP_URL)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: 'test', TEST_DB_PATH: ':memory:',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  FRONTEND_URL: 'http://localhost:5186',
});
dotenv.config = () => ({ parsed: {} });
require('../src/services/emailService').sendEmail = async () => { throw new Error('SMTP disabled in sandbox runner.'); };

const folder = path.join(root, '.local-security/homologacao');
fs.mkdirSync(folder, { recursive: true });
const reportFile = path.join(folder, 'lifecycle-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
const report = {
  startedAt: new Date().toISOString(), database: ':memory:', provider: 'Mercado Pago TEST',
  browserValidated: false, providerDeliveredWebhookValidated: false, productionApproved: false,
  tokenization: browserMode ? 'real_react_cardform_hosted_fields' : 'server_api',
  cardMethod,
  omitIssuerDiagnostic: process.argv.includes('--omit-issuer'),
  calls: [], scenarios: [],
};
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
const safeDescription = value => typeof value === 'string' ? value
  .replaceAll(token, '[credential]').replace(/\b(?:TEST-|APP_USR-)[\w-]+/g, '[credential]')
  .replace(/[\w.+-]+@[\w.-]+/g, '[email]').replace(/\d{12,}/g, '[number]')
  .replace(/[\r\n]/g, ' ').slice(0, 250) : undefined;
save();
const verifiedPayments = new Set();
const networkFetch = global.fetch;
let losePaymentResponse = false;
let loseRefundResponse = false;

// Restrict every request before sending it; never follow redirects with credentials.
global.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const method = options.method || 'GET';
  const paymentPath = /^\/v1\/payments\/(\d+)(\/refunds)?$/.exec(url.pathname);
  assert.equal(url.origin, 'https://api.mercadopago.com');
  assert.equal(new Headers(options.headers).get('authorization'), 'Bearer ' + token);
  const allowed = method === 'GET' && ['/users/me', '/v1/payments/search'].includes(url.pathname) ||
    method === 'POST' && ['/v1/card_tokens', '/v1/payments'].includes(url.pathname) ||
    paymentPath && method === 'GET' && !paymentPath[2] ||
    paymentPath && method === 'POST' && paymentPath[2] && verifiedPayments.has(paymentPath[1]);
  assert.ok(allowed, 'Sandbox endpoint not allowed.');
  if (url.pathname === '/v1/payments' && method === 'POST') {
    const body = JSON.parse(options.body);
    assert.equal(body.transaction_amount, 100);
    assert.equal(body.payment_method_id, cardMethod);
  }
  const response = await networkFetch(input, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
  const body = await response.clone().json().catch(() => ({}));
  report.calls.push({
    method, path: url.pathname, httpStatus: response.status,
    status: /^[a-z_]+$/.test(body.status || '') ? body.status : undefined,
    error: /^[a-z_]+$/.test(body.error || '') ? body.error : undefined,
    causeCodes: Array.isArray(body.cause) ? body.cause.map(item => String(item.code)).filter(code => /^[\w-]{1,40}$/.test(code)) : undefined,
    descriptions: !response.ok && Array.isArray(body.cause) ? body.cause.map(item => safeDescription(item.description)) : undefined,
    requestId: /^[a-zA-Z0-9-]{1,100}$/.test(response.headers.get('x-request-id') || '') ? response.headers.get('x-request-id') : undefined,
    paymentMethodExcluded: Array.isArray(body.cause) && body.cause.some(item => String(item.code) === '10113' && item.description === 'The Payment Method is excluded by a rule.'),
  });
  save();
  if (response.ok && /^\/v1\/payments(?:\/\d+)?$/.test(url.pathname)) {
    assert.equal(body.live_mode, false, 'Payment must explicitly be sandbox.');
    assert.equal(body.currency_id, 'BRL');
    assert.equal(body.transaction_amount, 100);
    assert.match(String(body.id), /^\d+$/);
    verifiedPayments.add(String(body.id));
    report.testPaymentIds = [...verifiedPayments];
    save();
    if (method === 'POST' && losePaymentResponse) {
      losePaymentResponse = false;
      throw new Error('Deliberately lost sandbox payment response.');
    }
  }
  if (response.ok && paymentPath?.[2] && loseRefundResponse) {
    loseRefundResponse = false;
    throw new Error('Deliberately lost sandbox refund response.');
  }
  return response;
};

const fixture = require('../tests/helpers/securityFixture.cjs');
const { db } = fixture;
const gateway = require('../src/services/gatewayService');
const { processarOutbox } = require('../src/jobs/reconciliacaoOutbox');
const app = require('../src/app');
const balance = () => db.getAsync('SELECT COUNT(*) AS count,COALESCE(SUM(valor),0) AS total FROM Pagamentos');

async function cardToken(scenario) {
  if (browserMode) return cardBrowser.tokenize(scenario);
  // Public synthetic card from Mercado Pago's Payments API test-card documentation.
  const response = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_number: cardMethod === 'master' ? '5480832801033311' : '4235647728025682', security_code: '123', expiration_month: 11, expiration_year: 2030,
      cardholder: { name: scenario, identification: { type: 'CPF', number: '12345678909' } } }),
  });
  const body = await response.json();
  assert.ok(response.ok && body.id, 'Synthetic card tokenization failed.');
  return { token: body.id, payment_method_id: cardMethod, email: 'comprador@example.com',
    identification: { type: 'CPF', number: '12345678909' }, installments: 1 };
}

async function main() {
  await fixture.initialize();
  const account = await gateway.consultarContaGateway(token);
  if (browserMode) cardBrowser = await require('./helpers/sandboxCardBrowser.cjs').createCardBrowser(config.MERCADO_PAGO_PUBLIC_KEY, entry => { report.calls.push(entry); save(); }, cardMethod);
  for (const scenario of ['APRO', 'OTHE']) {
    const evidence = { scenario, passed: false };
    report.scenarios.push(evidence);
    try {
      await fixture.seed();
      await db.runAsync('UPDATE Arenas SET gateway_access_token=?,gateway_user_id=? WHERE id=1', [token, account]);
      await db.runAsync("UPDATE Clientes SET email='comprador@example.com' WHERE id=1");
      const card = await cardToken(scenario);
      if (process.argv.includes('--omit-issuer')) delete card.issuer_id;
      evidence.cardMetadata = { method: card.payment_method_id, issuer: card.issuer_id, installments: card.installments };
      losePaymentResponse = scenario === 'APRO';
      let created;
      try { created = await gateway.criarCobrancaCartao(1, 10000, card, 1); }
      catch { evidence.createResponseLostOrRejected = true; }
      losePaymentResponse = false;
      evidence.balanceAfterCreation = await balance();
      if (scenario === 'OTHE') {
        assert.equal(created?.status, 'rejected', 'Provider did not return a terminal rejected payment.');
        assert.deepEqual(await balance(), { count: 0, total: 0 });
        assert.equal((await db.getAsync('SELECT state FROM PaymentIntents')).state, 'failed');
      } else {
        assert.deepEqual(await balance(), { count: 0, total: 0 });
        evidence.recovery = await processarOutbox({ olderThanMs: 0 });
        const intent = await db.getAsync('SELECT state,gateway_ref FROM PaymentIntents');
        assert.equal(intent.state, 'paid', 'Sandbox approval could not be recovered from provider.');
        evidence.paymentId = intent.gateway_ref;
        assert.deepEqual(await balance(), { count: 1, total: 10000 });
        for (let attempt = 0; attempt < 2; attempt++) {
          // Locally generated signed webhook, with real authenticated provider GET.
          assert.equal((await fixture.signedWebhook(app, intent.gateway_ref)).status, 200);
        }
        assert.deepEqual(await balance(), { count: 1, total: 10000 });
        // Read and validate live_mode before authorizing any refund request.
        await fetch('https://api.mercadopago.com/v1/payments/' + intent.gateway_ref, { headers: { Authorization: 'Bearer ' + token } });
        loseRefundResponse = true;
        assert.equal((await gateway.estornarPagamentoPix(1, 1)).success, false);
        loseRefundResponse = false;
        evidence.refundRecovery = await processarOutbox({ olderThanMs: 0 });
        assert.deepEqual(await balance(), { count: 2, total: 0 });
        for (let attempt = 0; attempt < 2; attempt++) assert.equal((await fixture.signedWebhook(app, intent.gateway_ref)).status, 200);
        assert.deepEqual(await balance(), { count: 2, total: 0 });
      }
      evidence.passed = true;
    } catch (error) {
      evidence.failureType = error.code === 'ERR_ASSERTION' ? 'assertion_failed' : 'integration_failed';
    } finally {
      losePaymentResponse = false;
      loseRefundResponse = false;
      evidence.finalBalance = await balance();
      evidence.intents = await db.allAsync('SELECT id,state,gateway_ref FROM PaymentIntents');
      evidence.refunds = await db.allAsync('SELECT id,state,gateway_ref FROM RefundIntents');
      save();
    }
  }
  report.finishedAt = new Date().toISOString();
  report.sandboxScenariosPassed = report.scenarios.every(scenario => scenario.passed);
  save();
  console.log(JSON.stringify({ report: path.relative(root, reportFile), scenarios: report.scenarios.map(({ scenario, passed }) => ({ scenario, passed })), providerCalls: report.calls, productionApproved: false }, null, 2));
  if (!report.sandboxScenariosPassed) process.exitCode = 1;
}
main().catch(error => {
  report.failureCode = /^[A-Z_]{1,40}$/.test(error.cause?.code || error.code || '') ? error.cause?.code || error.code : 'INTEGRATION_FAILED';
  save();
  console.error('Sandbox lifecycle failed:', report.failureCode);
  process.exitCode = 1;
}).finally(async () => { await cardBrowser?.close(); await fixture.close(); });
