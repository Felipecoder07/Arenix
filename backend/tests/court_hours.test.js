const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');

let session;
beforeAll(async () => {
  await fixture.initialize();
  await fixture.seed();
  session = await fixture.login(app, fixture.actors.admin);
});
afterAll(fixture.close);

describe.each(['post', 'put'])('horários de quadra via %s', method => {
  test.each([
    ['22:00', '07:00'],
    ['08:00', '08:00'],
    ['25:00', '26:00'],
    ['07:60', '22:00'],
    ['', '22:00'],
  ])('rejeita abertura %s e fechamento %s sem alterar os dados', async (opening, closing) => {
    const before = await fixture.db.allAsync('SELECT * FROM Quadras ORDER BY id');
    const response = await fixture.auth(request(app)[method](method === 'post' ? '/api/quadras' : '/api/quadras/1'), session)
      .send({ nome: 'Quadra teste', tipo: 'Areia', hora_abertura: opening, hora_fechamento: closing, status: 'Ativa' });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('O fechamento deve ser depois da abertura');
    expect(await fixture.db.allAsync('SELECT * FROM Quadras ORDER BY id')).toEqual(before);
  });
});

test('permite salvar um intervalo válido', async () => {
  const response = await fixture.auth(request(app).put('/api/quadras/1'), session)
    .send({ nome: 'Quadra teste', tipo: 'Areia', hora_abertura: '07:00', hora_fechamento: '22:00', status: 'Ativa' });
  expect(response.status).toBe(200);
  expect(await fixture.db.getAsync('SELECT hora_abertura, hora_fechamento FROM Quadras WHERE id = 1'))
    .toEqual({ hora_abertura: '07:00', hora_fechamento: '22:00' });
});
