const request = require('supertest');
const app = require('../src/app');
const { db, initialize, seed, login, auth, actors } = require('./helpers/securityFixture.cjs');
const billing = require('../src/services/saasBillingService');
const dates = require('../src/utils/dateUtils');

describe('Troca de plano com cobrança integral', () => {
  let session;
  beforeAll(async () => {
    await initialize();
    await seed();
    await db.runAsync("DELETE FROM ConfiguracoesSaaS WHERE chave = 'mp_master_access_token'");
    session = await login(app);
  });
  beforeEach(async () => {
    await db.runAsync('DELETE FROM FaturasSaaS');
    await db.runAsync("UPDATE Arenas SET plano_id = 1, ciclo_cobranca = 'mensal', fatura_plano_pendente_id = NULL, trial_expira_em = NULL WHERE id = 1");
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Basic', valor_mensal = 5000, valor_anual = 4000, max_quadras = 2, max_usuarios = 3 WHERE id = 1");
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Pro', valor_mensal = 9000, valor_anual = 7000, max_quadras = 10, max_usuarios = 10 WHERE id = 2");
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Enterprise' WHERE id = 3");
  });
  const change = (body, actor = session) => auth(request(app).post('/api/tenant/assinatura/solicitar-upgrade'), actor).send(body);
  const arena = () => db.getAsync('SELECT * FROM Arenas WHERE id = 1');

  it('lista e resumo convertem centavos uma única vez e respeitam o período registrado', async () => {
    const old = await db.runAsync(`INSERT INTO FaturasSaaS
      (tenant_id,plano_id,valor,status,ciclo,data_vencimento,periodo_fim)
      VALUES(1,1,4999,'Pendente','mensal','2026-08-10','2026-08-25')`);
    await db.runAsync(`INSERT INTO FaturasSaaS
      (tenant_id,plano_id,valor,status,ciclo,data_vencimento,periodo_fim)
      VALUES(1,2,76788,'Pendente','anual','2027-01-10','2028-01-10')`);
    const list = await auth(request(app).get('/api/tenant/assinatura/faturas'), session);
    expect(list.body[0]).toMatchObject({ valor: 767.88, plano_nome: 'Pro', competencia: '10/01/2027 a 10/01/2028' });
    expect(list.body[1]).toMatchObject({ valor: 49.99, competencia: '10/08/2026 a 25/08/2026' });
    const info = await auth(request(app).get('/api/tenant/assinatura/plano'), session);
    expect(info.body.fatura_atual).toMatchObject({ id: old.lastID, valor: 49.99 });
  });

  it('recibo usa reais e não inventa identificação, método ou emissor; paga não vira pendência', async () => {
    const invoice = await db.runAsync(`INSERT INTO FaturasSaaS
      (tenant_id,plano_id,valor,status,ciclo,data_vencimento,periodo_fim,data_pagamento)
      VALUES(1,1,4999,'Paga','mensal','2026-08-10','2026-09-10','2026-08-10')`);
    const receipt = await auth(request(app).get(`/api/tenant/assinatura/faturas/${invoice.lastID}/recibo`), session);
    expect(receipt.status).toBe(200);
    expect(receipt.body.fatura).toMatchObject({ valor: 49.99, gateway_ref: null, metodo_pagamento: null, periodo_fim: '2026-09-10' });
    expect(receipt.body.emissor).toEqual({ empresa: null, cnpj: null, suporte: null });
    const info = await auth(request(app).get('/api/tenant/assinatura/plano'), session);
    expect(info.body.fatura_atual).toBeNull();
  });

  it('adiantamento e cron não inventam preço anual, mas permitem pagar uma fatura existente', async () => {
    await db.runAsync("UPDATE Arenas SET ciclo_cobranca = 'anual', criado_em = '2026-08-10' WHERE id = 1");
    await db.runAsync('UPDATE PlanosSaaS SET valor_anual = 0 WHERE id = 1');
    const advance = () => auth(request(app).post('/api/tenant/assinatura/adiantar-fatura'), session);
    expect((await advance()).status).toBe(409);
    await require('../src/jobs/cronSaaS').gerarFaturasVencidas('2026-08-10');
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM FaturasSaaS WHERE tenant_id = 1')).n).toBe(0);
    const invoice = await db.runAsync(`INSERT INTO FaturasSaaS
      (tenant_id,plano_id,valor,status,ciclo,data_vencimento,periodo_fim)
      VALUES(1,1,76788,'Pendente','anual','2026-08-10','2027-08-10')`);
    const res = await advance();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fatura_id: invoice.lastID, valor: 767.88 });
  });

  it.each([['mensal', 9000], ['anual', 84000]])('cobra integralmente o ciclo %s e aplica uma única vez após pagamento', async (ciclo, total) => {
    const res = await change({ plano_id: 2, ciclo, valor_confirmado_centavos: total, valor: 1 });
    expect(res.status).toBe(200);
    expect(res.body.valor).toBe(total / 100);
    expect((await arena()).plano_id).toBe(1);
    // A late payment starts a full cycle, not the expired invoice's period.
    await db.runAsync("UPDATE FaturasSaaS SET data_vencimento = '2020-01-01', periodo_fim = '2020-02-01' WHERE id = ?", [res.body.fatura_id]);
    await billing.liquidarFaturaSaaS(res.body.pix.gateway_ref);
    const after = await arena();
    const invoice = await db.getAsync('SELECT * FROM FaturasSaaS WHERE id = ?', [res.body.fatura_id]);
    expect(after).toMatchObject({ plano_id: 2, ciclo_cobranca: ciclo, fatura_plano_pendente_id: null });
    expect(invoice.periodo_fim).toBe(dates.calcularProximaDataVencimento(dates.getTodayString(), Number(dates.getTodayString().slice(8)), ciclo));
    await billing.liquidarFaturaSaaS(res.body.pix.gateway_ref);
    expect(await arena()).toEqual(after);
    expect((await change({ plano_id: 2, ciclo })).status).toBe(409);
    const info = await auth(request(app).get('/api/tenant/assinatura/plano'), session);
    expect(info.body.plano).toMatchObject({ id: 2, max_quadras: 10, max_usuarios: 10 });
    expect(info.body.cobertura_ate).toBe(invoice.periodo_fim);
  });

  it('reutiliza a fatura e Pix em tentativas simultâneas', async () => {
    const responses = await Promise.all([change({ plano_id: 2 }), change({ plano_id: 2 })]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(responses[0].body.fatura_id).toBe(responses[1].body.fatura_id);
    const retry = await change({ plano_id: 2 });
    expect(retry.body.fatura_id).toBe(responses[0].body.fatura_id);
    expect(retry.body.pix.reutilizado).toBe(true);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM FaturasSaaS')).n).toBe(1);
  });

  it('renova Pix expirado na mesma fatura', async () => {
    const first = await change({ plano_id: 2 });
    await db.runAsync("UPDATE FaturasSaaS SET qr_expira_em = '2020-01-01' WHERE id = ?", [first.body.fatura_id]);
    const retry = await auth(request(app).post(`/api/tenant/assinatura/faturas/${first.body.fatura_id}/gerar-pix`), session);
    expect(retry.status).toBe(200);
    expect(new Date(retry.body.expira_em).getTime()).toBeGreaterThan(Date.now());
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM FaturasSaaS')).n).toBe(1);
  });

  it('recusa preço desatualizado sem emitir fatura', async () => {
    expect((await change({ plano_id: 2, valor_confirmado_centavos: 8900 })).status).toBe(409);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM FaturasSaaS')).n).toBe(0);
  });

  it('permite downgrade dentro da capacidade', async () => {
    await db.runAsync('UPDATE Arenas SET plano_id = 2 WHERE id = 1');
    const res = await change({ plano_id: 1 });
    expect(res.status).toBe(200);
    expect((await arena()).plano_id).toBe(2);
    await billing.liquidarFaturaSaaS(res.body.pix.gateway_ref);
    expect((await arena()).plano_id).toBe(1);
  });

  it.each(['max_quadras', 'max_usuarios'])('bloqueia downgrade com excesso em %s', async field => {
    await db.runAsync('UPDATE Arenas SET plano_id = 2 WHERE id = 1');
    await db.runAsync(`UPDATE PlanosSaaS SET ${field} = 1 WHERE id = 1`);
    if (field === 'max_quadras') await db.runAsync("INSERT INTO Quadras(tenant_id,nome,status,preco_base) VALUES(1,'Excedente','Ativa',10000)");
    const res = await change({ plano_id: 1 });
    expect(res.status).toBe(400);
    expect((await db.getAsync('SELECT COUNT(*) AS n FROM FaturasSaaS')).n).toBe(0);
    await db.runAsync("DELETE FROM Quadras WHERE nome = 'Excedente'");
  });

  it('não aplica desconto anual inventado nem aceita ciclos desconhecidos ou Enterprise', async () => {
    await db.runAsync('UPDATE PlanosSaaS SET valor_anual = 0 WHERE id = 2');
    expect((await change({ plano_id: 2, ciclo: 'anual' })).status).toBe(409);
    expect((await change({ plano_id: 2, ciclo: 'semanal' })).status).toBe(400);
    expect((await change({ plano_id: 3 })).status).toBe(409);
  });

  it('recusa troca por recepcionista', async () => {
    expect((await change({ plano_id: 2 }, await login(app, actors.receptionist))).status).toBe(403);
  });

  it('falha de geração mantém fatura para retomada sem duplicar', async () => {
    const original = billing.gerarPixFaturaSaaS;
    billing.gerarPixFaturaSaaS = async () => { throw new Error('Provedor indisponível'); };
    let failed;
    try { failed = await change({ plano_id: 2 }); } finally { billing.gerarPixFaturaSaaS = original; }
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(failed.body.fatura_id).toBeTruthy();
    const retry = await change({ plano_id: 2 });
    expect(retry.status).toBe(200);
    expect(retry.body.fatura_id).toBe(failed.body.fatura_id);
    expect((await arena()).plano_id).toBe(1);
  });
});
