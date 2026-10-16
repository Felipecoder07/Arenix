// Read-only provider check. Never imports the application or opens its database.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const folder = require('./homologacao_instance.cjs').resolveInstance();
  const config = require('./homologacao_instance.cjs').config(folder);
  const token = config.MERCADO_PAGO_ACCESS_TOKEN;
  const credentials = require('./homologacao_credentials.cjs');
  credentials.validateTestCredentials(config);
  const result = { checkedAt: new Date().toISOString(), method: 'GET', path: '/users/me', paymentCreated: false };
  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  const body = await response.json();
  let identityConfirmed = false;
  if (response.ok) {
    try { credentials.verifyConfiguredIdentity(config, token, body); identityConfirmed = true; }
    catch { /* A successful login alone does not prove a test seller identity. */ }
  }
  Object.assign(result, {
    httpStatus: response.status,
    authenticated: response.ok && Boolean(body.id),
    brazilAccount: body.site_id === 'MLB',
    testUserTag: Array.isArray(body.tags) && body.tags.includes('test_user'),
    identityConfirmed,
    credentialKind: token.startsWith('TEST-') ? 'static_test' : 'pinned_test_account',
    // Allow only a short provider error identifier, never raw response/account data.
    errorCode: !response.ok && /^[a-z_]{1,80}$/i.test(body.error || '') ? body.error : undefined,
    homologationApproved: false,
  });
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'credential-check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.authenticated || !identityConfirmed) process.exitCode = 1;
}
main().catch(error => {
  console.error('Credential check failed:', error.cause?.code || error.code || error.name);
  process.exitCode = 1;
});
