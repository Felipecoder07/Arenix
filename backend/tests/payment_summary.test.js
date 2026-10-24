const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth } = fixture;
const app = require('../src/app');
const { summary, paymentDate } = require('../src/services/paymentSummaryService');

beforeAll(fixture.initialize);
beforeEach(async () => {
  await fixture.seed();
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-20T15:00:00Z').getTime());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T15:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(fixture.close);

it('counts actual balances and only expired bookings as delinquent, consistently with the list', async () => {
  await db.runAsync("UPDATE Reservas SET data_reserva='2026-10-19',status_pagamento='Pago' WHERE id=1");
  await db.runAsync("INSERT INTO Pagamentos(reserva_id,valor,metodo) VALUES(1,4000,'Pix')");
  const result = await summary(1, null);
  expect(result.totalInadimplencia).toBe(6000);
  expect(result.qtdInadimplentes).toBe(1);
  expect(result.countsGlobais).toEqual({ pendentes: 2, pagos: 0, todos: 2, inadimplentes: 1 });
  const session = await fixture.login(app);
  const list = await auth(request(app).get('/api/pagamentos/reservas?status=inadimplentes'), session);
  expect(list.status).toBe(200);
  expect(list.body.map(r => r.id)).toEqual([1]);
  expect(list.body[0]).toMatchObject({ saldo_devedor: 6000, status_pagamento: 'Parcial' });
});

it('uses local payment dates, includes cancelled cash movements and subtracts refunds in their own month', async () => {
  await db.runAsync("UPDATE Reservas SET status='Cancelada' WHERE id=1");
  for (const [id, amount, date] of [
    [1, 10000, '2026-10-01 02:59:59'], // September in Sao Paulo
    [1, -2000, '2026-10-01 03:00:00'],
    [2, 6000, '2026-10-20 03:00:00'],
    [2, 3000, '2026-10-21 02:59:59'],
    [2, 9000, '2026-11-01 03:00:00'],
    [3, 99999, '2026-10-20 15:00:00'] // another tenant
  ]) await db.runAsync('INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_em) VALUES(?,?,?,?)', [id, amount, amount < 0 ? 'Estorno' : 'Pix', date]);
  const result = await summary(1, '2026-10-20');
  expect(result.recebidoMes).toBe(7000);
  expect(result.recebidoHoje).toBe(9000);
  expect(result.qtdPagamentosHoje).toBe(2);
  expect(result.resumoFiltrado.recebido).toBe(9000);
  expect(result.totalInadimplencia).toBe(0);
});

it('does not count an advance twice on the booking date and treats the end time as overdue', async () => {
  await db.runAsync("UPDATE Reservas SET data_reserva='2026-10-20',hora_fim='12:00' WHERE id=1");
  await db.runAsync("INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_em) VALUES(1,2500,'Pix','2026-10-19 15:00:00')");
  const result = await summary(1, '2026-10-20');
  expect(result.resumoFiltrado).toMatchObject({ recebido: 0, pendente: 7500, qtdPendente: 1, qtdInadimplentes: 1 });
  expect(result.totalInadimplencia).toBe(7500);
  expect(result.counts.inadimplentes).toBe(1);
});

it.each(['2026-02-30', '2026-13-01', 'invalid', ['2026-10-20']])('rejects invalid date %j', date => {
  expect(() => paymentDate(date)).toThrow('Data invalida');
});

it('keeps a cancellation awaiting refund out of customer debt while retaining its cash receipt', async () => {
  await db.runAsync("UPDATE Reservas SET data_reserva='2026-10-19',status='Cancelamento pendente',status_pagamento='Cancelado (Pendente Estorno)' WHERE id=1");
  await db.runAsync("INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_em) VALUES(1,4000,'Pix','2026-10-20 15:00:00')");
  const result = await summary(1, '2026-10-19');
  expect(result.totalInadimplencia).toBe(0);
  expect(result.qtdInadimplentes).toBe(0);
  expect(result.resumoFiltrado.pendente).toBe(0);
  expect(result.recebidoHoje).toBe(4000);
  const session = await fixture.login(app);
  const list = await auth(request(app).get('/api/pagamentos/reservas'), session);
  expect(list.body.find(r => r.id === 1)).toMatchObject({ saldo_devedor: 0, status_pagamento: 'Cancelado (Pendente Estorno)' });
  const overdue = await auth(request(app).get('/api/pagamentos/reservas?status=inadimplentes'), session);
  expect(overdue.body).toEqual([]);
});
