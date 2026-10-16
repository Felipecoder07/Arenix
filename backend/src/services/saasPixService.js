const db = require('../config/database');
const { fetch } = require('../utils/providerHttp');
const { hash, secret, httpError } = require('../utils/security');
const { paymentError, readPaymentResponse, normalizePaymentError } = require('../utils/paymentProviderError');
const pix = require('../utils/pixPayment');

async function masterReceiver(token) {
  const row = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave='mp_master_identity'");
  let cached;
  try { cached = JSON.parse(row?.valor || 'null'); } catch { /* Refresh invalid cache. */ }
  const fingerprint = hash(token);
  if (cached?.fingerprint === fingerprint && /^\d+$/.test(cached.id)) return cached.id;
  const id = await require('./gatewayService').consultarContaGateway(token);
  await db.runAsync("INSERT INTO ConfiguracoesSaaS(chave,valor) VALUES('mp_master_identity',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
    [JSON.stringify({ id, fingerprint })]);
  return id;
}
async function savePayment(attempt, payment) {
  if (!pix.matches(payment, { amount: attempt.amount_cents, receiver: attempt.receiver_id,
    reference: attempt.legacy ? null : attempt.id })) throw paymentError('PIX_PROVIDER_INVALID_RESPONSE');
  const ref = String(payment.id);
  let response = null;
  try { response = pix.pixResponse(payment); } catch { /* Final payments have no usable QR. */ }
  await db.transaction(async () => {
    const invoice = await db.getAsync('SELECT * FROM FaturasSaaS WHERE id=? AND tenant_id=?', [attempt.invoice_id, attempt.tenant_id]);
    if (!invoice || invoice.valor !== attempt.amount_cents || (invoice.gateway_ref && invoice.gateway_ref !== ref)) {
      throw httpError(409, 'Fatura alterada durante a emissão. Consulte o pagamento antes de tentar novamente.');
    }
    if (invoice.status === 'Paga' && invoice.metodo_pagamento === 'Manual') {
      throw httpError(409, 'Fatura alterada durante a emissão. Concilie o recebimento com a baixa manual.');
    }
    if (response && (!['Pendente','Atrasada'].includes(invoice.status) || invoice.gateway_estornado_ref === ref)) {
      throw httpError(409, 'Fatura alterada durante a emissão. Consulte o pagamento.');
    }
    await db.runAsync(`UPDATE FaturasSaaS SET gateway_ref=?,copia_cola=COALESCE(?,copia_cola),
      qr_expira_em=COALESCE(?,qr_expira_em),metodo_pagamento='Pix Online' WHERE id=?`,
    [ref, response?.copia_cola || null, response?.expira_em || null, invoice.id]);
    const state = payment.status === 'approved' ? 'paid'
      : ['refunded','charged_back'].includes(payment.status) ? 'refunded'
        : ['rejected','cancelled'].includes(payment.status) ? 'failed' : 'pending';
    await db.runAsync(`UPDATE SaasPixAttempts SET gateway_ref=?,response_json=?,state=CASE
      WHEN state='refunded' THEN state WHEN ?='refunded' THEN 'refunded'
      WHEN state='paid' THEN state ELSE ? END,updated=?
      WHERE id=?`, [ref, response ? JSON.stringify(response) : null, state, state, Date.now(), attempt.id]);
    if (payment.status === 'approved') await require('./saasBillingService').liquidarFaturaSaaS(ref, payment);
    if (['refunded','charged_back'].includes(payment.status)) await require('./saasSettlementService').registrarEstorno(ref, payment);
  });
  return response;
}
async function recordFailure(attempt, error) {
  const failure = normalizePaymentError(error, attempt.id);
  const definitive = failure.outcome === 'definitive_rejection' && !attempt.legacy && attempt.state === 'creating';
  await db.runAsync(`UPDATE SaasPixAttempts SET state=CASE WHEN state='pending' THEN state ELSE ? END,diagnostic_json=?,updated=?
    WHERE id=? AND state IN ('creating','unknown','pending')`,
  [definitive ? 'failed' : 'unknown', JSON.stringify(failure.diagnostic), Date.now(), attempt.id]);
  require('../utils/safeLogger').payment(failure.diagnostic);
  // Preserve trusted local conflicts while retaining the attempt for review.
  return error.status === 409 && !error.paymentCode ? error : failure;
}
async function reconcile(attempt) {
  const token = await require('./saasBillingService').getMasterAccessToken();
  if (!token || attempt.credential_fingerprint !== hash(token)) throw paymentError('PIX_RECONCILIATION_PENDING');
  let payment;
  if (attempt.gateway_ref) {
    payment = await readPaymentResponse(await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(attempt.gateway_ref)}`,
      { headers: { Authorization: 'Bearer ' + token } }));
  } else if (attempt.legacy) {
    payment = await require('./saasLegacyPixService').findPayment(attempt, token);
  } else {
    const search = await readPaymentResponse(await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(attempt.id)}&limit=10`,
      { headers: { Authorization: 'Bearer ' + token } }));
    const results = Array.isArray(search.results) ? search.results.filter(item => item.external_reference === attempt.id) : [];
    if (results.length !== 1) throw paymentError('PIX_RECONCILIATION_PENDING');
    payment = await readPaymentResponse(await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(results[0].id))}`,
      { headers: { Authorization: 'Bearer ' + token } }));
  }
  return savePayment(attempt, payment);
}
async function consult(invoiceId) {
  await require('../config/securitySchema').ensureSecuritySchema(db);
  const attempt = await db.getAsync('SELECT * FROM SaasPixAttempts WHERE invoice_id=? ORDER BY created DESC,rowid DESC LIMIT 1', [invoiceId]);
  if (!attempt || !['creating','unknown','pending'].includes(attempt.state) || Date.now() - attempt.updated < 30000) return attempt;
  const now = Date.now();
  const claim = await db.runAsync(`UPDATE SaasPixAttempts SET next_reconcile=?,last_reconciled=?,reconcile_count=reconcile_count+1
    WHERE id=? AND (next_reconcile IS NULL OR next_reconcile<=?)`, [now + 30000, now, attempt.id, now]);
  if (claim.changes) {
    try { await reconcile(attempt); }
    catch (error) { await recordFailure({ ...attempt, state: 'unknown' }, error); }
  }
  return db.getAsync('SELECT * FROM SaasPixAttempts WHERE id=?', [attempt.id]);
}
async function issue(invoice, token) {
  await require('../config/securitySchema').ensureSecuritySchema(db);
  const receiver = await masterReceiver(token);
  const selected = await db.transaction(async () => {
    const existing = await db.getAsync("SELECT * FROM SaasPixAttempts WHERE invoice_id=? AND state IN ('creating','pending','unknown','paid')", [invoice.id]);
    if (existing) return { existing };
    const legacy = Boolean(invoice.gateway_ref || await db.getAsync('SELECT 1 FROM SaasPixLegacyInvoices WHERE invoice_id=?', [invoice.id]));
    const id = legacy ? 'saas-invoice-' + invoice.id + '-' + Math.round(invoice.valor * 100) : 'saas-pix-' + secret();
    // A legacy key is never rotated based on an ambiguous historical result.
    if (await db.getAsync('SELECT 1 FROM SaasPixAttempts WHERE id=?', [id])) throw paymentError('PIX_RECONCILIATION_PENDING');
    const payload = { transaction_amount: invoice.valor / 100,
      description: `Mensalidade SaaS Arenix — Fatura #${invoice.id}`, payment_method_id: 'pix',
      external_reference: id, date_of_expiration: new Date(Date.now() + 86400000).toISOString(),
      payer: { email: invoice.arena_email || 'arena@arenix.com.br' },
      metadata: { fatura_saas_id: invoice.id, tenant_id: invoice.tenant_id, origem: 'saas_billing' } };
    const snapshot = pix.requestSnapshot(payload);
    await db.runAsync(`INSERT INTO SaasPixAttempts(id,invoice_id,tenant_id,amount_cents,receiver_id,credential_fingerprint,
      gateway_ref,request_encrypted,request_hash,legacy,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, invoice.id, invoice.tenant_id, invoice.valor, receiver, hash(token), invoice.gateway_ref || null,
      snapshot.encrypted, snapshot.hash, Number(legacy), Date.now(), Date.now()]);
    return { attempt: await db.getAsync('SELECT * FROM SaasPixAttempts WHERE id=?', [id]), payload };
  });
  if (selected.existing) {
    if (selected.existing.amount_cents !== invoice.valor || selected.existing.tenant_id !== invoice.tenant_id ||
        selected.existing.credential_fingerprint !== hash(token) || String(selected.existing.receiver_id) !== String(receiver)) {
      throw normalizePaymentError(paymentError('PIX_RECONCILIATION_PENDING'), selected.existing.id);
    }
    const attempt = await consult(invoice.id);
    if (attempt?.state === 'pending' && attempt.response_json) {
      let response;
      try { response = JSON.parse(attempt.response_json); } catch { /* Keep invalid cache blocked. */ }
      if (response?.copia_cola && Date.parse(response.expira_em) > Date.now()) return { ...response, reutilizado: true };
    }
    let code = 'PIX_RECONCILIATION_PENDING';
    try {
      if (JSON.parse(attempt?.diagnostic_json || '{}').category === 'PIX_LEGACY_REVIEW_REQUIRED') code = 'PIX_LEGACY_REVIEW_REQUIRED';
    } catch { /* Keep the conservative default for older diagnostics. */ }
    throw normalizePaymentError(paymentError(code), selected.existing.id);
  }
  const { attempt, payload } = selected;
  try {
    let response;
    if (attempt.legacy) response = await reconcile(attempt);
    else {
      const payment = await readPaymentResponse(await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Idempotency-Key': attempt.id },
        body: JSON.stringify(payload),
      }));
      response = await savePayment(attempt, payment);
    }
    if (!response) throw httpError(409, 'Pix encerrado, expirado ou indisponível. Consulte o pagamento da fatura.');
    return { ...response, reutilizado: Boolean(attempt.legacy) };
  } catch (error) { throw await recordFailure(attempt, error); }
}
module.exports = { issue, consult, masterReceiver, savePayment };
