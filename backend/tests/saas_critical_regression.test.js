const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const { registrarPagamentoManual, registrarEstorno } = require('../src/services/saasSettlementService');
const { liquidarFaturaSaaS } = require('../src/services/saasBillingService');
const { executarLimpezaFantasmas } = require('../src/jobs/limpezaFantasmas');

describe('Proteções de pagamento e acesso SaaS', () => {
  let arenaId;
  beforeAll(async () => {
    initDb();
    await db.getAsync('SELECT 1');
    await require('../src/config/securitySchema').ensureSecuritySchema(db);
  });
  beforeEach(async () => {
    await db.runAsync("INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES('mp_master_access_token','FIXTURE-MASTER-SECRET')");
    await db.runAsync("INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES('mp_master_identity',?)",
      [JSON.stringify({ id: '123', fingerprint: require('../src/utils/security').hash('FIXTURE-MASTER-SECRET') })]);
    const result = await db.runAsync(`INSERT INTO Arenas (nome, plano_id, status, motivo_bloqueio, criado_em)
      VALUES ('Regressão SaaS', 1, 0, 'inadimplencia', '2020-01-01')`);
    arenaId = result.lastID;
  });
  const arena = () => db.getAsync('SELECT * FROM Arenas WHERE id = ?', [arenaId]);
  async function invoice({ plano = 1, vencimento = '2020-01-01', ref = null } = {}) {
    const result = await db.runAsync(`INSERT INTO FaturasSaaS
      (tenant_id, plano_id, valor, ciclo, status, data_vencimento, gateway_ref)
      VALUES (?, ?, 10000, 'anual', 'Pendente', ?, ?)`, [arenaId, plano, vencimento, ref]);
    return result.lastID;
  }

  it('mantém bloqueio até quitar todas as faturas vencidas', async () => {
    const first = await invoice();
    const second = await invoice();
    await registrarPagamentoManual(first, null);
    expect((await arena()).status).toBe(0);
    await registrarPagamentoManual(second, null);
    expect((await arena()).status).toBe(1);
  });

  it.each(['manual', null])('preserva bloqueio %s ao receber pagamento', async motivo => {
    await db.runAsync('UPDATE Arenas SET motivo_bloqueio = ? WHERE id = ?', [motivo, arenaId]);
    await registrarPagamentoManual(await invoice(), null);
    expect((await arena()).status).toBe(0);
  });

  it('pagamento manual aplica somente o upgrade solicitado e seu ciclo', async () => {
    const id = await invoice({ plano: 2 });
    await db.runAsync('UPDATE Arenas SET fatura_plano_pendente_id = ? WHERE id = ?', [id, arenaId]);
    await registrarPagamentoManual(id, null);
    expect(await arena()).toMatchObject({ plano_id: 2, ciclo_cobranca: 'anual', fatura_plano_pendente_id: null });
  });

  it('Pix de uma fatura antiga não reverte o plano atual', async () => {
    await db.runAsync('UPDATE Arenas SET plano_id = 2 WHERE id = ?', [arenaId]);
    await invoice({ ref: '1001' });
    await liquidarFaturaSaaS('1001', { id: 1001, status: 'approved', currency_id: 'BRL', collector_id: 123, transaction_amount: 100 });
    expect((await arena()).plano_id).toBe(2);
  });

  it('estorno bloqueia imediatamente mesmo antes do vencimento e é repetível', async () => {
    const id = await invoice({ vencimento: '2099-01-01', ref: '1002' });
    await registrarPagamentoManual(id, null);
    const payment = { id: 1002, status: 'refunded', currency_id: 'BRL', collector_id: 123, transaction_amount: 100 };
    await registrarEstorno('1002', payment);
    await registrarEstorno('1002', payment);
    expect(await arena()).toMatchObject({ status: 0, motivo_bloqueio: 'estorno' });
    await registrarPagamentoManual(await invoice({ vencimento: '2099-02-01' }), null);
    expect((await arena()).status).toBe(0);
  });

  it('recusa estorno divergente sem modificar a fatura ou arena', async () => {
    const id = await invoice({ ref: '1003' });
    await registrarPagamentoManual(id, null);
    await expect(registrarEstorno('1003', { id: 1003, status: 'charged_back', currency_id: 'BRL', transaction_amount: 99 })).rejects.toThrow('divergente');
    expect((await arena()).status).toBe(1);
    expect((await db.getAsync('SELECT status FROM FaturasSaaS WHERE id = ?', [id])).status).toBe('Paga');
  });

  it('limpeza preserva arena inadimplente após trial sem pagamentos', async () => {
    await db.runAsync("UPDATE Arenas SET trial_expira_em = '2020-01-15' WHERE id = ?", [arenaId]);
    await invoice();
    await executarLimpezaFantasmas();
    expect((await arena()).status).toBe(0);
  });
});
