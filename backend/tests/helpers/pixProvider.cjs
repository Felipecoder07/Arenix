module.exports = function pixProvider(options, overrides = {}) {
  const payload = JSON.parse(options.body);
  return { id: 991, status: 'pending', currency_id: 'BRL', collector_id: 123,
    transaction_amount: payload.transaction_amount, external_reference: payload.external_reference,
    date_of_expiration: new Date(Date.now() + 86400000).toISOString(),
    point_of_interaction: { transaction_data: { qr_code_base64: 'dGVzdA==', qr_code: 'fixture-pix' } }, ...overrides };
};
