const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth } = fixture;
const app = require('../src/app');
const billing = require('../src/services/saasBillingService');
const settlement = require('../src/services/saasSettlementService');
let provider, invoiceId;

beforeAll(fixture.initialize);
beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  await db.runAsync('DELETE FROM FaturasSaaS');
  await fixture.seed();
  await db.runAsync("UPDATE Arenas SET plano_id=1,status=0,motivo_bloqueio='inadimplencia' WHERE id=1");
  const row = await db.runAsync(`INSERT INTO FaturasSaaS
    (tenant_id,plano_id,valor,status,data_vencimento,gateway_ref)
    VALUES(1,1,10000,'Pendente','2020-01-01','991')`);
  invoiceId = row.lastID;
  provider = vi.fn().mockRejectedValue(new Error('Unexpected provider call'));
  vi.stubGlobal('fetch', provider);
});
afterEach(() => { process.env.NODE_ENV = 'test'; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(fixture.close);

const payment = (overrides = {}) => ({ id: 991, status: 'approved', currency_id: 'BRL', collector_id: 123, transaction_amount: 100, ...overrides });
const respond = body => provider.mockResolvedValueOnce({ ok: true, json: async () => body });
const invoice = () => db.getAsync('SELECT * FROM FaturasSaaS WHERE id=?', [invoiceId]);
const arena = () => db.getAsync('SELECT status,motivo_bloqueio FROM Arenas WHERE id=1');

it('confirma pela consulta em produção quando o webhook ainda não chegou', async () => {
  const session = await fixture.login(app);
  vi.stubEnv('SECRETS_KEYRING', JSON.stringify({ fixture: 'a'.repeat(64) }));
  vi.stubEnv('SECRETS_ACTIVE_KEY_ID', 'fixture');
  await db.runAsync("UPDATE ConfiguracoesSaaS SET valor=? WHERE chave='mp_master_access_token'",
    [require('../src/utils/security').encrypt('FIXTURE-MASTER-TOKEN')]);
  process.env.NODE_ENV = 'production';
  await db.runAsync("UPDATE ConfiguracoesSaaS SET valor=? WHERE chave='mp_master_identity'", [JSON.stringify({ id: '123', fingerprint: require('../src/utils/security').hash('FIXTURE-MASTER-TOKEN') })]);
  respond(payment());
  const result = await auth(request(app).get('/api/tenant/assinatura/status-pagamento/991'), session);
  expect(result.status).toBe(200);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(result.body).toMatchObject({ pago: true, arena_ativa: true, arena_desbloqueada: true });
  expect((await invoice()).status).toBe('Paga');
});

it('informa o bloqueio manual mesmo quando a consulta confirma o pagamento', async () => {
  await db.runAsync("UPDATE Arenas SET motivo_bloqueio='manual' WHERE id=1");
  const session = await fixture.login(app);
  respond(payment());
  const result = await auth(request(app).get('/api/tenant/assinatura/status-pagamento/991'), session);
  expect(result.body).toMatchObject({ pago: true, arena_ativa: false, arena_desbloqueada: false });
  expect(await arena()).toEqual({ status: 0, motivo_bloqueio: 'manual' });
});

it.each([{ id: 992 }, { currency_id: 'USD' }, { transaction_amount: 1 }])('a consulta não liquida resposta divergente: %j', async mismatch => {
  const session = await fixture.login(app);
  respond(payment(mismatch));
  const result = await auth(request(app).get('/api/tenant/assinatura/status-pagamento/991'), session);
  expect(result.body.pago).toBe(false);
  expect((await invoice()).status).toBe('Pendente');
});

it('não ressuscita uma aprovação antiga depois de registrar o estorno', async () => {
  await billing.liquidarFaturaSaaS('991', payment());
  await settlement.registrarEstorno('991', payment({ status: 'refunded' }));
  await expect(billing.liquidarFaturaSaaS('991', payment())).rejects.toThrow(/estorn/i);
  expect((await invoice()).status).toBe('Atrasada');
  expect((await arena()).status).toBe(0);
});

it('repetir o estorno antigo não desfaz a regularização manual posterior', async () => {
  await billing.liquidarFaturaSaaS('991', payment());
  const refund = payment({ status: 'refunded' });
  await settlement.registrarEstorno('991', refund);
  await settlement.registrarPagamentoManual(invoiceId, null);
  await settlement.registrarEstorno('991', refund);
  expect((await invoice()).status).toBe('Paga');
  expect((await arena()).status).toBe(1);
});

it('não renova localmente a validade de um Pix expirado retornado pela idempotência', async () => {
  const expired = '2020-01-02T00:00:00.000Z';
  await db.runAsync('UPDATE FaturasSaaS SET qr_expira_em=? WHERE id=?', [expired, invoiceId]);
  respond(payment({ status: 'cancelled', date_of_expiration: expired,
    point_of_interaction: { transaction_data: { qr_code: 'expired-qr' } } }));
  await expect(billing.gerarPixFaturaSaaS(invoiceId)).rejects.toThrow(/expir|encerrad|indispon/i);
  expect((await invoice()).qr_expira_em).toBe(expired);
});

it('persiste a expiração informada pelo provedor ao recuperar a mesma cobrança', async () => {
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  respond(payment({ status: 'pending', date_of_expiration: expiry,
    point_of_interaction: { transaction_data: { qr_code: 'provider-qr' } } }));
  const pix = await billing.gerarPixFaturaSaaS(invoiceId);
  expect(pix.expira_em).toBe(expiry);
  expect((await invoice()).qr_expira_em).toBe(expiry);
});

it('uma baixa manual durante a chamada ao provedor não é sobrescrita pelo Pix', async () => {
  provider.mockImplementationOnce(async () => {
    await settlement.registrarPagamentoManual(invoiceId, null);
    return { ok: true, json: async () => payment({ status: 'pending',
      date_of_expiration: new Date(Date.now() + 3600000).toISOString(),
      point_of_interaction: { transaction_data: { qr_code: 'provider-qr' } } }) };
  });
  await expect(billing.gerarPixFaturaSaaS(invoiceId)).rejects.toThrow(/alterada/);
  expect(await invoice()).toMatchObject({ status: 'Paga', metodo_pagamento: 'Manual', copia_cola: null });
});

it('não troca a referência de um Pix ainda vinculado à fatura', async () => {
  respond(payment({ id: 992, status: 'pending', date_of_expiration: new Date(Date.now() + 3600000).toISOString(),
    point_of_interaction: { transaction_data: { qr_code: 'other-qr' } } }));
  await expect(billing.gerarPixFaturaSaaS(invoiceId)).rejects.toThrow(/alterada/);
  expect((await invoice()).gateway_ref).toBe('991');
});

it('não oferece o QR antigo de um pagamento já estornado', async () => {
  await db.runAsync('UPDATE FaturasSaaS SET qr_expira_em=?,copia_cola=? WHERE id=?',
    [new Date(Date.now() + 3600000).toISOString(), 'old-qr', invoiceId]);
  await settlement.registrarEstorno('991', payment({ status: 'charged_back' }));
  await expect(billing.gerarPixFaturaSaaS(invoiceId)).rejects.toThrow(/estorn/);
  expect(provider).not.toHaveBeenCalled();
});

it('adiantamento informa preço, plano e ciclo da fatura reutilizada', async () => {
  await db.runAsync("UPDATE PlanosSaaS SET nome='Pro' WHERE id=2");
  await db.runAsync(`UPDATE FaturasSaaS SET plano_id=2,valor=76788,ciclo='anual',
    data_vencimento='2027-01-10',qr_expira_em=?,copia_cola='fixture-pix' WHERE id=?`,
  [new Date(Date.now() + 3600000).toISOString(), invoiceId]);
  respond(payment({ status: 'pending', transaction_amount: 767.88,
    date_of_expiration: new Date(Date.now() + 3600000).toISOString(),
    point_of_interaction: { transaction_data: { qr_code: 'fixture-pix' } } }));
  const session = await fixture.login(app);
  const response = await auth(request(app).post('/api/tenant/assinatura/adiantar-fatura'), session).send({});
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ fatura_id: invoiceId, valor: 767.88, ciclo: 'anual', plano_nome: 'Pro' });
  expect((await invoice()).valor).toBe(76788);
});
