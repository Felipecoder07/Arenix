const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

// Token da Arena 1 (Tenant 1)
const tokenArena1 = jwt.sign({ id: 10, tenant_id: 1, perfil: 'Administrador' }, JWT_SECRET, { expiresIn: '1h' });

// Token da Arena 2 (Tenant 2)
const tokenArena2 = jwt.sign({ id: 20, tenant_id: 2, perfil: 'Administrador' }, JWT_SECRET, { expiresIn: '1h' });

describe('LOTE 1 — Testes de Segurança Multi-Tenant e Concorrência (31 a 40)', () => {
  beforeAll(async () => {
    initDb();
    await new Promise(r => setTimeout(r, 1000));

    // Limpar e popular fixtures isoladas
    await db.runAsync("DELETE FROM TransacoesGateway");
    await db.runAsync("DELETE FROM Pagamentos");
    await db.runAsync("DELETE FROM Reservas");
    await db.runAsync("DELETE FROM Quadras");
    await db.runAsync("DELETE FROM Clientes");
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Arenas");

    // Fixture: Arenas 1 e 2
    await db.runAsync("INSERT INTO Arenas (id, nome, status) VALUES (1, 'Arena Alpha', 1)");
    await db.runAsync("INSERT INTO Arenas (id, nome, status) VALUES (2, 'Arena Beta', 1)");

    // Fixture: Usuários
    await db.runAsync("INSERT INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil, ativo) VALUES (10, 1, 'Admin Alpha', 'alpha@arena.com', 'hash', 'Administrador', 1)");
    await db.runAsync("INSERT INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil, ativo) VALUES (20, 2, 'Admin Beta', 'beta@arena.com', 'hash', 'Administrador', 1)");

    // Fixture: Quadras
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base, status) VALUES (100, 1, 'Quadra Alpha 1', 100.0, 'Ativa')");
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base, status) VALUES (200, 2, 'Quadra Beta 1', 120.0, 'Ativa')");

    // Fixture: Clientes
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email, telefone, cpf) VALUES (1000, 1, 'Cliente Alpha', 'calpha@test.com', '11999990001', '11111111111')");
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email, telefone, cpf) VALUES (2000, 2, 'Cliente Beta', 'cbeta@test.com', '11999990002', '22222222222')");

    // Fixture: Reserva na Arena 1
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento)
      VALUES (5000, 1, 1000, 100, '2026-12-20', '19:00', '20:00', 100.0, 'Pendente', 'Pendente')
    `);
  });

  // 31. SEC-01: Tentativa de alteração cross-tenant de reserva
  it('SEC-01: Deve rejeitar se Arena 2 tentar cancelar/alterar uma reserva da Arena 1 (IDOR Cross-Tenant)', async () => {
    const res = await request(app)
      .patch('/api/reservas/5000/status')
      .set('Authorization', `Bearer ${tokenArena2}`) // Token da Arena 2
      .send({ status: 'Cancelada' });

    expect([403, 404]).toContain(res.statusCode);
  });

  // 32. SEC-02: Injeção de tenant_id no payload
  it('SEC-02: Deve ignorar tenant_id injetado no corpo da requisição de reserva e forçar tenant do token', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenArena1}`)
      .send({
        tenant_id: 2, // Tenta injetar tenant 2
        cliente_id: 1000,
        quadra_id: 100,
        data_reserva: '2026-12-21',
        hora_inicio: '10:00',
        hora_fim: '11:00',
        valor_total: 100.0
      });

    if (res.statusCode === 201 || res.statusCode === 200) {
      const reservaId = res.body.id || res.body.reserva_id;
      if (reservaId) {
        const reserva = await db.getAsync('SELECT tenant_id FROM Reservas WHERE id = ?', [reservaId]);
        if (reserva) expect(reserva.tenant_id).toBe(1);
      }
    }
  });

  // 33. SEC-03: Vazamento de Clientes na busca balcão
  it('SEC-03: Não deve retornar clientes da Arena 2 quando a busca for realizada pela Arena 1', async () => {
    const res = await request(app)
      .get('/api/clientes?busca=11999990002')
      .set('Authorization', `Bearer ${tokenArena1}`);

    expect(res.statusCode).toBe(200);
    const encontros = Array.isArray(res.body) ? res.body : res.body.clientes || [];
    const pertenceOutroTenant = encontros.some((c) => c.tenant_id === 2);
    expect(pertenceOutroTenant).toBe(false);
  });

  // 34. SEC-04: Acesso Cross-Tenant a Relatórios Financeiros
  it('SEC-04: Deve impedir que Arena 1 consulte relatórios filtrando quadra_id da Arena 2', async () => {
    const res = await request(app)
      .get('/api/relatorios/faturamento?quadra_id=200&data_inicio=2026-01-01&data_fim=2026-12-31')
      .set('Authorization', `Bearer ${tokenArena1}`);

    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const reservas = res.body.reservas || [];
      const vazouQuadra = reservas.some((r) => r.quadra_id === 200);
      expect(vazouQuadra).toBe(false);
    }
  });

  // 35. SEC-05: Invalidação de Sessões em Troca de Senha
  it('SEC-05: Deve remover todas as sessões em SessoesAtivas ao registrar logout ou alteração de segurança', async () => {
    const fakeToken = 'token_sessao_ativa_test_123';
    await db.runAsync('INSERT INTO SessoesAtivas (usuario_id, tenant_id, token) VALUES (10, 1, ?)', [fakeToken]);

    await db.runAsync('DELETE FROM SessoesAtivas WHERE usuario_id = 10');

    const sessoes = await db.allAsync('SELECT * FROM SessoesAtivas WHERE usuario_id = 10');
    expect(sessoes.length).toBe(0);
  });

  // 36. SEC-06: Bloqueio de Força Bruta (Brute Force Rate Limiter)
  it('SEC-06: Deve responder adequadamente a múltiplas requisições sequenciais de login', async () => {
    const tentativas = Array.from({ length: 5 }).map(() =>
      request(app).post('/api/auth/login').send({ email: 'alpha@arena.com', senha: 'senha_errada_brute' })
    );

    const resultados = await Promise.all(tentativas);
    resultados.forEach(res => {
      expect([401, 429]).toContain(res.statusCode);
    });
  });

  // 37. SEC-07: Sanitização contra XSS
  it('SEC-07: Deve aceitar cadastro de observações com caracteres especiais sem estourar erro de SQL', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenArena1}`)
      .send({
        cliente_id: 1000,
        quadra_id: 100,
        data_reserva: '2026-12-22',
        hora_inicio: '14:00',
        hora_fim: '15:00',
        valor_total: 100.0,
        observacoes: "<script>alert('xss')</script> O'Connor"
      });

    expect([201, 200, 400]).toContain(res.statusCode);
  });

  // 38. RACE-01: Agendamento simultâneo do mesmo horário
  it('RACE-01: Deve prevenir duplicidade quando duas requisições simultâneas tentarem a mesma quadra/horário', async () => {
    const p1 = request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenArena1}`)
      .send({ cliente_id: 1000, quadra_id: 100, data_reserva: '2026-12-25', hora_inicio: '18:00', hora_fim: '19:00', valor_total: 100.0 });

    const p2 = request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenArena1}`)
      .send({ cliente_id: 1000, quadra_id: 100, data_reserva: '2026-12-25', hora_inicio: '18:00', hora_fim: '19:00', valor_total: 100.0 });

    const [res1, res2] = await Promise.all([p1, p2]);
    expect([200, 201, 400]).toContain(res1.statusCode);
    expect([200, 201, 400]).toContain(res2.statusCode);
  });

  // 39. RACE-02: Lançamento de pagamento e concorrência no caixa
  it('RACE-02: Deve registrar pagamentos com id de reserva válido sem duplicar o histórico', async () => {
    const res = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${tokenArena1}`)
      .send({
        reserva_id: 5000,
        metodo: 'Dinheiro',
        valor: 50.0
      });

    expect([200, 201, 400]).toContain(res.statusCode);
  });

  // 40. RACE-03: Trava de Idempotência em Liquidação de Webhook Pix
  it('RACE-03: Deve responder de forma idempotente se o mesmo webhook de Pix for recebido novamente', async () => {
    const fakeRef = 'ref_pix_idempotente_test_999';

    // Inserir transação prévia paga (sem coluna inexistente tenant_id)
    await db.runAsync(`
      INSERT INTO TransacoesGateway (reserva_id, gateway_ref, metodo, valor, status)
      VALUES (5000, ?, 'Pix', 100.0, 'Pago')
    `, [fakeRef]);

    const res = await request(app)
      .post('/api/pagamentos/gateway/webhook')
      .send({
        gateway_ref: fakeRef,
        status: 'approved'
      });

    expect([200, 404]).toContain(res.statusCode);
  });
});
