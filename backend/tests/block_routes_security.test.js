const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, actors } = fixture;
const app = require('../src/app');
beforeAll(fixture.initialize);
beforeEach(fixture.seed);
afterAll(fixture.close);
const body = { quadra_id: 1, data_bloqueio: '2099-12-01', hora_inicio: '14:00', hora_fim: '15:00', motivo: 'Manutencao' };
describe.each(['/api/quadras/bloqueios', '/api/reservas/bloqueios'])('%s', route => {
  it('rejects a court belonging to another arena without writing', async () => {
    const session = await fixture.login(app, actors.admin);
    const response = await auth(request(app).post(route), session).send({ ...body, quadra_id: 2 });
    expect(response.status).toBe(404);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM Bloqueios')).n).toBe(0);
  });
  it('does not let a receptionist bypass block permissions through an alternate URL', async () => {
    const session = await fixture.login(app, actors.receptionist);
    expect((await auth(request(app).post(route), session).send(body)).status).toBe(403);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM Bloqueios')).n).toBe(0);
  });
  it('creates a block for the authenticated arena', async () => {
    const session = await fixture.login(app, actors.manager);
    expect((await auth(request(app).post(route), session).send(body)).status).toBe(201);
    expect(await db.allAsync('SELECT quadra_id,criado_por FROM Bloqueios')).toEqual([{ quadra_id: 1, criado_por: actors.manager }]);
  });
  it('preserves a reservation instead of blocking its occupied time', async () => {
    const session = await fixture.login(app, actors.admin);
    expect((await auth(request(app).post(route), session).send({ ...body, hora_inicio: '10:00', hora_fim: '11:00' })).status).toBe(409);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM Bloqueios')).n).toBe(0);
  });
});

describe('block interval integrity', () => {
  const route = '/api/reservas/bloqueios';
  async function create(session, overrides = {}) {
    return auth(request(app).post(route), session).send({ ...body, hora_fim: '18:00', ...overrides });
  }
  it.each([
    { hora_inicio: '18:00', hora_fim: '14:00' },
    { hora_inicio: '14:00', hora_fim: '14:00' },
    { hora_inicio: '99:00' },
    { data_bloqueio: '2099-02-30' },
    { motivo: '   ' },
    { hora_inicio: '01:00' },
  ])('rejects invalid input %j without writing', async overrides => {
    const session = await fixture.login(app);
    expect((await create(session, overrides)).status).toBe(400);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM Bloqueios')).n).toBe(0);
  });
  it('serializes competing creates and allows adjacent blocks', async () => {
    const session = await fixture.login(app);
    const responses = await Promise.all([create(session), create(session)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await create(session, { hora_inicio: '18:00', hora_fim: '19:00' })).status).toBe(201);
  });
  it('rejects an unrelated release and preserves the original block', async () => {
    const session = await fixture.login(app);
    const result = await create(session);
    expect((await auth(request(app).delete(route + '/' + result.body.id + '/horario?hora=08:00'), session)).status).toBe(400);
    expect(await db.allAsync('SELECT hora_inicio,hora_fim FROM Bloqueios')).toEqual([{ hora_inicio: '14:00', hora_fim: '18:00' }]);
  });
  it('splits a block and clips a partially overlapping release', async () => {
    const session = await fixture.login(app);
    const result = await create(session);
    const url = route + '/' + result.body.id;
    expect((await auth(request(app).delete(url + '/horario?hora=15:00'), session)).status).toBe(200);
    expect(await db.allAsync('SELECT hora_inicio,hora_fim FROM Bloqueios ORDER BY hora_inicio')).toEqual([
      { hora_inicio: '14:00', hora_fim: '15:00' }, { hora_inicio: '16:00', hora_fim: '18:00' },
    ]);
    expect((await auth(request(app).patch(url + '/desbloquear-hora'), session).send({ hora_inicio_desbloqueio: '13:30', hora_fim_desbloqueio: '14:30' })).status).toBe(200);
    expect((await db.getAsync('SELECT hora_inicio FROM Bloqueios WHERE id=?', [result.body.id])).hora_inicio).toBe('14:30');
  });
  it('rolls back the first half when splitting fails', async () => {
    const session = await fixture.login(app);
    const result = await create(session);
    await db.runAsync("CREATE TEMP TRIGGER fail_block_split BEFORE INSERT ON Bloqueios BEGIN SELECT RAISE(ABORT, 'test split failure'); END");
    try {
      expect((await auth(request(app).delete(route + '/' + result.body.id + '/horario?hora=15:00'), session)).status).toBe(500);
      expect(await db.allAsync('SELECT hora_inicio,hora_fim FROM Bloqueios')).toEqual([{ hora_inicio: '14:00', hora_fim: '18:00' }]);
    } finally { await db.runAsync('DROP TRIGGER fail_block_split'); }
  });
});
