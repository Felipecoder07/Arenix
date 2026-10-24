const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth } = fixture;
vi.spyOn(require('../src/services/emailService'), 'sendEmail').mockResolvedValue(true);
const app = require('../src/app');
const gateway = require('../src/services/gatewayService');
const intents = require('../src/services/paymentIntentService');
const errors = require('../src/utils/paymentProviderError');
const pixProvider = require('./helpers/pixProvider.cjs');
let provider;
beforeAll(fixture.initialize);
beforeEach(async () => {
  await db.runAsync('DELETE FROM FaturasSaaS');
  await fixture.seed();
  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-ARENA-TOKEN',gateway_user_id='123' WHERE id=1");
  provider = vi.fn().mockRejectedValue(new Error('Unexpected provider request'));
  vi.stubGlobal('fetch', provider);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(fixture.close);
const refusal = () => ({ ok: false, status: 400, headers: new Headers({ 'x-request-id': 'a'.repeat(8)+'-aaaa-aaaa-aaaa-'+ 'a'.repeat(12) }),
  json: async () => ({ message: 'payer@example.com TEST-SECRET', cause: [{ code: 2034, description: 'private payer' }] }) });
const approveCreation = () => provider.mockImplementationOnce(async (_url, options) => ({ ok: true, status: 201, json: async () => pixProvider(options) }));
const current = () => db.getAsync('SELECT * FROM PaymentIntents ORDER BY created DESC,rowid DESC LIMIT 1');

it('polling confirms a known online Pix without webhook within the first 30 seconds, idempotently', async () => {
  const session = await fixture.login(app);
  await db.runAsync("INSERT INTO Pagamentos(reserva_id,valor,metodo) VALUES(1,4000,'Pix')");
  await db.runAsync("UPDATE Reservas SET status_pagamento='Parcial' WHERE id=1");
  await db.runAsync("INSERT INTO TransacoesGateway(reserva_id,gateway_ref,metodo,valor,status) VALUES(1,'991','Pix',6000,'Pendente')");
  await db.runAsync("INSERT INTO PaymentIntents(id,tenant_id,reserva_id,scope,method,amount_cents,state,gateway_ref,created,updated) VALUES('polling',1,1,'group-a','Pix',6000,'pending','991',?,?)", [Date.now()-6000,Date.now()-6000]);
  provider.mockResolvedValue({ ok: true, json: async () => ({ id: 991, status: 'approved', currency_id: 'BRL', collector_id: 123, transaction_amount: 60 }) });
  for (let i=0;i<2;i++) {
    const result = await auth(request(app).get('/api/pagamentos/gateway/status/1?gateway_ref=991'), session);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status_pagamento: 'Pago', transacao_status: 'Pago' });
    expect(result.headers['cache-control']).toBe('no-store');
  }
  expect((await db.getAsync('SELECT SUM(valor) total FROM Pagamentos WHERE reserva_id=1')).total).toBe(10000);
  expect(provider).toHaveBeenCalledTimes(1);
  const foreign = await fixture.login(app, 4);
  expect((await auth(request(app).get('/api/pagamentos/gateway/status/3?gateway_ref=991'), foreign)).status).toBe(404);
});

it('records a definitive first 2034, exposes a safe 422, and permits a new corrected attempt', async () => {
  const session = await fixture.login(app);
  provider.mockResolvedValueOnce(refusal());
  const response = await auth(request(app).post('/api/pagamentos/gateway/cobranca'), session).send({ reserva_id: 1, metodo: 'Pix' });
  expect(response.status).toBe(422);
  expect(response.body).toMatchObject({ code: 'PIX_PROVIDER_REJECTED', next_action: 'correct_configuration' });
  expect(JSON.stringify(response.body)).not.toMatch(/2034|payer|SECRET/);
  const first = await current();
  expect(first.state).toBe('failed');
  expect(JSON.parse(first.diagnostic_json).cause_codes).toEqual(['2034']);
  expect(first.response_json).toBeNull();
  approveCreation();
  await gateway.criarCobrancaPix(1, 10000, 1);
  expect((await current()).id).not.toBe(first.id);
  expect((await db.getAsync('SELECT COUNT(*) AS n FROM Pagamentos')).n).toBe(0);
});

it.each([400, 401, 403, 429, 500])('keeps unclassified HTTP %i ambiguous and never resubmits on repeated emission', async status => {
  provider.mockResolvedValueOnce({ ok: false, status, json: async () => ({ cause: [{ code: 9999 }] }) });
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('outcome', 'ambiguous');
  const first = await current();
  await db.runAsync('UPDATE PaymentIntents SET updated=1 WHERE id=?', [first.id]);
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('paymentCode', 'PIX_RECONCILIATION_PENDING');
  expect(provider).toHaveBeenCalledTimes(1);
  expect((await current()).id).toBe(first.id);
  expect((await current()).state).toBe('unknown');
});

it.each([
  ['invalid_users_involved', 'invalid_users_involved'],
  ['not_found', 'validation_not_found'],
])('records the provider validation reason %s behind HTTP 500 without allowing another charge', async (remoteReason, reason) => {
  provider.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({
    error: 'internal_server_error', message: `fill and validate error list: ${remoteReason}\n: 400`, cause: [],
  }) });
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toMatchObject({ status: 503, outcome: 'ambiguous' });
  const intent = await current();
  expect(intent.state).toBe('unknown');
  expect(JSON.parse(intent.diagnostic_json).provider_reason).toBe(reason);
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('paymentCode', 'PIX_RECONCILIATION_PENDING');
  expect(provider).toHaveBeenCalledTimes(1);
});
it('does not copy arbitrary provider messages into diagnostics', () => {
  const diagnostic = errors.responseDiagnostic({ status: 500 }, {
    message: 'fill and validate error list: not_found\n: 400 payer@example.com TEST-private',
    cause: [{ code: 'private@example.com' }],
  });
  expect(diagnostic).toEqual({ http_status: 500, cause_codes: [] });
  expect(errors.sanitizeDiagnostic({ provider_reason: 'TEST-private' })).toEqual({});
});

it('distinguishes timeout and refuses to convert an empty search into a new charge', async () => {
  provider.mockRejectedValueOnce(Object.assign(new Error('secret payload'), { name: 'TimeoutError' }));
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 504);
  const first = await current();
  await db.runAsync('UPDATE PaymentIntents SET updated=1 WHERE id=?', [first.id]);
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
  await intents.consultPix(1, 1);
  expect((await current()).state).toBe('unknown');
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 409);
  expect(provider.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
});

it.each([null, [], 'private data'])('rejects malformed JSON shape without disclosing it', async body => {
  provider.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('paymentCode', 'PIX_PROVIDER_INVALID_RESPONSE');
  expect((await current()).state).toBe('unknown');
});

it('rejects invalid JSON and missing QR without registering a financial transaction', async () => {
  provider.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('private invalid body'); } });
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 502);
  expect((await db.getAsync('SELECT COUNT(*) AS n FROM TransacoesGateway')).n).toBe(0);
});

it.each([{ collector_id: 456 }, { transaction_amount: 1 }, { currency_id: 'USD' }, { external_reference: 'another-intent' }])('blocks mismatched provider creation %j', async mismatch => {
  provider.mockImplementationOnce(async (_url, options) => ({ ok: true, json: async () => pixProvider(options, mismatch) }));
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 502);
  expect((await db.getAsync('SELECT COUNT(*) AS n FROM TransacoesGateway')).n).toBe(0);
});

it('preserves paid state when the original caller fails after a concurrent settlement', async () => {
  await expect(intents.withIntent('Pix', 1, 10000, 1, async key => {
    await db.runAsync("INSERT INTO TransacoesGateway(reserva_id,gateway_ref,valor,status,metodo) VALUES(1,'991',10000,'Pendente','Pix')");
    await db.runAsync("UPDATE PaymentIntents SET gateway_ref='991' WHERE id=?", [key]);
    await require('../src/services/paymentLedgerService').settle('991', { valor_pago: 10000 });
    throw new Error('late persistence response failed');
  })).rejects.toHaveProperty('status', 500);
  expect((await current()).state).toBe('paid');
  expect((await db.getAsync('SELECT SUM(valor) AS n FROM Pagamentos')).n).toBe(10000);
});

it('serializes concurrent requests through the persisted intent', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  provider.mockImplementationOnce(async (_url, options) => {
    entered();
    await new Promise(resolve => { release = resolve; });
    return { ok: true, json: async () => pixProvider(options) };
  });
  const first = gateway.criarCobrancaPix(1, 10000, 1);
  await started;
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 409);
  release();
  await first;
  expect(provider).toHaveBeenCalledTimes(1);
});

it('recovers a remotely created payment after transaction persistence fails', async () => {
  let sent;
  provider.mockImplementationOnce(async (_url, options) => { sent = pixProvider(options); return { ok: true, json: async () => sent }; });
  const original = db.runAsync;
  const spy = vi.spyOn(db, 'runAsync').mockImplementation(function(sql, params) {
    if (sql.includes('INSERT OR IGNORE INTO TransacoesGateway')) return Promise.reject(new Error('disk failure'));
    return original.call(this, sql, params);
  });
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toHaveProperty('status', 500);
  spy.mockRestore();
  const intent = await current();
  expect(intent.state).toBe('unknown');
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [sent] }) });
  provider.mockResolvedValueOnce({ ok: true, json: async () => sent });
  await gateway.reconciliarPagamentoSemReferencia(intent.id);
  expect(intents.cachedResponse(await current()).gateway_ref).toBe('991');
  expect(provider.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
});

it('persists an encrypted payer snapshot when a keyring exists', async () => {
  vi.stubEnv('SECRETS_KEYRING', JSON.stringify({ fixture: 'b'.repeat(64) }));
  vi.stubEnv('SECRETS_ACTIVE_KEY_ID', 'fixture');
  approveCreation();
  await gateway.criarCobrancaPix(1, 10000, 1);
  const intent = await current();
  expect(intent.request_encrypted).toMatch(/^enc:v2:/);
  expect(intent.request_encrypted).not.toContain('owner@example');
  expect(JSON.parse(require('../src/utils/security').decrypt(intent.request_encrypted)).external_reference).toBe(intent.id);
});

it('exposes diagnostic only to the owning arena manager', async () => {
  provider.mockResolvedValueOnce(refusal());
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toThrow();
  const admin = await fixture.login(app);
  expect((await auth(request(app).get('/api/pagamentos/gateway/diagnostico/1'), admin)).body.diagnostic.cause_codes).toEqual(['2034']);
  const foreign = await fixture.login(app, fixture.actors.otherAdmin);
  expect((await auth(request(app).get('/api/pagamentos/gateway/diagnostico/1'), foreign)).status).toBe(404);
});

it('sanitizes diagnostics without logging provider messages or arbitrary IDs', () => {
  const diagnostic = errors.sanitizeDiagnostic({ http_status: 400, cause_codes: ['2034','12345678901','TEST-secret'],
    request_id: 'payer@example.com', reference: 'TEST-secret', message: 'CPF and token', category: 'PIX_PROVIDER_REJECTED' });
  expect(diagnostic).toEqual({ http_status: 400, cause_codes: ['2034'], category: 'PIX_PROVIDER_REJECTED' });
});

async function invoice() {
  return (await db.runAsync("INSERT INTO FaturasSaaS(tenant_id,plano_id,valor,status,data_vencimento) VALUES(1,1,10000,'Pendente','2099-01-01')")).lastID;
}
it('recovers reservation QR with tenant authorization and without another POST', async () => {
  approveCreation();
  await gateway.criarCobrancaPix(1, 10000, 1);
  const admin = await fixture.login(app);
  const response = await auth(request(app).get('/api/pagamentos/gateway/pix/1'), admin);
  expect(response.status).toBe(200);
  expect(response.body.pix.gateway_ref).toBe('991');
  const foreign = await fixture.login(app, fixture.actors.otherAdmin);
  expect((await auth(request(app).get('/api/pagamentos/gateway/pix/1'), foreign)).status).toBe(403);
  expect(provider).toHaveBeenCalledTimes(1);
});

it('recovers SaaS QR only for the owning arena without another POST', async () => {
  const id = await invoice();
  approveCreation();
  await require('../src/services/saasBillingService').gerarPixFaturaSaaS(id);
  const admin = await fixture.login(app);
  const response = await auth(request(app).get(`/api/tenant/assinatura/faturas/${id}/pix`), admin);
  expect(response.status).toBe(200);
  expect(response.body.pix.gateway_ref).toBe('991');
  const foreign = await fixture.login(app, fixture.actors.otherAdmin);
  expect((await auth(request(app).get(`/api/tenant/assinatura/faturas/${id}/pix`), foreign)).status).toBe(404);
  expect(provider).toHaveBeenCalledTimes(1);
});
it('keeps SaaS timeout tied to the original key and recovers through search', async () => {
  const id = await invoice();
  let sent;
  provider.mockImplementationOnce(async (_url, options) => { sent = pixProvider(options); throw Object.assign(new Error('lost'), { name: 'TimeoutError' }); });
  await expect(require('../src/services/saasBillingService').gerarPixFaturaSaaS(id)).rejects.toHaveProperty('status', 504);
  await db.runAsync('UPDATE SaasPixAttempts SET updated=1 WHERE invoice_id=?', [id]);
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [sent] }) });
  provider.mockResolvedValueOnce({ ok: true, json: async () => sent });
  await require('../src/services/saasPixService').consult(id);
  expect((await db.getAsync('SELECT gateway_ref FROM FaturasSaaS WHERE id=?', [id])).gateway_ref).toBe('991');
  expect(provider.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
});

it('does not reissue a legacy SaaS charge without reference or proof of absence', async () => {
  const id = await invoice();
  await db.runAsync('INSERT INTO SaasPixLegacyInvoices(invoice_id) VALUES(?)', [id]);
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], paging: { total: 0 } }) });
  await expect(require('../src/services/saasBillingService').gerarPixFaturaSaaS(id)).rejects.toHaveProperty('paymentCode', 'PIX_LEGACY_REVIEW_REQUIRED');
  expect(provider).toHaveBeenCalledTimes(1);
  expect(provider.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
});

it('recovers legacy SaaS Pix using invoice metadata across pages without issuing another charge', async () => {
  const id = await invoice();
  await db.runAsync('INSERT INTO SaasPixLegacyInvoices(invoice_id) VALUES(?)', [id]);
  const payment = pixProvider({ body: JSON.stringify({ transaction_amount: 100 }) }, {
    payment_method_id: 'pix', metadata: { origem: 'saas_billing', fatura_saas_id: id, tenant_id: 1 },
  });
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: Array.from({ length: 100 }, (_, n) => ({ id: n + 1, metadata: {} })), paging: { total: 101 } }) });
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [payment], paging: { total: 101 } }) });
  provider.mockResolvedValueOnce({ ok: true, json: async () => payment });
  const result = await require('../src/services/saasBillingService').gerarPixFaturaSaaS(id);
  expect(result.copia_cola).toBe('fixture-pix');
  expect((await db.getAsync('SELECT gateway_ref FROM FaturasSaaS WHERE id=?', [id])).gateway_ref).toBe('991');
  expect(provider.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
});

it.each(['multiple', 'wrong_receiver', 'wrong_amount', 'wrong_metadata', 'incomplete'])('keeps ambiguous legacy recovery blocked: %s', async reason => {
  const id = await invoice();
  await db.runAsync('INSERT INTO SaasPixLegacyInvoices(invoice_id) VALUES(?)', [id]);
  const payment = pixProvider({ body: JSON.stringify({ transaction_amount: 100 }) }, {
    payment_method_id: 'pix', metadata: { origem: 'saas_billing', fatura_saas_id: id, tenant_id: 1 },
  });
  const results = reason === 'multiple' ? [payment, { ...payment, id: 992 }] : [payment];
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results, paging: { total: reason === 'incomplete' ? 20 : results.length } }) });
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ ...payment,
    ...(reason === 'wrong_receiver' ? { collector_id: 456 } : {}),
    ...(reason === 'wrong_amount' ? { transaction_amount: 10000 } : {}),
    ...(reason === 'wrong_metadata' ? { metadata: { ...payment.metadata, tenant_id: 2 } } : {}),
  }) });
  await expect(require('../src/services/saasBillingService').gerarPixFaturaSaaS(id)).rejects.toHaveProperty('paymentCode', 'PIX_LEGACY_REVIEW_REQUIRED');
  expect((await db.getAsync('SELECT gateway_ref FROM FaturasSaaS WHERE id=?', [id])).gateway_ref).toBeNull();
  expect(provider.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
});

it('returns actionable legacy review diagnostics from the tenant consultation', async () => {
  const id = await invoice();
  await db.runAsync('INSERT INTO SaasPixLegacyInvoices(invoice_id) VALUES(?)', [id]);
  provider.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], paging: { total: 0 } }) });
  await expect(require('../src/services/saasBillingService').gerarPixFaturaSaaS(id)).rejects.toHaveProperty('status', 409);
  const session = await fixture.login(app);
  const response = await auth(request(app).get(`/api/tenant/assinatura/faturas/${id}/pix`), session);
  expect(response.body.payment_error).toMatchObject({ code: 'PIX_LEGACY_REVIEW_REQUIRED', next_action: 'contact_support' });
  expect(response.body.pix).toBeNull();
});

it('blocks cached SaaS QR after an invoice amount changes', async () => {
  const id = await invoice();
  approveCreation();
  const billing = require('../src/services/saasBillingService');
  await billing.gerarPixFaturaSaaS(id);
  await db.runAsync('UPDATE FaturasSaaS SET valor=20000 WHERE id=?', [id]);
  await expect(billing.gerarPixFaturaSaaS(id)).rejects.toHaveProperty('status', 409);
  expect(provider).toHaveBeenCalledTimes(1);
});

it('allows paid SaaS attempts to become refunded and never regress on an older pending event', async () => {
  const id = await invoice();
  approveCreation();
  await require('../src/services/saasBillingService').gerarPixFaturaSaaS(id);
  await db.runAsync("UPDATE SaasPixAttempts SET state='paid' WHERE invoice_id=?", [id]);
  const attempt = await db.getAsync('SELECT * FROM SaasPixAttempts WHERE invoice_id=?', [id]);
  const settlement = vi.spyOn(require('../src/services/saasSettlementService'), 'registrarEstorno').mockResolvedValue({});
  const payment = { id: 991, currency_id: 'BRL', transaction_amount: 100, collector_id: 123, external_reference: attempt.id, status: 'refunded' };
  await require('../src/services/saasPixService').savePayment(attempt, payment);
  expect((await db.getAsync('SELECT state FROM SaasPixAttempts WHERE id=?', [attempt.id])).state).toBe('refunded');
  await require('../src/services/saasPixService').savePayment(attempt, { ...payment, status: 'pending' });
  expect((await db.getAsync('SELECT state FROM SaasPixAttempts WHERE id=?', [attempt.id])).state).toBe('refunded');
  expect(settlement).toHaveBeenCalledTimes(1);
});

it('migrates repeatedly without changing historical intent state', async () => {
  provider.mockResolvedValueOnce(refusal());
  await expect(gateway.criarCobrancaPix(1, 10000, 1)).rejects.toThrow();
  const before = await current();
  await require('../src/config/migrations/pixDiagnostics').migratePixDiagnostics(db);
  await require('../src/config/migrations/pixDiagnostics').migratePixDiagnostics(db);
  expect(await current()).toEqual(before);
});
