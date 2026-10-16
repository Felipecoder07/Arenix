// A test account can have APP_USR credentials. Its prefix alone is never proof
// that a payment is synthetic: require a pinned identity and provider test tag.
function configuredCredentials(settings) {
  return [
    { token: settings.MERCADO_PAGO_ACCESS_TOKEN, accountId: settings.MERCADO_PAGO_TEST_SELLER_ID },
    { token: settings.MERCADO_PAGO_MASTER_ACCESS_TOKEN, accountId: settings.MERCADO_PAGO_TEST_MASTER_ID },
  ].filter(entry => entry.token);
}
function validateTestCredentials(settings) {
  if (!settings.MERCADO_PAGO_ACCESS_TOKEN) throw new Error('Test arena credential required.');
  for (const { token, accountId } of configuredCredentials(settings)) {
    if (typeof token !== 'string' || !/^(TEST-|APP_USR-)/.test(token)) throw new Error('Unsupported test credential format.');
    if (accountId && !/^\d+$/.test(String(accountId))) throw new Error('Invalid test account ID.');
    if (token.startsWith('APP_USR-') && !/^\d+$/.test(String(accountId || ''))) {
      throw new Error('APP_USR homologation requires an explicit test account ID.');
    }
  }
}
function verifyConfiguredIdentity(settings, token, account) {
  validateTestCredentials(settings);
  const entries = configuredCredentials(settings).filter(entry => entry.token === token);
  if (!entries.length || !/^\d+$/.test(String(account?.id)) || account.site_id !== 'MLB' ||
      entries.some(entry => entry.accountId && String(entry.accountId) !== String(account.id)) ||
      (token.startsWith('APP_USR-') && !account.tags?.includes('test_user'))) {
    throw new Error('Test account identity was not confirmed.');
  }
}
module.exports = { configuredCredentials, validateTestCredentials, verifyConfiguredIdentity };
