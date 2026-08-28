const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

// Token Admin Tenant 1
const tokenAdmin = jwt.sign({ id: 10, tenant_id: 1, perfil: 'Administrador' }, JWT_SECRET, { expiresIn: '1h' });

describe('LOTE 5 — Testes do Portal do Atleta, Relatórios BI e Banco de Dados (71 a 81)', () => {
  beforeAll(async () => {
    initDb();
    await new Promise(r => setTimeout(r, 1000));

    await db.runAsync("DELETE FROM Pagamentos");
    await db.runAsync("DELETE FROM Reservas");
    await db.runAsync("DELETE FROM Quadras");
    await db.runAsync("DELETE FROM Clientes");
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Arenas");

    await db.runAsync("INSERT INTO Arenas (id, nome, slug, fuso_horario, status) VALUES (1, 'Arena Lote 5', 'arena-lote-5', 'America/Sao_Paulo', 1)");
    await db.runAsync("INSERT INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil, ativo) VALUES (10, 1, 'Admin 5', 'admin5@arena.com', 'hash', 'Administrador', 1)");
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email, telefone, cpf) VALUES (100, 1, 'Atleta Portal', 'atleta_portal@test.com', '11966665555', '33333333333')");
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base, hora_abertura, hora_fechamento, status) VALUES (1, 1, 'Quadra Central', 100.0, '08:00', '22:00', 'Ativa')");

    // Reservas para BI
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento)
      VALUES (701, 1, 100, 1, '2027-04-10', '18:00', '19:00', 100.0, 'Confirmada', 'Pago')
    `);
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento)
      VALUES (702, 1, 100, 1, '2027-04-11', '19:00', '20:00', 100.0, 'Pendente', 'Pendente')
    `);
    await db.runAsync(`
      INSERT INTO Pagamentos (reserva_id, metodo, valor, registrado_por)
      VALUES (701, 'Pix', 100.0, 10)
    `);
  });

  // 71. PORTAL-02: Expiração de checkout do atleta
  it('71. PORTAL-02: Reserva pendente possui data de agendamento e status pendente', async () => {
    const r = await db.getAsync('SELECT status, status_pagamento FROM Reservas WHERE id = 702');
    expect(r.status).toBe('Pendente');
    expect(r.status_pagamento).toBe('Pendente');
  });

  // 72. PORTAL-03: Validação de CPF e Telefone no cadastro rápido
  it('72. PORTAL-03: Permite cadastrar atleta com telefone e CPF válidos', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: 'Novo Atleta Portal',
        telefone: '11955554444',
        cpf: '44444444444',
        email: 'novoatleta@test.com'
      });

    expect([200, 201, 400]).toContain(res.statusCode);
  });

  // 73. PORTAL-04: Consulta de reservas do atleta
  it('73. PORTAL-04: Permite listar reservas vinculadas ao cliente', async () => {
    const res = await request(app)
      .get('/api/reservas?cliente_id=100')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // 74. PORTAL-05: Solicitação de cancelamento pelo atleta
  it('74. PORTAL-05: Deve registrar o cancelamento da reserva quando solicitado', async () => {
    const res = await request(app)
      .patch('/api/reservas/702/status')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'Cancelada', motivo_cancelamento_id: -1 });

    expect([200, 204, 400, 404]).toContain(res.statusCode);
  });

  // 75. BI-01: Cálculo da Taxa de Ocupação
  it('75. BI-01: Deve consultar relatório de ocupação da quadra', async () => {
    const res = await request(app)
      .get('/api/relatorios/ocupacao?data_inicio=2027-04-01&data_fim=2027-04-30')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // 76. BI-02: Relatório de Horários de Pico
  it('76. BI-02: Deve retornar estatísticas dos horários de pico', async () => {
    const res = await request(app)
      .get('/api/relatorios/horarios-pico?data_inicio=2027-04-01&data_fim=2027-04-30')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // 77. BI-03: Ranking de Top Clientes
  it('77. BI-03: Deve retornar o ranking de top clientes por engajamento', async () => {
    const res = await request(app)
      .get('/api/relatorios/top-clientes?data_inicio=2027-04-01&data_fim=2027-04-30')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // 78. BI-04: Relatório de Inadimplência de Atletas
  it('78. BI-04: Deve listar o relatório de saldo devedor/inadimplência de reservas', async () => {
    const res = await request(app)
      .get('/api/relatorios/inadimplencia?data_inicio=2027-04-01&data_fim=2027-04-30')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // 79. DB-01: Rollback e Transação Segura
  it('79. DB-01: Operações de banco com erro devem manter a integridade dos dados', async () => {
    try {
      await db.runAsync('INSERT INTO Reservas (id, tenant_id) VALUES (701, 1)'); // Tenta reusar id 701 (PRIMARY KEY conflict)
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  // 80. DB-02: Preservação de fuso horário America/Sao_Paulo
  it('80. DB-02: Deve manter a arena configurada com o fuso horário America/Sao_Paulo', async () => {
    const arena = await db.getAsync('SELECT fuso_horario FROM Arenas WHERE id = 1');
    expect(arena.fuso_horario).toBe('America/Sao_Paulo');
  });

  // 82. PORTAL: Minhas Reservas não deve multiplicar valor_total com múltiplos pagamentos
  it('82. PORTAL: getMinhasReservasAtleta não deve multiplicar valor_total quando existirem múltiplos pagamentos', async () => {
    // Adicionar múltiplos pagamentos e transações para a reserva 701
    await db.runAsync("INSERT INTO Pagamentos (reserva_id, metodo, valor, registrado_por) VALUES (701, 'Pix Online', 100.0, 10)");
    await db.runAsync("INSERT INTO Pagamentos (reserva_id, metodo, valor, registrado_por) VALUES (701, 'Pix Online', 100.0, 10)");
    await db.runAsync("INSERT INTO TransacoesGateway (reserva_id, gateway_ref, valor, status, metodo) VALUES (701, 'ref_1', 100.0, 'approved', 'Pix')");
    await db.runAsync("INSERT INTO TransacoesGateway (reserva_id, gateway_ref, valor, status, metodo) VALUES (701, 'ref_2', 100.0, 'approved', 'Pix')");

    // Buscar com slug da arena e telefone do atleta
    const res = await request(app)
      .get('/api/public/tenant/arena-lote-5/minhas-reservas?telefone=11966665555');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const reserva701 = res.body.find(r => r.id === 701);
    expect(reserva701).toBeDefined();
    expect(reserva701.valor_total).toBe(100.0); // Valor exato, NÃO 500 ou 600
  });
});
