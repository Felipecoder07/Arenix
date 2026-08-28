const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

describe('Testes de Integração — Upgrade Self-Service de Planos SaaS (Módulo 2)', () => {
  let adminToken;
  let arenaId;
  let userId;

  beforeAll(async () => {
    initDb();
    await new Promise(r => setTimeout(r, 1000));

    // Garantir planos de teste com nomes e valores consistentes
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Basic', max_quadras = 3, max_usuarios = 3, valor_mensal = 49.99, valor_anual = 39.99 WHERE id = 1");
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Pro', max_quadras = 10, max_usuarios = 10, valor_mensal = 79.99, valor_anual = 63.99 WHERE id = 2");
    await db.runAsync("UPDATE PlanosSaaS SET nome = 'Enterprise', max_quadras = 999, max_usuarios = 999, valor_mensal = 499.90, valor_anual = 399.90 WHERE id = 3");
    await db.runAsync("INSERT OR IGNORE INTO PlanosSaaS (id, nome, max_quadras, max_usuarios, valor_mensal, valor_anual) VALUES (1, 'Basic', 3, 3, 49.99, 39.99)");
    await db.runAsync("INSERT OR IGNORE INTO PlanosSaaS (id, nome, max_quadras, max_usuarios, valor_mensal, valor_anual) VALUES (2, 'Pro', 10, 10, 79.99, 63.99)");
    await db.runAsync("INSERT OR IGNORE INTO PlanosSaaS (id, nome, max_quadras, max_usuarios, valor_mensal, valor_anual) VALUES (3, 'Enterprise', 999, 999, 499.90, 399.90)");

    // 1. Criar arena de teste no Plano Basic (ID 1)
    const uniqueSuffix = Date.now() + '_' + Math.floor(Math.random() * 1000);
    const arenaRes = await db.runAsync(`
      INSERT INTO Arenas (nome, slug, email, plano_id, ciclo_cobranca, status, dia_vencimento)
      VALUES (?, ?, ?, 1, 'mensal', 1, 10)
    `, ['Arena Teste Upgrade', `arena-upgrade-${uniqueSuffix}`, `upgrade_${uniqueSuffix}@arena.com`]);
    arenaId = arenaRes.lastID;

    // 2. Criar usuário Administrador para a arena
    const userRes = await db.runAsync(`
      INSERT INTO Usuarios (nome, email, senha_hash, perfil, tenant_id, ativo)
      VALUES (?, ?, '$2b$10$hashedpassword', 'Administrador', ?, 1)
    `, ['Admin Upgrade', `admin_${uniqueSuffix}@testeupgrade.com`, arenaId]);
    userId = userRes.lastID;

    // 3. Gerar token JWT do Admin
    adminToken = jwt.sign({
      id: userId,
      tenant_id: arenaId,
      perfil: 'Administrador'
    }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Limpeza dos dados de teste
    await db.runAsync('DELETE FROM FaturasSaaS WHERE tenant_id = ?', [arenaId]);
    await db.runAsync('DELETE FROM Quadras WHERE tenant_id = ?', [arenaId]);
    await db.runAsync('DELETE FROM Usuarios WHERE tenant_id = ?', [arenaId]);
    await db.runAsync('DELETE FROM Arenas WHERE id = ?', [arenaId]);
  });

  it('1. GET /api/tenant/assinatura/planos-disponiveis — Deve listar todos os planos SaaS', async () => {
    const res = await request(app)
      .get('/api/tenant/assinatura/planos-disponiveis')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some(p => p.nome === 'Basic')).toBe(true);
    expect(res.body.some(p => p.nome === 'Pro')).toBe(true);
  });

  it('2. POST /api/tenant/assinatura/solicitar-upgrade — Deve rejeitar plano inexistente com 404', async () => {
    const res = await request(app)
      .post('/api/tenant/assinatura/solicitar-upgrade')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plano_id: 999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('não encontrado');
  });

  it('3. POST /api/tenant/assinatura/solicitar-upgrade — Deve gerar fatura e Pix para o Plano Pro', async () => {
    const planoPro = await db.getAsync("SELECT id, valor_mensal FROM PlanosSaaS WHERE nome = 'Pro'");
    expect(planoPro).toBeDefined();

    const res = await request(app)
      .post('/api/tenant/assinatura/solicitar-upgrade')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plano_id: planoPro.id });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fatura_id');
    expect(res.body.plano_nome).toBe('Pro');
    expect(res.body.valor).toBe(planoPro.valor_mensal);
    expect(res.body).toHaveProperty('pix');

    // Verificar se fatura foi criada no banco
    const fatura = await db.getAsync('SELECT * FROM FaturasSaaS WHERE id = ?', [res.body.fatura_id]);
    expect(fatura).toBeDefined();
    expect(fatura.tenant_id).toBe(arenaId);
    expect(fatura.plano_id).toBe(planoPro.id);
    expect(fatura.valor).toBe(planoPro.valor_mensal);
    expect(fatura.status).toBe('Pendente');
  });

  it('4. POST /api/tenant/assinatura/faturas/:id/simular-pagamento — Deve liquidar fatura via endpoint e atualizar plano para Pro', async () => {
    const planoPro = await db.getAsync("SELECT id FROM PlanosSaaS WHERE nome = 'Pro'");

    // Buscar a fatura pendente
    const fatura = await db.getAsync('SELECT id, gateway_ref FROM FaturasSaaS WHERE tenant_id = ? AND status = "Pendente"', [arenaId]);
    expect(fatura).toBeDefined();

    const res = await request(app)
      .post(`/api/tenant/assinatura/faturas/${fatura.id}/simular-pagamento`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Paga');
    expect(res.body.pago).toBe(true);
    expect(res.body.plano_atualizado).toBe(true);

    // Verificar se a arena agora está no Plano Pro
    const arenaAtualizada = await db.getAsync('SELECT plano_id, status FROM Arenas WHERE id = ?', [arenaId]);
    expect(arenaAtualizada.plano_id).toBe(planoPro.id);
    expect(arenaAtualizada.status).toBe(1);

    // Verificar consulta de status-pagamento (Verificar Agora)
    const faturaAtualizada = await db.getAsync('SELECT gateway_ref FROM FaturasSaaS WHERE id = ?', [fatura.id]);
    const resStatus = await request(app)
      .get(`/api/tenant/assinatura/status-pagamento/${faturaAtualizada.gateway_ref}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resStatus.status).toBe(200);
    expect(resStatus.body.pago).toBe(true);
    expect(resStatus.body.status).toBe('Paga');
  });

  it('4.1 Segurança Multi-Tenant: Outro tenant NÃO pode simular fatura alheia', async () => {
    // Criar outro tenant B
    const uniqueB = Date.now() + '_other';
    const arenaB = await db.runAsync("INSERT INTO Arenas (nome, slug, email, plano_id, status) VALUES ('Arena B', ?, ?, 1, 1)", [`arena-b-${uniqueB}`, `b_${uniqueB}@arena.com`]);
    const userB = await db.runAsync("INSERT INTO Usuarios (nome, email, senha_hash, perfil, tenant_id, ativo) VALUES ('Admin B', ?, '$2b$10$hashed', 'Administrador', ?, 1)", [`admin_b_${uniqueB}@b.com`, arenaB.lastID]);
    const tokenB = jwt.sign({ id: userB.lastID, tenant_id: arenaB.lastID, perfil: 'Administrador' }, JWT_SECRET, { expiresIn: '1h' });

    // Buscar fatura do tenant A
    const faturaA = await db.getAsync('SELECT id FROM FaturasSaaS WHERE tenant_id = ? LIMIT 1', [arenaId]);
    expect(faturaA).toBeDefined();

    // Tenant B tenta simular pagamento da fatura do Tenant A
    const res = await request(app)
      .post(`/api/tenant/assinatura/faturas/${faturaA.id}/simular-pagamento`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('não pertence à sua arena');

    // Cleanup Tenant B
    await db.runAsync('DELETE FROM Usuarios WHERE id = ?', [userB.lastID]);
    await db.runAsync('DELETE FROM Arenas WHERE id = ?', [arenaB.lastID]);
  });

  it('4.2 Idempotência: Simular fatura já paga deve retornar sucesso sem duplicar ações', async () => {
    const faturaPaga = await db.getAsync('SELECT id FROM FaturasSaaS WHERE tenant_id = ? AND status = "Paga"', [arenaId]);
    expect(faturaPaga).toBeDefined();

    const res = await request(app)
      .post(`/api/tenant/assinatura/faturas/${faturaPaga.id}/simular-pagamento`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Paga');
    expect(res.body.pago).toBe(true);
  });

  it('5. Upgrade com Ciclo Anual — Deve calcular o valor anual com desconto (12 meses)', async () => {
    const planoPro = await db.getAsync("SELECT id, valor_mensal, valor_anual FROM PlanosSaaS WHERE nome = 'Pro'");
    const precoEsperado = parseFloat(((planoPro.valor_anual > 0 ? planoPro.valor_anual : planoPro.valor_mensal * 0.8) * 12).toFixed(2));

    const res = await request(app)
      .post('/api/tenant/assinatura/solicitar-upgrade')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plano_id: planoPro.id, ciclo: 'anual' });

    expect(res.status).toBe(200);
    expect(res.body.ciclo).toBe('anual');
    expect(res.body.valor).toBe(precoEsperado);
    expect(res.body.descricao).toContain('Anual');
  });

  it('6. GET /api/tenant/assinatura/faturas/:id/recibo — Deve gerar comprovante detalhado para fatura paga', async () => {
    // Buscar uma fatura que foi liquidada
    const faturaPaga = await db.getAsync('SELECT id FROM FaturasSaaS WHERE tenant_id = ? AND status = "Paga"', [arenaId]);
    expect(faturaPaga).toBeDefined();

    const res = await request(app)
      .get(`/api/tenant/assinatura/faturas/${faturaPaga.id}/recibo`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recibo_numero');
    expect(res.body).toHaveProperty('fatura');
    expect(res.body).toHaveProperty('plano');
    expect(res.body).toHaveProperty('arena');
    expect(res.body).toHaveProperty('emissor');
    expect(res.body.fatura.status).toBe('Paga');
  });
});
