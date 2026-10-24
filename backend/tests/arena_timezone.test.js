const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');
const { summary } = require('../src/services/paymentSummaryService');
const { db, auth } = fixture;
let admin, athlete;
beforeAll(async () => {
  await fixture.initialize(); await fixture.seed();
  admin = await fixture.login(app);
  athlete = await fixture.login(app, fixture.actors.owner);
});
afterEach(() => vi.useRealTimers());
afterAll(fixture.close);

test('a disponibilidade usa a data local da arena na virada do dia', async () => {
  await db.runAsync("UPDATE Arenas SET fuso_horario='America/Rio_Branco' WHERE id=1");
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T04:30:00Z'));
  const result = await request(app).get('/api/public/tenant/arena-a/disponibilidade');
  expect(result.status).toBe(200);
  expect(result.body.data).toBe('2026-10-20');
});

test('disponibilidade e cancelamento respeitam o início no fuso da arena', async () => {
  await db.runAsync("UPDATE Arenas SET fuso_horario='America/Manaus' WHERE id=1");
  await db.runAsync("UPDATE Reservas SET data_reserva='2026-10-21',hora_inicio='10:00',hora_fim='11:00',grupo_id=NULL WHERE id=1");
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T13:30:00Z')); // 09:30 Manaus; 10:30 Brasília
  const availability = await request(app).get('/api/public/tenant/arena-a/disponibilidade?data=2026-10-21');
  expect(availability.status).toBe(200);
  expect(availability.body.quadras[0].slots.find(slot => slot.hora_inicio === '10:00').status).toBe('ocupado');
  const cancelled = await auth(request(app).post('/api/public/tenant/arena-a/cancelar-reserva/1'), athlete).send({});
  expect(cancelled.status).toBe(200);
});

test('recebimentos e inadimplência usam o mesmo fuso da arena', async () => {
  await db.runAsync("UPDATE Arenas SET fuso_horario='America/Manaus' WHERE id=1");
  await db.runAsync("UPDATE Reservas SET status='Confirmada',data_reserva='2026-10-21',hora_inicio='09:00',hora_fim='10:00' WHERE id=1");
  await db.runAsync("INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_em) VALUES(1,1000,'Pix','2026-10-21 03:30:00')");
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T13:30:00Z'));
  const result = await summary(1, '2026-10-20');
  expect(result.recebidoHoje).toBe(0);
  expect(result.resumoFiltrado.recebido).toBe(1000);
  expect(result.totalInadimplencia).toBe(0);
  const list = await auth(request(app).get('/api/pagamentos/reservas?status=inadimplentes'), admin);
  expect(list.status).toBe(200);
  expect(list.body).toEqual([]);
});
