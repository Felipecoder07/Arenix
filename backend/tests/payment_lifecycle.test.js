const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, signedWebhook } = fixture;
vi.spyOn(require('../src/services/emailService'), 'sendEmail').mockResolvedValue(true);
const app = require('../src/app');
const gateway = require('../src/services/gatewayService');
const { processarOutbox } = require('../src/jobs/reconciliacaoOutbox');
let provider;

beforeAll(fixture.initialize);
beforeEach(async () => {
  await fixture.seed();
  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-ARENA-TOKEN',gateway_user_id='123' WHERE id=1");
  provider = vi.fn().mockRejectedValue(new Error('Unexpected provider call'));
  vi.stubGlobal('fetch', provider);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(fixture.close);

const payment = (overrides = {}) => ({ id: 991, status: 'approved', currency_id: 'BRL', collector_id: 123, transaction_amount: 100, ...overrides });
const respond = body => provider.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
const balance = () => db.getAsync('SELECT COUNT(*) AS count,COALESCE(SUM(valor),0) AS total FROM Pagamentos');
async function card(session) {
  return auth(request(app).post('/api/pagamentos/gateway/cobranca'), session)
    .send({ reserva_id: 1, metodo: 'Cartão', card_data: { token: 'fixture-card', payment_method_id: 'visa' } });
}
async function pending() {
  await db.runAsync("INSERT INTO TransacoesGateway(reserva_id,gateway_ref,metodo,valor,status) VALUES(1,'991','Pix',10000,'Pendente')");
  await db.runAsync("INSERT INTO PaymentIntents(id,tenant_id,reserva_id,scope,method,amount_cents,state,gateway_ref,created,updated) VALUES('lifecycle',1,1,'group-a','Pix',10000,'pending','991',1,1)");
}

it.each([{ transaction_amount: 1 }, { currency_id: 'USD' }, { collector_id: 999 }, { id: 'invalid' }])('does not credit an immediate card approval with mismatched identity or amount: %j', async mismatch => {
  const session = await fixture.login(app);
  respond(payment(mismatch));
  expect((await card(session)).status).toBeGreaterThanOrEqual(400);
  expect(await balance()).toEqual({ count: 0, total: 0 });
  expect(await db.getAsync('SELECT COUNT(*) AS count FROM GatewayCredits')).toEqual({ count: 0 });
});

it('allows a new attempt after a terminal card rejection and credits approval only once', async () => {
  const session = await fixture.login(app);
  respond(payment({ status: 'rejected' }));
  expect((await card(session)).body.status).toBe('rejected');
  expect(await balance()).toEqual({ count: 0, total: 0 });
  respond(payment({ id: 992 }));
  expect((await card(session)).body.status).toBe('approved');
  expect(await balance()).toEqual({ count: 1, total: 10000 });
  for (let i = 0; i < 2; i++) {
    respond(payment({ id: 992 }));
    expect((await signedWebhook(app, 992)).status).toBe(200);
  }
  expect(await balance()).toEqual({ count: 1, total: 10000 });
  expect(await db.allAsync('SELECT state FROM PaymentIntents ORDER BY gateway_ref')).toEqual([{ state: 'failed' }, { state: 'paid' }]);
  const keys = provider.mock.calls.filter(([, options]) => options.method === 'POST').map(([, options]) => options.headers['X-Idempotency-Key']);
  expect(new Set(keys).size).toBe(2);
});

it.each([100, 40])('reconciles a refund arriving before approval, including replay (%s reais)', async amount => {
  await pending();
  for (let i = 0; i < 2; i++) {
    respond(payment({ status: amount === 100 ? 'refunded' : 'approved', transaction_amount_refunded: amount }));
    expect((await signedWebhook(app, 991)).status).toBe(200);
  }
  expect(await balance()).toEqual({ count: 2, total: 10000 - amount * 100 });
  expect(await db.getAsync('SELECT COUNT(*) AS count FROM GatewayCredits')).toEqual({ count: 1 });
  expect((await db.getAsync("SELECT state FROM PaymentIntents WHERE id='lifecycle'")).state).toBe('paid');
});

it('recovers after a failed webhook and a lost refund response without duplicate postings', async () => {
  await pending();
  provider.mockRejectedValueOnce(new Error('fixture timeout'));
  expect((await signedWebhook(app, 991)).status).toBe(503);
  expect(await balance()).toEqual({ count: 0, total: 0 });
  respond(payment());
  expect(await processarOutbox({ olderThanMs: 0 })).toMatchObject({ completed: 1, errors: 0 });
  respond(payment());
  expect((await signedWebhook(app, 991)).status).toBe(200);
  expect(await balance()).toEqual({ count: 1, total: 10000 });
  provider.mockRejectedValueOnce(new Error('fixture refund response lost'));
  expect(await gateway.estornarPagamentoPix(1, 1)).toMatchObject({ success: false, reason: 'pending_reconciliation' });
  expect(await balance()).toEqual({ count: 1, total: 10000 });
  const refundKey = provider.mock.calls.at(-1)[1].headers['X-Idempotency-Key'];
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  expect(await processarOutbox({ olderThanMs: 0 })).toMatchObject({ refunds: 1, completed: 1, errors: 0 });
  expect(provider.mock.calls.at(-1)[1].headers['X-Idempotency-Key']).toBe(refundKey);
  for (let i = 0; i < 2; i++) {
    respond(payment({ status: 'refunded', transaction_amount_refunded: 100 }));
    expect((await signedWebhook(app, 991)).status).toBe(200);
  }
  expect(await processarOutbox({ olderThanMs: 0 })).toMatchObject({ payments: 0, refunds: 0 });
  expect(await balance()).toEqual({ count: 2, total: 0 });
});

it('does not reverse a refund response identifying a different payment', async () => {
  await pending();
  respond(payment());
  expect((await signedWebhook(app, 991)).status).toBe(200);
  respond({ id: 701, payment_id: 999, amount: 100, status: 'approved' });
  expect(await gateway.estornarPagamentoPix(1, 1)).toMatchObject({ success: false });
  expect(await balance()).toEqual({ count: 1, total: 10000 });
});
