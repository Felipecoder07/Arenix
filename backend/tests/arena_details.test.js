const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');
const { db, auth } = fixture;
let session;
beforeAll(async () => { await fixture.initialize(); await fixture.seed(); session = await fixture.login(app); });
afterAll(fixture.close);

test.each([
  { nome: '   ' }, { nome: 123 }, { email: 'sem-arroba' }, { email: 'a@b' },
  { telefone: '123' }, { telefone: 'ligue 11999999999' },
  { fuso_horario: 'invalid' }, { email: ['a@b.com'] },
])('rejeita dados inválidos sem modificar a arena: %j', async body => {
  const before = await db.getAsync('SELECT * FROM Arenas WHERE id=1');
  const result = await auth(request(app).put('/api/arenas/minha'), session).send(body);
  expect(result.status).toBe(400);
  expect(await db.getAsync('SELECT * FROM Arenas WHERE id=1')).toEqual(before);
});

test('salva contatos válidos somente na arena do usuário e mantém o login', async () => {
  const user = await db.getAsync('SELECT email FROM Usuarios WHERE id=1');
  const other = await db.getAsync('SELECT * FROM Arenas WHERE id=2');
  const result = await auth(request(app).put('/api/arenas/minha'), session)
    .send({ nome: ' Arena Nova ', email: ' contato@arena.com ', telefone: '+55 (11) 99999-9999', fuso_horario: 'America/Manaus' });
  expect(result.status).toBe(200);
  expect(await db.getAsync('SELECT nome,email,telefone,fuso_horario FROM Arenas WHERE id=1'))
    .toEqual({ nome: 'Arena Nova', email: 'contato@arena.com', telefone: '+55 (11) 99999-9999', fuso_horario: 'America/Manaus' });
  expect(await db.getAsync('SELECT email FROM Usuarios WHERE id=1')).toEqual(user);
  expect(await db.getAsync('SELECT * FROM Arenas WHERE id=2')).toEqual(other);
});
