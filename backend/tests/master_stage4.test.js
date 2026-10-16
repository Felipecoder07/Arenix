const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, actors } = fixture;
const app = require('../src/app');
const service = require('../src/services/comunicadoService');
const mail = require('../src/services/emailService');
beforeAll(fixture.initialize);
beforeEach(async () => {
  await fixture.seed();
  await db.runAsync('DELETE FROM ComunicadoEntregas');
  await db.runAsync('DELETE FROM ComunicadosSaaS');
  vi.spyOn(mail,'sendEmail').mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());
afterAll(fixture.close);
const future = () => new Date(Date.now()+3600000).toISOString();
async function create(channel='email') {
  return service.criar({message:'Aviso <teste>', audience:'1', channel, scheduledAt:future()});
}
async function due(id) { await db.runAsync("UPDATE ComunicadosSaaS SET agendado_em=datetime('now','-1 minute') WHERE id=?",[id]); }

it('agenda pela API sem enviar e publica alerta somente no horário', async () => {
  const master = await fixture.login(app,actors.master);
  const response = await auth(request(app).post('/api/saas/comunicados'),master).send({message:'Aviso',audience:'1',channel:'alerta',scheduledAt:future()});
  expect(response.status).toBe(200);
  const admin = await fixture.login(app,actors.admin);
  await service.processar();
  expect((await auth(request(app).get('/api/auth/comunicados/ativos'),admin)).body).toEqual([]);
  await due(response.body.id);
  await service.processar();
  expect((await auth(request(app).get('/api/auth/comunicados/ativos'),admin)).body).toHaveLength(1);
  expect(mail.sendEmail).not.toHaveBeenCalled();
});

it('e-mail agendado não envia cedo e execuções concorrentes não duplicam destinatários', async () => {
  const {id} = await create();
  await service.processar();
  expect(mail.sendEmail).not.toHaveBeenCalled();
  await due(id);
  await Promise.all([service.processar(),service.processar()]);
  await service.processar();
  expect(mail.sendEmail).toHaveBeenCalledTimes(2);
  expect(new Set(mail.sendEmail.mock.calls.map(c=>c[0])).size).toBe(2);
  expect(mail.sendEmail.mock.calls[0][2]).toContain('&lt;teste&gt;');
});

it.each(['cancelado','expirado'])('não envia comunicado %s após reinício/processamento atrasado', async state => {
  const {id} = await create();
  await due(id);
  await db.runAsync(state==='cancelado' ? 'UPDATE ComunicadosSaaS SET ativo=0 WHERE id=?' : "UPDATE ComunicadosSaaS SET expira_em=datetime('now','-1 minute') WHERE id=?",[id]);
  await service.processar();
  expect(mail.sendEmail).not.toHaveBeenCalled();
});

it('registra falhas e não reenvia automaticamente entregas incertas', async () => {
  const {id} = await create();
  await due(id);
  mail.sendEmail.mockResolvedValue(false);
  await service.processar();
  await db.runAsync("UPDATE ComunicadoEntregas SET estado='enviando' WHERE comunicado_id=? AND email='u1@example.test'",[id]);
  await service.processar();
  expect(mail.sendEmail).toHaveBeenCalledTimes(2);
  const master = await fixture.login(app,actors.master);
  const response = await auth(request(app).get('/api/saas/comunicados'),master);
  expect(response.body[0]).toMatchObject({failedDeliveries:1,uncertainDeliveries:1});
});

it.each(['inválido','2020-01-01T00:00:00Z','2099-01-01T10:00'])('recusa agendamento inválido %s',async scheduledAt => {
  await expect(service.criar({message:'Oi',audience:'all',channel:'email',scheduledAt})).rejects.toMatchObject({status:400});
  expect(await db.allAsync('SELECT id FROM ComunicadosSaaS')).toHaveLength(0);
});

it('recusa expiração anterior ao envio',async () => {
  await expect(service.criar({message:'Oi',audience:'all',channel:'email',scheduledAt:future(),expiresAt:new Date().toISOString()})).rejects.toMatchObject({status:400});
});

it('histórico retorna somente os registros do usuário solicitado', async () => {
  const master = await fixture.login(app,actors.master);
  await db.runAsync("INSERT INTO LogsAuditoria(usuario_id,evento,detalhes) VALUES (1,'Acesso fixture','alvo'),(4,'Acesso fixture','outro')");
  const response = await auth(request(app).get('/api/saas/usuarios/1/acessos'),master);
  expect(response.status).toBe(200);
  expect(response.body.some(r=>r.detalhes==='alvo')).toBe(true);
  expect(response.body.some(r=>r.detalhes==='outro')).toBe(false);
});

it('recuperação não informa sucesso se o SMTP falhar',async () => {
  const master = await fixture.login(app,actors.master);
  mail.sendEmail.mockResolvedValue(false);
  const response = await auth(request(app).post('/api/saas/usuarios/1/reset-senha'),master);
  expect(response.status).toBe(503);
});
