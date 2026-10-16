const fixture = require('./helpers/securityFixture.cjs');
const { db, auth, actors } = fixture;
const request = require('supertest');
const app = require('../src/app');
const dates = require('../src/utils/dateUtils');
const calendar = require('../src/services/saasCalendarService');
const { gerarFaturasVencidas } = require('../src/jobs/cronSaaS');
const { executarBloqueioInadimplencia } = require('../src/jobs/bloqueioInadimplencia');

beforeAll(fixture.initialize);
beforeEach(async () => {
  await db.runAsync('DELETE FROM FaturasSaaS');
  await fixture.seed();
  await db.runAsync("UPDATE Arenas SET plano_id=1, dia_vencimento=17, criado_em='2030-01-03', trial_expira_em='2030-01-17' WHERE id=1");
  await db.runAsync("UPDATE Arenas SET status=-1 WHERE id=2");
  await db.runAsync("UPDATE PlanosSaaS SET valor_mensal=10000, valor_anual=8000 WHERE id=1");
  await db.runAsync("INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES ('dias_trial','14'),('trial_ativo','1'),('dias_tolerancia_bloqueio','5')");
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
afterAll(fixture.close);

async function invoice(date, ciclo = 'mensal', status = 'Paga') {
  return db.runAsync(`INSERT INTO FaturasSaaS (tenant_id,plano_id,valor,ciclo,status,data_vencimento)
    VALUES (1,1,10000,?,?,?)`, [ciclo, status, date]);
}
const invoices = () => db.allAsync('SELECT * FROM FaturasSaaS WHERE tenant_id=1 ORDER BY data_vencimento');

it('recupera vários meses perdidos e repetir/concorrrer não duplica faturas', async () => {
  await Promise.all([gerarFaturasVencidas('2030-04-20'), gerarFaturasVencidas('2030-04-20')]);
  expect((await invoices()).map(f => f.data_vencimento)).toEqual(['2030-01-17','2030-02-17','2030-03-17','2030-04-17']);
  expect((await invoices()).every(f => f.valor === 10000)).toBe(true);
});

it('não fatura antes do fim do trial e corrige aniversário legado sem encurtar primeiro ciclo', async () => {
  await db.runAsync('UPDATE Arenas SET dia_vencimento=10 WHERE id=1');
  await gerarFaturasVencidas('2030-01-16');
  expect(await invoices()).toHaveLength(0);
  await gerarFaturasVencidas('2030-02-17');
  expect((await invoices()).map(f => [f.data_vencimento,f.periodo_fim])).toEqual([
    ['2030-01-17','2030-02-17'],['2030-02-17','2030-03-17']]);
});

it('recupera após dia 31 e preserva aniversário em fevereiro e março', async () => {
  await db.runAsync("UPDATE Arenas SET dia_vencimento=31,trial_expira_em='2032-01-31' WHERE id=1");
  await gerarFaturasVencidas('2032-04-01');
  expect((await invoices()).map(f => f.data_vencimento)).toEqual(['2032-01-31','2032-02-29','2032-03-31']);
});

it('respeita cobertura anual e recupera apenas a renovação anual', async () => {
  await db.runAsync("UPDATE Arenas SET ciclo_cobranca='anual' WHERE id=1");
  await invoice('2030-01-17','anual');
  await gerarFaturasVencidas('2030-12-31');
  expect(await invoices()).toHaveLength(1);
  await gerarFaturasVencidas('2031-02-01');
  expect((await invoices()).map(f => f.data_vencimento)).toEqual(['2030-01-17','2031-01-17']);
  expect((await invoices())[1].valor).toBe(96000);
});

it('uma fatura antecipada não esconde meses faltantes', async () => {
  await invoice('2030-01-17');
  await invoice('2030-04-17');
  await gerarFaturasVencidas('2030-05-16');
  expect((await invoices()).map(f => f.data_vencimento)).toEqual(['2030-01-17','2030-02-17','2030-03-17','2030-04-17']);
});

it('não cobra integralmente intervalo que encontra uma fatura futura já emitida', async () => {
  await invoice('2030-01-17');
  await invoice('2030-03-10');
  await gerarFaturasVencidas('2030-03-01');
  const recuperada = (await invoices()).find(f => f.data_vencimento === '2030-02-17');
  expect(recuperada.periodo_fim).toBe('2030-03-10');
  expect(recuperada.valor).toBe(7500); // 21 de 28 dias
});

it('preserva cobertura paga ao trocar dia e não cobra os dias de transição', async () => {
  await invoice('2030-01-17');
  const master = await fixture.login(app, actors.master);
  const res = await auth(request(app).put('/api/saas/arenas/1'), master).send({ nome:'Arena A',dia_vencimento:10 });
  expect(res.status).toBe(200);
  expect((await invoices())[0].periodo_fim).toBe('2030-02-17');
  await gerarFaturasVencidas('2030-03-09');
  expect(await invoices()).toHaveLength(1);
  await gerarFaturasVencidas('2030-03-10');
  expect((await invoices())[1]).toMatchObject({ data_vencimento:'2030-03-10',periodo_fim:'2030-04-10',valor:10000 });
});

it.each([0,32,-1,1.5,'10abc','',null,true])('recusa dia inválido %s sem mudar cadastro', async dia => {
  const master = await fixture.login(app, actors.master);
  const res = await auth(request(app).put('/api/saas/arenas/1'),master).send({ nome:'Não salvar',dia_vencimento:dia });
  expect(res.status).toBe(400);
  expect((await db.getAsync('SELECT nome FROM Arenas WHERE id=1')).nome).toBe('Arena A');
});

it('impede alterar o aniversário antes da primeira fatura', async () => {
  const master = await fixture.login(app, actors.master);
  expect((await auth(request(app).put('/api/saas/arenas/1'),master).send({ nome:'Arena A',dia_vencimento:10 })).status).toBe(409);
});

it.each([['0','30',null],['1','3','2030-01-06']])('cadastro Master respeita trial global %s/%s apesar do payload antigo', async (ativo,dias,expected) => {
  vi.spyOn(dates,'getTodayString').mockReturnValue('2030-01-03');
  vi.spyOn(require('../src/services/emailService'),'sendEmail').mockResolvedValue(true);
  await db.runAsync("UPDATE ConfiguracoesSaaS SET valor=? WHERE chave='trial_ativo'",[ativo]);
  await db.runAsync("UPDATE ConfiguracoesSaaS SET valor=? WHERE chave='dias_trial'",[dias]);
  const master = await fixture.login(app,actors.master);
  const res = await auth(request(app).post('/api/saas/arenas'),master).send({nome:'Arena nova',email:'nova@example.test',plano_id:1,trial_dias:14});
  expect(res.status).toBe(201);
  expect(await db.getAsync('SELECT trial_expira_em,dia_vencimento FROM Arenas WHERE id=?',[res.body.id]))
    .toEqual({trial_expira_em:expected,dia_vencimento:expected ? 6 : 3});
});

it('bloqueia somente após completar tolerância e API informa a mesma política', async () => {
  vi.spyOn(dates,'getTodayString').mockReturnValue('2030-01-22');
  await invoice('2030-01-17','mensal','Pendente');
  expect((await executarBloqueioInadimplencia()).bloqueadas).toBe(0);
  dates.getTodayString.mockReturnValue('2030-01-23');
  expect((await executarBloqueioInadimplencia()).bloqueadas).toBe(1);
  const master = await fixture.login(app,actors.master);
  const config = await auth(request(app).get('/api/saas/configuracoes'),master);
  expect(config.body).toMatchObject({dias_tolerancia_bloqueio:5,data_faturamento:'2030-01-23'});
});

it('trial usa dias de calendário no fuso SaaS perto da meia-noite UTC', async () => {
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2030-01-04T01:30:00Z'));
  expect(dates.getTodayString()).toBe('2030-01-03');
  expect(await calendar.configurarCadastro()).toMatchObject({trialExpiraEm:'2030-01-17',diaVencimento:17});
});

it('cadastro sem trial usa a data local do timestamp UTC', async () => {
  await db.runAsync("UPDATE Arenas SET trial_expira_em=NULL,criado_em='2030-01-04 01:30:00' WHERE id=1");
  await gerarFaturasVencidas('2030-01-03');
  expect((await invoices())[0]).toMatchObject({data_vencimento:'2030-01-03',periodo_fim:'2030-02-03'});
});

it('renovação anual de 29 de fevereiro preserva o dia alvo em ano bissexto', async () => {
  await db.runAsync("UPDATE Arenas SET dia_vencimento=29,ciclo_cobranca='anual',trial_expira_em='2032-02-29' WHERE id=1");
  await gerarFaturasVencidas('2036-03-01');
  expect((await invoices()).map(f=>f.data_vencimento)).toEqual(['2032-02-29','2033-02-28','2034-02-28','2035-02-28','2036-02-29']);
});

it('mudanças repetidas de vencimento não recalculam faturas já emitidas', async () => {
  await invoice('2030-01-17','anual');
  const master = await fixture.login(app,actors.master);
  for (const dia of [31,10,20]) {
    const response = await auth(request(app).put('/api/saas/arenas/1'),master).send({nome:'Arena A',dia_vencimento:dia});
    expect(response.status).toBe(200);
    expect((await invoices())[0].periodo_fim).toBe('2031-01-17');
  }
  const admin = await fixture.login(app,actors.admin);
  const info = await auth(request(app).get('/api/tenant/assinatura/plano'),admin);
  expect(info.body.cobertura_ate).toBe('2031-01-17');
  expect(info.body.proximo_vencimento).toBe('2031-01-20');
});

it('tolerância zero é preservada e configuração inválida é rejeitada', async () => {
  const master = await fixture.login(app,actors.master);
  for (const value of [-1,1.5,'5abc',366]) {
    expect((await auth(request(app).put('/api/saas/configuracoes'),master).send({dias_tolerancia_bloqueio:value})).status).toBe(400);
  }
  expect((await auth(request(app).put('/api/saas/configuracoes'),master).send({dias_tolerancia_bloqueio:0})).status).toBe(200);
  vi.spyOn(dates,'getTodayString').mockReturnValue('2030-01-17');
  await invoice('2030-01-17','mensal','Pendente');
  expect((await executarBloqueioInadimplencia()).bloqueadas).toBe(0);
  dates.getTodayString.mockReturnValue('2030-01-18');
  expect((await executarBloqueioInadimplencia()).bloqueadas).toBe(1);
});
