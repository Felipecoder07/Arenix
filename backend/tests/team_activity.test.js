const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, actors } = fixture;
const request = require('supertest');
const app = require('../src/app');

beforeAll(fixture.initialize);
beforeEach(async () => { await fixture.seed(); await db.runAsync('DELETE FROM LogsAuditoria'); });
afterAll(fixture.close);

test('returns the latest real staff activity for the current tenant without sensitive audit fields', async () => {
  const session = await fixture.login(app, actors.admin);
  for (const [tenant, actor, event, date] of [
    [1, actors.admin, 'Primeira', '2099-01-01 10:00:00'],
    [1, actors.manager, 'Segunda', '2099-01-01 11:00:00'],
    [1, actors.receptionist, 'Terceira', '2099-01-01 12:00:00'],
    [1, actors.admin, 'Quarta', '2099-01-01 13:00:00'],
    [2, actors.otherAdmin, 'Outra arena', '2100-01-01 12:00:00'],
    [1, actors.owner, 'Atleta', '2100-01-01 13:00:00'],
  ]) await db.runAsync('INSERT INTO LogsAuditoria(tenant_id,usuario_id,evento,criado_em,detalhes,ip) VALUES(?,?,?,?,?,?)', [tenant, actor, event, date, 'Private details', '127.0.0.1']);
  const response = await auth(request(app).get('/api/usuarios/atividades'), session);
  expect(response.status).toBe(200);
  expect(response.body.map(row => row.evento)).toEqual(['Quarta', 'Terceira', 'Segunda']);
  expect(response.body[0].usuario_nome).toBe('User1');
  expect(response.body[0].criado_em).toBe('2099-01-01 13:00:00');
  expect(response.body[0]).not.toHaveProperty('detalhes');
  expect(response.body[0]).not.toHaveProperty('ip');
});

test('requires a staff management session', async () => {
  expect((await request(app).get('/api/usuarios/atividades')).status).toBe(401);
  const session = await fixture.login(app, actors.receptionist);
  expect((await auth(request(app).get('/api/usuarios/atividades'), session)).status).toBe(403);
});
