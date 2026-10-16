const { fetch } = require('../utils/providerHttp');
const { paymentError, readPaymentResponse } = require('../utils/paymentProviderError');
const pix = require('../utils/pixPayment');

function belongsToInvoice(payment, attempt) {
  return payment.metadata?.origem === 'saas_billing' &&
    String(payment.metadata.fatura_saas_id) === String(attempt.invoice_id) &&
    String(payment.metadata.tenant_id) === String(attempt.tenant_id);
}

// Older requests had invoice metadata but no external_reference. Search the
// receiving account without creating payments. An empty/partial search never
// authorizes a new charge: provider search covers only the last twelve months.
async function findPayment(attempt, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const candidates = new Set();
  let complete = false;
  const end = new Date().toISOString();
  const begin = new Date(Date.parse(end) - 364 * 86400000).toISOString();
  for (let offset = 0; offset < 1000; offset += 100) {
    const query = new URLSearchParams({ sort: 'date_created', criteria: 'desc', limit: '100',
      offset: String(offset), range: 'date_created', begin_date: begin, end_date: end });
    const body = await readPaymentResponse(await fetch(`https://api.mercadopago.com/v1/payments/search?${query}`, { headers }));
    const total = body.paging?.total;
    if (!Array.isArray(body.results) || !Number.isSafeInteger(total) || total < 0) {
      throw paymentError('PIX_LEGACY_REVIEW_REQUIRED');
    }
    for (const payment of body.results) {
      if (!belongsToInvoice(payment, attempt)) continue;
      if (!/^\d+$/.test(String(payment.id))) throw paymentError('PIX_LEGACY_REVIEW_REQUIRED');
      candidates.add(String(payment.id));
    }
    if (candidates.size > 1) throw paymentError('PIX_LEGACY_REVIEW_REQUIRED');
    if (offset + body.results.length >= total) { complete = true; break; }
    if (body.results.length !== 100) break;
  }
  if (!complete || candidates.size !== 1) throw paymentError('PIX_LEGACY_REVIEW_REQUIRED');
  const id = [...candidates][0];
  const payment = await readPaymentResponse(await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers }));
  if (String(payment.id) !== id || !belongsToInvoice(payment, attempt) || payment.payment_method_id !== 'pix' ||
      !pix.matches(payment, { amount: attempt.amount_cents, receiver: attempt.receiver_id })) {
    throw paymentError('PIX_LEGACY_REVIEW_REQUIRED');
  }
  return payment;
}

module.exports = { findPayment };
