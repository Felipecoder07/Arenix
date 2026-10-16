const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, actors, PASSWORD } = fixture;
const app = require('../src/app');
const mail = require('../src/services/emailService');
beforeAll(fixture.initialize);
beforeEach(async () => {
  await db.runAsync('DELETE FROM FaturasSaaS');
  await fixture.seed();
  vi.spyOn(mail, 'sendEmail').mockResolvedValue(true);
  await db.runAsync("INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES ('trial_ativo','1'),('dias_trial','14')");
});
afterEach(() => vi.restoreAllMocks());
afterAll(fixture.close);
const body = { nome: 'Nova Arena', email: 'nova@example.test', plano_id: 1 };
const count = async () => (await db.getAsync('SELECT COUNT(*) AS total FROM Arenas')).total;

it('Master grava e-mail normalizado e não mistura convite com transação aberta', async () => {
  const master = await fixture.login(app, actors.master);
  mail.sendEmail.mockImplementation(async () => {
    expect(await db.getAsync("SELECT id FROM Usuarios WHERE email='nova@example.test'")).toBeDefined();
    return true;
  });
  const response = await auth(request(app).post('/api/saas/arenas'),master).send({...body,email:' NOVA@EXAMPLE.TEST '});
  expect(response.status).toBe(201);
  expect(response.body.email_enviado).toBe(true);
  expect((await db.getAsync('SELECT email FROM Arenas WHERE id=?',[response.body.id])).email).toBe('nova@example.test');
});

it('falha ao criar desafio reverte arena e administrador e não envia convite', async () => {
  const master = await fixture.login(app, actors.master);
  vi.spyOn(require('../src/services/recoveryService'),'createChallenge').mockRejectedValue(new Error('fixture failure'));
  const before = await count();
  expect((await auth(request(app).post('/api/saas/arenas'),master).send(body)).status).toBe(500);
  expect(await count()).toBe(before);
  expect(await db.getAsync('SELECT id FROM Usuarios WHERE email=?',[body.email])).toBeUndefined();
  expect(mail.sendEmail).not.toHaveBeenCalled();
});

it.each([false, 'throw'])('falha SMTP %s preserva cadastro e permite novo link de ativação', async failure => {
  const master = await fixture.login(app, actors.master);
  if (failure === 'throw') mail.sendEmail.mockRejectedValueOnce(new Error('SMTP offline'));
  else mail.sendEmail.mockResolvedValueOnce(false);
  const response = await auth(request(app).post('/api/saas/arenas'),master).send(body);
  expect(response.status).toBe(201);
  expect(response.body.email_enviado).toBe(false);
  const user = await db.getAsync('SELECT * FROM Usuarios WHERE email=?',[body.email]);
  expect(user.activation_pending).toBe(1);
  const previous = await db.getAsync('SELECT token_hash FROM RecoveryChallenges WHERE usuario_id=? AND used=0',[user.id]);
  expect((await request(app).post('/api/auth/forgot-password').send({email:body.email})).status).toBe(200);
  const renewed = await db.getAsync('SELECT token_hash,purpose FROM RecoveryChallenges WHERE usuario_id=? AND used=0',[user.id]);
  expect(renewed.token_hash).not.toBe(previous.token_hash);
  expect(renewed.purpose).toBe('activation');
  expect(mail.sendEmail).toHaveBeenCalledTimes(2);
});

it('cadastro público reverte arena quando a criação do usuário falha', async () => {
  await db.runAsync("CREATE TRIGGER fail_registration BEFORE INSERT ON Usuarios WHEN NEW.email='nova@example.test' BEGIN SELECT RAISE(ABORT,'fixture'); END");
  const before = await count();
  try {
    const response = await request(app).post('/api/auth/register').send({...body,arena_nome:'Nova Arena',perfil:'Administrador',senha:PASSWORD});
    expect(response.status).toBe(500);
    expect(await count()).toBe(before);
  } finally { await db.runAsync('DROP TRIGGER fail_registration'); }
});

it('cadastro público sem trial reverte tudo se a fatura inicial falhar', async () => {
  await db.runAsync("UPDATE ConfiguracoesSaaS SET valor='0' WHERE chave='trial_ativo'");
  await db.runAsync("CREATE TRIGGER fail_invoice BEFORE INSERT ON FaturasSaaS BEGIN SELECT RAISE(ABORT,'fixture'); END");
  const before = await count();
  try {
    expect((await request(app).post('/api/auth/register').send({...body,perfil:'Administrador',senha:PASSWORD})).status).toBe(500);
    expect(await count()).toBe(before);
    expect(await db.getAsync('SELECT id FROM Usuarios WHERE email=?',[body.email])).toBeUndefined();
  } finally { await db.runAsync('DROP TRIGGER fail_invoice'); }
});

it('cadastros simultâneos de mesmo nome recebem slugs únicos', async () => {
  const master = await fixture.login(app,actors.master);
  const results = await Promise.all(['a','b'].map(suffix => auth(request(app).post('/api/saas/arenas'),master).send({...body,email:suffix+'@example.test'})));
  expect(results.map(r=>r.status)).toEqual([201,201]);
  const arenas = await db.allAsync("SELECT slug FROM Arenas WHERE nome='Nova Arena'");
  expect(new Set(arenas.map(a=>a.slug)).size).toBe(2);
});

it('plano inexistente reverte os dados cadastrais da edição', async () => {
  const master = await fixture.login(app,actors.master);
  const original = await db.getAsync('SELECT * FROM Arenas WHERE id=1');
  const response = await auth(request(app).put('/api/saas/arenas/1'),master).send({nome:'Não salvar',email:'mudar@example.test',plano_id:999999});
  expect(response.status).toBe(404);
  expect(await db.getAsync('SELECT * FROM Arenas WHERE id=1')).toEqual(original);
});

it('limite do plano rejeitado reverte dados e preserva solicitação pendente', async () => {
  await db.runAsync('UPDATE Arenas SET plano_id=1,fatura_plano_pendente_id=123 WHERE id=1');
  await db.runAsync('UPDATE PlanosSaaS SET max_usuarios=1 WHERE id=2');
  const master = await fixture.login(app,actors.master);
  const original = await db.getAsync('SELECT * FROM Arenas WHERE id=1');
  const response = await auth(request(app).put('/api/saas/arenas/1'),master).send({nome:'Não salvar',plano_id:2});
  expect(response.status).toBe(400);
  expect(await db.getAsync('SELECT * FROM Arenas WHERE id=1')).toEqual(original);
});

it('salva cadastro e plano juntos e remove vínculo antigo de upgrade', async () => {
  await db.runAsync('UPDATE Arenas SET plano_id=1,fatura_plano_pendente_id=123 WHERE id=1');
  await db.runAsync('UPDATE PlanosSaaS SET max_usuarios=100,max_quadras=100 WHERE id=2');
  const master = await fixture.login(app,actors.master);
  const response = await auth(request(app).put('/api/saas/arenas/1'),master).send({nome:'Salvo',email:'novo@example.test',plano_id:2});
  expect(response.status).toBe(200);
  expect(await db.getAsync('SELECT nome,email,plano_id,fatura_plano_pendente_id FROM Arenas WHERE id=1'))
    .toEqual({nome:'Salvo',email:'novo@example.test',plano_id:2,fatura_plano_pendente_id:null});
});
