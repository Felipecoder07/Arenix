const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const instance = require('../scripts/homologacao_instance.cjs');
const { installNetworkGuard } = require('../scripts/homologacao_network.cjs');
let project;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'arenix-pix-test-'));
  fs.mkdirSync(path.join(project, 'backend/src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'backend/src/app.js'), 'original');
});
afterEach(() => {
  if (path.dirname(project) !== fs.realpathSync(os.tmpdir()) && path.dirname(project) !== os.tmpdir()) throw new Error('Unexpected temporary path');
  fs.rmSync(project, { recursive: true });
});
it.each(['../outside','a/b','a\\b','C:\\other','.','..'])('rejects invalid instance name %s', name => {
  expect(() => instance.resolveInstance(['--instance=' + name], project)).toThrow();
});
it('prepares and validates a snapshot and refuses overwrite', () => {
  const target = instance.resolveInstance(['--instance=pix-v2'], project);
  const prepared = instance.prepareSnapshot(target, project);
  expect(instance.verifySnapshot(target, { projectRoot: project }).digest).toBe(prepared.digest);
  expect(() => instance.prepareSnapshot(target, project)).toThrow(/preserved/);
});
it.each(['changed','extra','missing'])('refuses %s snapshot files', action => {
  const target = instance.resolveInstance(['--instance=pix-v2'], project);
  instance.prepareSnapshot(target, project);
  const file = path.join(target, 'backend/src/app.js');
  if (action === 'changed') fs.writeFileSync(file, 'changed');
  if (action === 'extra') fs.writeFileSync(path.join(target, 'backend/src/extra.js'), 'extra');
  if (action === 'missing') fs.unlinkSync(file);
  expect(() => instance.verifySnapshot(target, { projectRoot: project })).toThrow(/manifest/);
});
it('detects newer workspace sources and preserves the old snapshot', () => {
  const target = instance.resolveInstance(['--instance=pix-v2'], project);
  instance.prepareSnapshot(target, project);
  fs.writeFileSync(path.join(project, 'backend/src/app.js'), 'updated');
  expect(() => instance.verifySnapshot(target, { projectRoot: project })).toThrow(/Workspace changed/);
  expect(fs.readFileSync(path.join(target, 'backend/src/app.js'), 'utf8')).toBe('original');
});
it('requires an explicit buyer email before the isolated Pix flow', () => {
  expect(() => instance.testBuyerEmail({})).toThrow(/explicit test buyer/);
  expect(() => instance.testBuyerEmail({ MERCADO_PAGO_TEST_BUYER_EMAIL: 'comprador@example.com' })).toThrow(/explicit test buyer/);
  expect(instance.testBuyerEmail({ MERCADO_PAGO_TEST_BUYER_EMAIL: 'buyer@testuser.com' })).toBe('buyer@testuser.com');
});
it('validates account identity before sending a configured test payment', async () => {
  const calls = [];
  const network = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify(url.endsWith('/users/me') ? { id: 123, site_id: 'MLB' } : { id: 991, live_mode: false }));
  };
  const guard = installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'TEST-fixture' }, project, 'manifest', network);
  await guard('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { Authorization: 'Bearer TEST-fixture' }, body: '{}' });
  expect(calls).toEqual(['https://api.mercadopago.com/users/me','https://api.mercadopago.com/v1/payments']);
  expect(fs.readFileSync(path.join(project, 'provider-checks.jsonl'), 'utf8')).not.toContain('TEST-fixture');
});
it('refuses unlisted credentials and arbitrary hosts before network access', async () => {
  const network = vi.fn();
  const guard = installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'TEST-fixture' }, project, 'manifest', network);
  await expect(guard('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { Authorization: 'Bearer TEST-other' } })).rejects.toThrow();
  await expect(guard('https://other.example/oauth/token', { method: 'POST' })).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});
it('only accepts OAuth tokens for the explicitly allowed test identity', async () => {
  const config = { MERCADO_PAGO_ACCESS_TOKEN: 'TEST-fixture', MERCADO_PAGO_CLIENT_ID: 'client',
    HOMOLOGACAO_OAUTH_SECRET: 'secret', MERCADO_PAGO_REDIRECT_URI: 'https://callback.example/api/pagamentos/gateway/oauth/callback', OAUTH_TEST_ACCOUNT_IDS: '123' };
  const network = vi.fn(async url => new Response(JSON.stringify(url.endsWith('/oauth/token')
    ? { access_token: 'OAUTH-private' } : { id: 999, site_id: 'MLB', tags: ['test_user'] })));
  const guard = installNetworkGuard(config, project, 'manifest', network);
  await expect(guard('https://api.mercadopago.com/oauth/token', { method: 'POST', body: JSON.stringify({
    client_id: 'client', client_secret: 'secret', redirect_uri: config.MERCADO_PAGO_REDIRECT_URI, grant_type: 'authorization_code', code: 'private',
  }) })).rejects.toThrow(/identity/);
});

it('allows APP_USR only after the pinned Brazilian test identity is confirmed', async () => {
  const network = vi.fn(async url => new Response(JSON.stringify(url.endsWith('/users/me')
    ? { id: 123, site_id: 'MLB', tags: ['test_user'] } : { id: 991, live_mode: false })));
  const guard = installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-private', MERCADO_PAGO_TEST_SELLER_ID: '123' }, project, 'manifest', network);
  await guard('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { Authorization: 'Bearer APP_USR-private' } });
  expect(network).toHaveBeenCalledTimes(2);
  expect(fs.readFileSync(path.join(project, 'provider-checks.jsonl'), 'utf8')).not.toContain('APP_USR-private');
});
it.each([
  { id: 123, site_id: 'MLB', tags: [] },
  { id: 999, site_id: 'MLB', tags: ['test_user'] },
  { id: 123, site_id: 'MLA', tags: ['test_user'] },
])('blocks payment for an unverified APP_USR identity %j', async account => {
  const network = vi.fn(async () => new Response(JSON.stringify(account)));
  const guard = installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-private', MERCADO_PAGO_TEST_SELLER_ID: '123' }, project, 'manifest', network);
  await expect(guard('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { Authorization: 'Bearer APP_USR-private' } })).rejects.toThrow(/identity/);
  expect(network).toHaveBeenCalledTimes(1);
  expect(network.mock.calls[0][0]).toBe('https://api.mercadopago.com/users/me');
});
it('refuses APP_USR without an explicit identity, including a master credential', () => {
  expect(() => installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-private' }, project, 'manifest', vi.fn())).toThrow(/explicit test account ID/);
  expect(() => installNetworkGuard({ MERCADO_PAGO_ACCESS_TOKEN: 'TEST-arena', MERCADO_PAGO_MASTER_ACCESS_TOKEN: 'APP_USR-private' }, project, 'manifest', vi.fn())).toThrow(/explicit test account ID/);
});
it('does not derive buyer email from username and preserves an uncertain legacy payer', () => {
  const { controlBuyerEmail } = require('../scripts/check_homologacao_pix_control');
  expect(() => controlBuyerEmail({}, ['--buyer-username=TESTUSER123456'])).toThrow(/username/);
  expect(() => controlBuyerEmail({}, [])).toThrow(/explicit test buyer/);
  expect(controlBuyerEmail({}, ['--retry'], { payerCandidate: 'unchanged@testuser.com' })).toBe('unchanged@testuser.com');
  expect(controlBuyerEmail({ MERCADO_PAGO_TEST_BUYER_EMAIL: 'explicit@testuser.com' }, [])).toBe('explicit@testuser.com');
});
