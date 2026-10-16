const { cents, hash, encrypt } = require('./security');
const { paymentError } = require('./paymentProviderError');
function matches(payment, { amount, receiver, reference }) {
  try {
    return /^\d+$/.test(String(payment.id ?? '')) && payment.currency_id === 'BRL' &&
      cents(payment.transaction_amount) === amount && String(payment.collector_id) === String(receiver) &&
      (!reference || payment.external_reference === reference);
  } catch { return false; }
}
function pixResponse(payment) {
  const data = payment.point_of_interaction?.transaction_data;
  const expiry = Date.parse(payment.date_of_expiration);
  if (payment.status !== 'pending' || !data?.qr_code || !Number.isFinite(expiry) || expiry <= Date.now()) {
    throw paymentError('PIX_RECONCILIATION_PENDING');
  }
  return {
    gateway_ref: String(payment.id), copia_cola: data.qr_code,
    qr_code: data.qr_code_base64 ? `data:image/png;base64,${data.qr_code_base64}` : null,
    expira_em: new Date(expiry).toISOString(),
  };
}
function requestSnapshot(payload) {
  const serialized = JSON.stringify(payload);
  // Never persist payer PII as plaintext, even when local credential encryption
  // allows development plaintext. Unknown attempts are queried, never resubmitted.
  const encrypted = encrypt(serialized);
  return { encrypted: encrypted.startsWith('enc:') ? encrypted : null, hash: hash(serialized) };
}
module.exports = { matches, pixResponse, requestSnapshot };
