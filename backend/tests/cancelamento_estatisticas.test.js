const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');
const { db, auth } = fixture;

beforeAll(fixture.initialize);
beforeEach(fixture.seed);
afterAll(fixture.close);

test('estatísticas usam cancelamentos reais, data do evento e isolamento da arena', async () => {
  const adminA = await fixture.login(app, fixture.actors.admin);
  const adminB = await fixture.login(app, fixture.actors.otherAdmin);

  const cancelledA = await auth(request(app).patch('/api/reservas/1/cancelar'), adminA)
    .send({ motivo: -1, observacoes: 'Solicitado pelo cliente' });
  expect(cancelledA.status).toBe(200);
  const saved = await db.getAsync('SELECT motivo_cancelamento_id, observacoes_cancelamento FROM Reservas WHERE id = 1');
  expect(saved).toMatchObject({ motivo_cancelamento_id: -1, observacoes_cancelamento: 'Solicitado pelo cliente' });

  const cancelledB = await auth(request(app).patch('/api/reservas/3/cancelar'), adminB)
    .send({ motivo: -2 });
  expect(cancelledB.status).toBe(200);

  const response = await auth(request(app).get('/api/motivos/estatisticas'), adminA);
  expect(response.status).toBe(200);
  expect(response.body.mes).toEqual({ total: 2, valorTotal: 200 });
  expect(response.body.ultimos30Dias.total).toBe(2);
  expect(response.body.ultimos30Dias.porMotivo).toEqual([
    { id: -1, motivo: 'Desistência do Cliente', total: 2 },
  ]);

  await db.runAsync('UPDATE BookingCancellations SET created = ? WHERE reserva_id = 2', [Date.now() - 40 * 24 * 60 * 60 * 1000]);
  const recent = await auth(request(app).get('/api/motivos/estatisticas'), adminA);
  expect(recent.status).toBe(200);
  expect(recent.body.ultimos30Dias.total).toBe(1);
});
