const fs = require('node:fs');
const path = require('node:path');
const { validateTestCredentials, verifyConfiguredIdentity } = require('./homologacao_credentials.cjs');
function installNetworkGuard(config, target, version, network = global.fetch) {
  validateTestCredentials(config);
  const configured = [config.MERCADO_PAGO_ACCESS_TOKEN, config.MERCADO_PAGO_MASTER_ACCESS_TOKEN].filter(Boolean);
  const validated = new Set();
  const allowedAccounts = new Set(String(config.OAUTH_TEST_ACCOUNT_IDS || '').split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id)));
  async function identity(token, oauth = false) {
    const response = await network('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    const account = await response.json();
    if (!response.ok || !/^\d+$/.test(String(account.id)) || account.site_id !== 'MLB' ||
      (oauth && (!allowedAccounts.has(String(account.id)) || !account.tags?.includes('test_user')))) {
      throw new Error('Test account identity was not confirmed.');
    }
    if (!oauth) verifyConfiguredIdentity(config, token, account);
    validated.add(token);
    return account;
  }
  return async function guardedFetch(input, options = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = options.method || 'GET';
    if (url.origin !== 'https://api.mercadopago.com' || url.username || url.password) throw new Error('Provider destination denied.');
    const oauth = url.pathname === '/oauth/token' && method === 'POST';
    if (oauth) {
      const body = JSON.parse(options.body || '{}');
      if (!config.MERCADO_PAGO_CLIENT_ID || !config.HOMOLOGACAO_OAUTH_SECRET || !allowedAccounts.size ||
        body.client_id !== config.MERCADO_PAGO_CLIENT_ID || body.client_secret !== config.HOMOLOGACAO_OAUTH_SECRET ||
        body.redirect_uri !== config.MERCADO_PAGO_REDIRECT_URI || body.grant_type !== 'authorization_code') throw new Error('OAuth test configuration incomplete.');
    } else {
      if (!((method === 'GET' && /^\/(users\/me|v1\/payments(?:\/search|\/\d+)?)$/.test(url.pathname)) ||
        (method === 'POST' && /^\/v1\/payments(?:\/\d+\/refunds)?$/.test(url.pathname)))) throw new Error('Provider operation denied.');
      const authorization = new Headers(options.headers).get('authorization') || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!configured.includes(token) && !validated.has(token)) throw new Error('Unverified credential denied.');
      if (!validated.has(token)) await identity(token);
    }
    const response = await network(input, { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(15000) });
    const body = await response.clone().json().catch(() => ({}));
    if (oauth && response.ok) {
      if (typeof body.access_token !== 'string') throw new Error('OAuth token missing.');
      await identity(body.access_token, true);
    }
    const safe = require('../src/utils/paymentProviderError').responseDiagnostic(response, body);
    fs.appendFileSync(path.join(target, 'provider-checks.jsonl'), JSON.stringify({ at: new Date().toISOString(), version,
      method, path: oauth ? '/oauth/token' : url.pathname, ...safe,
      ...(typeof body.live_mode === 'boolean' ? { liveMode: body.live_mode } : {}),
    }) + '\n');
    if (body.live_mode === true) throw new Error('Unexpected live payment. Stop and reconcile externally.');
    return response;
  };
}
module.exports = { installNetworkGuard };
