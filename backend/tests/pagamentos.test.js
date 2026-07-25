const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Configura o ambiente como teste ANTES de carregar o banco e app
process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

// Gera token de teste Administrador (Arena 1)
const adminToken1 = jwt.sign({
  id: 10,
  tenant_id: 1,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

// Gera token de teste Administrador (Arena 2)
const adminToken2 = jwt.sign({
  id: 20,
  tenant_id: 2,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

describe('Testes de Integração Financeira — Regras de Caixa, Descontos e Estornos', () => {

  beforeAll(async () => {
    // Inicializa o banco de dados de testes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Limpa tabelas para garantir isolamento contra poluição de dados
    await db.runAsync("DELETE FROM Reservas");
    await db.runAsync("DELETE FROM Clientes");
    await db.runAsync("DELETE FROM Quadras");
    await db.runAsync("DELETE FROM Arenas");
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Pagamentos");

    // Cadastra Arenas
    await db.runAsync("INSERT INTO Arenas (id, nome, status) VALUES (1, 'Arena 1', 1)");
    await db.runAsync("INSERT INTO Arenas (id, nome, status) VALUES (2, 'Arena 2', 1)");

    // Cadastra Clientes
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email) VALUES (1, 1, 'Cliente A', 'clientea@test.com')");
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email) VALUES (2, 2, 'Cliente B', 'clienteb@test.com')");

    // Cadastra Quadras
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base) VALUES (1, 1, 'Quadra A', 100.0)");
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base) VALUES (2, 2, 'Quadra B', 120.0)");

    // Cadastra Reservas
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento) 
      VALUES (100, 1, 1, 1, '2026-12-15', '10:00', '11:00', 100.0, 'Confirmada', 'Pendente')
    `);
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento) 
      VALUES (200, 2, 2, 2, '2026-12-15', '10:00', '11:00', 120.0, 'Confirmada', 'Pendente')
    `);
  });

  it('Deve rejeitar o registro de pagamento com método de pagamento inválido', async () => {
    const res = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        valor: 50.0,
        metodo: 'MetodoInvalido'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Método de pagamento inválido');
  });

  it('Deve registrar um pagamento parcial com sucesso se o método for válido', async () => {
    const res = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        valor: 60.0,
        metodo: 'Pix'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Pagamento registrado com sucesso.');
    expect(res.body).toHaveProperty('saldo_devedor', 40.0);
    expect(res.body).toHaveProperty('status_pagamento', 'Parcial');
  });

  it('Deve rejeitar desconto negativo ou maior que 100%', async () => {
    const resNeg = await request(app)
      .post('/api/pagamentos/desconto')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        desconto_percentual: -10
      });
    expect(resNeg.statusCode).toBe(400);
    expect(resNeg.body.error).toContain('O desconto deve estar entre 0% e 100%');

    const resOver = await request(app)
      .post('/api/pagamentos/desconto')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        desconto_percentual: 110
      });
    expect(resOver.statusCode).toBe(400);
    expect(resOver.body.error).toContain('O desconto deve estar entre 0% e 100%');
  });

  it('Deve rejeitar desconto que reduza o valor total para menos do que já foi pago', async () => {
    const res = await request(app)
      .post('/api/pagamentos/desconto')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        desconto_percentual: 50
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Desconto inválido');
  });

  it('Deve aplicar desconto com sucesso se respeitar o limite pago', async () => {
    const res = await request(app)
      .post('/api/pagamentos/desconto')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        desconto_percentual: 30
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('novo_valor_total', 70);
    expect(res.body).toHaveProperty('saldo_devedor', 10);
  });

  it('Deve impedir novos pagamentos se a reserva estiver cancelada', async () => {
    await db.runAsync("UPDATE Reservas SET status = 'Cancelada' WHERE id = 200");

    const res = await request(app)
      .post('/api/pagamentos')
      .set('Authorization', `Bearer ${adminToken2}`)
      .send({
        reserva_id: 200,
        valor: 50.0,
        metodo: 'Dinheiro'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Não é permitido registrar pagamentos para uma reserva cancelada.');
  });

  it('Deve impedir o estorno de valor maior do que o saldo líquido pago', async () => {
    const res = await request(app)
      .post('/api/pagamentos/estorno')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        valor: 70.0,
        motivo: 'Estorno de teste excessivo'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('não pode ser maior que o saldo disponível para estorno');
  });

  it('Deve permitir estorno parcial com sucesso e atualizar saldo/status', async () => {
    const res = await request(app)
      .post('/api/pagamentos/estorno')
      .set('Authorization', `Bearer ${adminToken1}`)
      .send({
        reserva_id: 100,
        valor: 40.0,
        motivo: 'Estorno de teste parcial'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('saldo_devedor', 50.0);
    expect(res.body).toHaveProperty('status_pagamento', 'Parcial');
  });

  it('SaaS Multi-Tenant Isolation (IDOR check): Não deve permitir ler histórico de pagamentos de outra arena', async () => {
    const res = await request(app)
      .get('/api/pagamentos/reserva/200')
      .set('Authorization', `Bearer ${adminToken1}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});
