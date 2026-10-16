const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, signedWebhook } = fixture;
vi.spyOn(require('../src/services/emailService'), 'sendEmail').mockResolvedValue(true);
const app = require('../src/app');
const gateway = require('../src/services/gatewayService');
let provider, admin;
const respond = body => provider.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
const payment = overrides => ({ id: 991, status: 'approved', currency_id: 'BRL', collector_id: 123, transaction_amount: 100, ...overrides });
const balance = () => db.getAsync('SELECT COALESCE(SUM(valor),0) AS total,COUNT(*) AS count FROM Pagamentos');
const quote = async (id = 1, session = admin) => auth(request(app).get(`/api/pagamentos/reserva/${id}/estorno`), session);
const refund = (q, extra = {}, session = admin) => auth(request(app).post('/api/pagamentos/estorno'), session)
  .send({ reserva_id: 1, valor: q.valor_centavos / 100, confirmacao: q.confirmacao, motivo: 'Pedido do cliente', ...extra });

beforeAll(fixture.initialize);
beforeEach(async () => {
  await fixture.seed();
  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-ARENA-TOKEN',gateway_user_id='123' WHERE id=1");
  provider = vi.fn().mockRejectedValue(new Error('Unexpected provider request'));
  vi.stubGlobal('fetch', provider);
  admin = await fixture.login(app);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(fixture.close);

async function paid({ grouped = false } = {}) {
  if (!grouped) await db.runAsync('UPDATE Reservas SET grupo_id=NULL WHERE id=1');
  const owner = await fixture.login(app, fixture.actors.owner);
  provider.mockImplementationOnce(async (_url, options) => ({ ok: true, status: 200,
    json: async () => require('./helpers/pixProvider.cjs')(options) }));
  const created = await auth(request(app).post('/api/pagamentos/gateway/cobranca'), owner).send({ reserva_id: 1, metodo: 'Pix' });
  expect(created.status).toBe(200);
  respond(payment());
  expect((await signedWebhook(app, 991)).status).toBe(200);
  provider.mockClear();
}

it.each([false, true])('refunds customer Pix from the manager and completes a requested cancellation (%s)', async cancel => {
  await paid();
  if (cancel) {
    const response = await auth(request(app).patch('/api/reservas/1/cancelar'), admin).send({ motivo: -1 });
    expect(response.status).toBe(202);
    expect(response.body.pending).toBe(true);
    expect((await balance()).total).toBe(10000);
  }
  const q = await quote();
  expect(q.status).toBe(200);
  expect(q.body).toMatchObject({ online: true, valor_centavos: 10000 });
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  expect((await refund(q.body)).body).toMatchObject({ pending: false });
  expect(provider).toHaveBeenCalledTimes(1);
  expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer FIXTURE-ARENA-TOKEN');
  expect(await balance()).toEqual({ total: 0, count: 2 });
  expect((await db.getAsync('SELECT status FROM Reservas WHERE id=1')).status).toBe(cancel ? 'Cancelada' : 'Confirmada');
  expect((await refund(q.body)).status).toBe(409);
  expect(provider).toHaveBeenCalledTimes(1);
  respond(payment()); // An old approval must not restore refunded money.
  expect((await signedWebhook(app, 991)).status).toBe(200);
  expect(await balance()).toEqual({ total: 0, count: 2 });
});

it('shows every grouped slot and requires confirmation of the full remaining online balance', async () => {
  await paid({ grouped: true });
  // Another confirmed payment in the same order paid its second slot.
  await db.runAsync("INSERT INTO TransacoesGateway(reserva_id,gateway_ref,metodo,valor,status) VALUES(1,'992','Pix',10000,'Pendente')");
  await require('../src/services/paymentLedgerService').settle('992');
  const q = (await quote(2)).body;
  expect(q.reservas.map(row => row.id)).toEqual([1, 2]);
  expect(q.valor_centavos).toBe(20000);
  expect((await refund(q, { reserva_id: 2, valor: 100 })).status).toBe(409);
  expect(provider).not.toHaveBeenCalled();
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  respond({ id: 702, payment_id: 992, amount: 100, status: 'approved' });
  expect((await refund(q, { reserva_id: 2 })).status).toBe(200);
  expect(await balance()).toEqual({ total: 0, count: 4 });
});

it('preserves the balance on timeout and reconciles using the same idempotency key', async () => {
  await paid();
  const q = (await quote()).body;
  provider.mockRejectedValueOnce(new Error('Response lost'));
  expect((await refund(q)).status).toBe(202);
  expect(await balance()).toEqual({ total: 10000, count: 1 });
  const key = provider.mock.calls[0][1].headers['X-Idempotency-Key'];
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  expect(await gateway.reconciliarEstornoMercadoPago(key)).toEqual({ state: 'completed' });
  expect(provider.mock.calls[1][1].headers['X-Idempotency-Key']).toBe(key);
  expect(await balance()).toEqual({ total: 0, count: 2 });
});

it('coalesces concurrent refund requests without a second provider call', async () => {
  await paid();
  const q = (await quote()).body;
  let finish, started;
  const entered = new Promise(resolve => { started = resolve; });
  provider.mockImplementationOnce(() => { started(); return new Promise(resolve => { finish = resolve; }); });
  const first = refund(q).then(response => response);
  await entered;
  expect((await refund(q)).status).toBe(202);
  finish({ ok: true, json: async () => ({ id: 701, payment_id: 991, amount: 100, status: 'approved' }) });
  expect((await first).status).toBe(200);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(await balance()).toEqual({ total: 0, count: 2 });
});

it.each([fixture.actors.manager, fixture.actors.owner, fixture.actors.otherAdmin])('rejects unauthorized actor %s without contacting the provider', async actor => {
  await paid();
  const q = (await quote()).body;
  const session = await fixture.login(app, actor);
  expect((await quote(1, session)).status).toBe(actor === fixture.actors.otherAdmin ? 404 : 403);
  expect((await refund(q, {}, session)).status).toBe(actor === fixture.actors.otherAdmin ? 404 : 403);
  expect(provider).not.toHaveBeenCalled();
});

it('blocks missing credentials, missing confirmation and a stale balance before any refund', async () => {
  await paid();
  const q = (await quote()).body;
  expect((await refund(q, { confirmacao: '' })).status).toBe(409);
  await db.runAsync('UPDATE Arenas SET gateway_access_token=NULL WHERE id=1');
  expect((await refund(q)).status).toBe(409);
  await require('../src/services/paymentLedgerService').reverse('991', 4000);
  expect((await refund(q)).status).toBe(409);
  expect(provider).not.toHaveBeenCalled();
});

it('does not debit the ledger on a mismatched provider confirmation', async () => {
  await paid();
  const q = (await quote()).body;
  respond({ id: 701, payment_id: 999, amount: 100, status: 'approved' });
  expect((await refund(q)).status).toBe(202);
  expect(await balance()).toEqual({ total: 10000, count: 1 });
});

it('preserves an ambiguous refund key when a retry is refused', async () => {
  await paid();
  const q = (await quote()).body;
  provider.mockRejectedValueOnce(new Error('Response lost'));
  expect((await refund(q)).status).toBe(202);
  const key = provider.mock.calls[0][1].headers['X-Idempotency-Key'];
  provider.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
  expect(await gateway.reconciliarEstornoMercadoPago(key)).toEqual({ state: 'blocked' });
  expect((await db.getAsync('SELECT state FROM RefundIntents WHERE id=?', [key])).state).toBe('unknown');
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  expect((await refund(q)).status).toBe(200);
  expect(provider.mock.calls.at(-1)[1].headers['X-Idempotency-Key']).toBe(key);
  expect(await balance()).toEqual({ total: 0, count: 2 });
});

it('refunds only the remaining online balance after a provider partial refund', async () => {
  await paid();
  await require('../src/services/paymentLedgerService').reverse('991', 4000);
  const q = (await quote()).body;
  expect(q.valor_centavos).toBe(6000);
  provider.mockRejectedValueOnce(new Error('Response lost'));
  expect((await refund(q)).status).toBe(202);
  const key = provider.mock.calls[0][1].headers['X-Idempotency-Key'];
  // The webhook arrives before the retry response.
  await require('../src/services/paymentLedgerService').reverse('991', 10000);
  respond({ id: 701, payment_id: 991, amount: 60, status: 'approved' });
  expect(await gateway.reconciliarEstornoMercadoPago(key)).toEqual({ state: 'completed' });
  expect(await balance()).toEqual({ total: 0, count: 3 });
});

it('keeps a manual remainder refundable after the online portion is returned', async () => {
  await paid();
  await db.runAsync('UPDATE Reservas SET valor_total=15000 WHERE id=1');
  expect((await auth(request(app).post('/api/pagamentos'), admin).send({ reserva_id: 1, valor: 50, metodo: 'Dinheiro' })).status).toBe(201);
  const q = (await quote()).body;
  expect(q.valor_centavos).toBe(10000);
  respond({ id: 701, payment_id: 991, amount: 100, status: 'approved' });
  expect((await refund(q)).status).toBe(200);
  expect((await quote()).body.online).toBe(false);
  expect((await refund({}, { valor: 50 })).status).toBe(200);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(await balance()).toEqual({ total: 0, count: 4 });
});
