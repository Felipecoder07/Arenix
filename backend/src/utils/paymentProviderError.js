const { httpError, publicError, hash } = require('./security');

const definitions = {
  PIX_INVALID_REQUEST: [400, 'Os dados da cobrança Pix são inválidos.', 'retry_later'],
  PIX_PROVIDER_REJECTED: [422, 'O provedor recusou a emissão do Pix. A arena precisa conferir a configuração de recebimento.', 'correct_configuration'],
  PIX_RECONCILIATION_PENDING: [409, 'A cobrança Pix está em verificação. Consulte o pagamento antes de emitir outra cobrança.', 'check_payment'],
  PIX_LEGACY_REVIEW_REQUIRED: [409, 'Não foi possível identificar com segurança a cobrança antiga desta fatura. O responsável financeiro precisa conferir o histórico no Mercado Pago antes de liberar outro Pix.', 'contact_support'],
  PIX_PROVIDER_UNAVAILABLE: [503, 'O serviço de pagamentos está temporariamente indisponível. Consulte a tentativa antes de tentar novamente.', 'check_payment'],
  PIX_PROVIDER_TIMEOUT: [504, 'O provedor não respondeu a tempo. A cobrança pode ter sido criada; consulte o pagamento.', 'check_payment'],
  PIX_PROVIDER_INVALID_RESPONSE: [502, 'Não foi possível validar a resposta do provedor. A cobrança ficará em verificação.', 'check_payment'],
  PIX_INTERNAL_ERROR: [500, 'Não foi possível concluir a emissão do Pix. Consulte o pagamento antes de tentar novamente.', 'check_payment'],
};
const trusted = new WeakSet();
function reference(value) { return value ? hash(String(value)).slice(0, 20) : undefined; }
function paymentError(code, details = {}) {
  const [status, message, action] = definitions[code] || definitions.PIX_INTERNAL_ERROR;
  const error = httpError(status, message);
  error.paymentCode = Object.hasOwn(definitions, code) ? code : 'PIX_INTERNAL_ERROR';
  error.nextAction = action;
  error.outcome = details.definitive === true ? 'definitive_rejection' : 'ambiguous';
  error.diagnostic = sanitizeDiagnostic({ ...details, category: error.paymentCode });
  trusted.add(error);
  return error;
}
function sanitizeDiagnostic(value = {}) {
  const result = {};
  if (Object.hasOwn(definitions, value.category)) result.category = value.category;
  if (Number.isInteger(value.http_status) && value.http_status >= 100 && value.http_status <= 599) result.http_status = value.http_status;
  // IDs are restricted to UUIDs: arbitrary provider strings may contain PII or credentials.
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.request_id || '')) result.request_id = value.request_id;
  if (/^[a-f0-9]{20}$/.test(value.reference || '')) result.reference = value.reference;
  if (Array.isArray(value.cause_codes)) result.cause_codes = [...new Set(value.cause_codes.map(String).filter(code => /^\d{1,8}$/.test(code)))].slice(0, 8);
  if (['invalid_users_involved', 'validation_not_found'].includes(value.provider_reason)) result.provider_reason = value.provider_reason;
  return result;
}
function responseDiagnostic(response, body) {
  // Exact provider signatures only. Never store arbitrary error messages/PII.
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  let provider_reason;
  if (/^fill and validate error list: invalid_users_involved\s*:\s*400$/.test(message)) provider_reason = 'invalid_users_involved';
  else if (/^fill and validate error list: not_found\s*:\s*400$/.test(message)) provider_reason = 'validation_not_found';
  const causes = Array.isArray(body?.cause) ? body.cause.map(item => item?.code) : [];
  if (causes.some(code => String(code) === '2034')) provider_reason = 'invalid_users_involved';
  return sanitizeDiagnostic({ http_status: response.status, cause_codes: causes,
    request_id: response.headers?.get?.('x-request-id'), provider_reason });
}
async function readPaymentResponse(response) {
  let body;
  try { body = await response.json(); }
  catch { throw paymentError('PIX_PROVIDER_INVALID_RESPONSE', { http_status: response.status }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw paymentError('PIX_PROVIDER_INVALID_RESPONSE', { http_status: response.status });
  if (response.ok) return body;
  const causes = Array.isArray(body.cause) ? body.cause.map(item => String(item?.code ?? '')) : [];
  // A documented invalid-users refusal, on the FIRST submission, proves no payment
  // only when the complete response has no payment id and all causes agree.
  const definitive = response.status === 400 && !body.id && causes.length > 0 && causes.every(code => code === '2034');
  const code = definitive ? 'PIX_PROVIDER_REJECTED'
    : response.status === 429 || response.status >= 500 ? 'PIX_PROVIDER_UNAVAILABLE'
      : 'PIX_PROVIDER_INVALID_RESPONSE';
  throw paymentError(code, {
    definitive, ...responseDiagnostic(response, body),
  });
}
function normalizePaymentError(error, operationId) {
  const normalized = trusted.has(error) ? error : paymentError('PIX_INTERNAL_ERROR');
  normalized.diagnostic = sanitizeDiagnostic({ ...normalized.diagnostic, reference: reference(operationId) });
  return normalized;
}
function paymentErrorBody(error, fallback) {
  if (!trusted.has(error)) return { error: publicError(error, fallback) };
  return { error: error.message, code: error.paymentCode, reference: error.diagnostic.reference, next_action: error.nextAction };
}
module.exports = { paymentError, readPaymentResponse, normalizePaymentError, paymentErrorBody, sanitizeDiagnostic, responseDiagnostic, reference };
