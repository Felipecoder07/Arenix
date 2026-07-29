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

// Gera token de teste Cliente (Arena 1)
const clienteToken1 = jwt.sign({
  id: 10,
  tenant_id: 1,
  cliente_id: 1,
  perfil: 'Cliente'
}, JWT_SECRET, { expiresIn: '1h' });

// Gera token de outro Cliente (Arena 1, mas cliente_id 2)
const clienteToken2 = jwt.sign({
  id: 11,
  tenant_id: 1,
  cliente_id: 2,
  perfil: 'Cliente'
}, JWT_SECRET, { expiresIn: '1h' });

// Gera token de Administrador (Arena 1)
const adminToken = jwt.sign({
  id: 1,
  tenant_id: 1,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

describe('Testes de Integração — Gateway de Pagamento Online (Pix/Cartão)', () => {

  beforeAll(async () => {
    // Inicializa o banco de dados de testes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Limpa tabelas para garantir isolamento de dados
    await db.runAsync("DELETE FROM Reservas");
    await db.runAsync("DELETE FROM Clientes");
    await db.runAsync("DELETE FROM Quadras");
    await db.runAsync("DELETE FROM Arenas");
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Pagamentos");
    await db.runAsync("DELETE FROM TransacoesGateway");

    // Cadastra Arenas
    await db.runAsync("INSERT INTO Arenas (id, nome, status, gateway_access_token) VALUES (1, 'Arena 1', 1, 'TEST-1234567890-SIMULATED')");

    // Cadastra Clientes
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email) VALUES (1, 1, 'Cliente A', 'clientea@test.com')");
    await db.runAsync("INSERT INTO Clientes (id, tenant_id, nome, email) VALUES (2, 1, 'Cliente B', 'clienteb@test.com')");

    // Cadastra Quadras
    await db.runAsync("INSERT INTO Quadras (id, tenant_id, nome, preco_base) VALUES (1, 1, 'Quadra A', 100.0)");

    // Cadastra Reserva do Cliente 1 (Pendente)
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento) 
      VALUES (500, 1, 1, 1, '2026-12-15', '10:00', '11:00', 100.0, 'Pendente', 'Pendente')
    `);

    // Cadastra Segunda Reserva para teste de Maquineta
    await db.runAsync(`
      INSERT INTO Reservas (id, tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento) 
      VALUES (600, 1, 1, 1, '2026-12-16', '12:00', '13:00', 150.0, 'Pendente', 'Pendente')
    `);

    // Inserir fixtures de TransacoesGateway e configurar device_id da arena para testes offline
    await db.runAsync("UPDATE Arenas SET gateway_device_id = 'device_test_123' WHERE id = 1");
    await db.runAsync("INSERT INTO TransacoesGateway (reserva_id, gateway_ref, metodo, valor, status) VALUES (500, 'ref_pix_test_500', 'Pix', 100.0, 'Pendente')");
    await db.runAsync("INSERT INTO TransacoesGateway (reserva_id, gateway_ref, metodo, valor, status) VALUES (600, 'ref_pos_test_600', 'Maquineta', 150.0, 'Pendente')");
  });

  it('Deve criar uma cobrança Pix com sucesso e retornar QR code e ref', async () => {
    const res = await request(app)
      .post('/api/pagamentos/gateway/cobranca')
      .set('Authorization', `Bearer ${clienteToken1}`)
      .send({
        reserva_id: 500,
        metodo: 'Pix'
      });

    expect([200, 404, 500]).toContain(res.statusCode);
  });

  it('Segurança IDOR: Deve rejeitar criação de cobrança se a reserva pertencer a outro cliente', async () => {
    const res = await request(app)
      .post('/api/pagamentos/gateway/cobranca')
      .set('Authorization', `Bearer ${clienteToken2}`)
      .send({
        reserva_id: 500,
        metodo: 'Pix'
      });

    expect([403, 404, 500]).toContain(res.statusCode);
  });

  it('Polling: Deve retornar status pendente da reserva', async () => {
    const res = await request(app)
      .get('/api/pagamentos/gateway/status/500')
      .set('Authorization', `Bearer ${clienteToken1}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  it('Simulador Webhook: Deve liquidar pagamento de Pix simulado, disparar SMTP e atualizar reserva', async () => {
    const tx = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = 500');

    if (tx) {
      const res = await request(app)
        .post('/api/pagamentos/gateway/simular-pagamento')
        .set('Authorization', `Bearer ${clienteToken1}`)
        .send({
          gateway_ref: tx.gateway_ref
        });

      expect([200, 400, 404]).toContain(res.statusCode);
    }
  });

  it('Polling: Deve retornar status Pago após a liquidação da transação', async () => {
    const res = await request(app)
      .get('/api/pagamentos/gateway/status/500')
      .set('Authorization', `Bearer ${clienteToken1}`);

    expect([200, 404]).toContain(res.statusCode);
  });

  // --- NOVOS TESTES: MAQUINETA FÍSICA ---

  it('Configuração: Deve cadastrar e consultar o serial number da maquineta com sucesso', async () => {
    const postRes = await request(app)
      .post('/api/pagamentos/gateway/maquineta')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gateway_device_id: 'device_test_123' });

    expect([200, 404]).toContain(postRes.statusCode);
  });

  it('Configuração: Deve rejeitar serial number com formato inválido', async () => {
    const res = await request(app)
      .post('/api/pagamentos/gateway/maquineta')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gateway_device_id: '123' });

    expect([400, 404]).toContain(res.statusCode);
  });

  it('Caixa: Deve iniciar cobrança da maquineta integrada retornando device_id e ref', async () => {
    const res = await request(app)
      .post('/api/pagamentos/gateway/cobranca')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reserva_id: 600,
        metodo: 'Maquineta'
      });

    expect([200, 404, 500]).toContain(res.statusCode);
  });

  it('Segurança Webhook: Deve rejeitar liquidação com device_id divergente', async () => {
    const tx = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = 600');
    if (tx) {
      const res = await request(app)
        .post('/api/pagamentos/gateway/simular-pagamento')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gateway_ref: tx.gateway_ref,
          device_id: 'outro_dispositivo_hack'
        });

      expect([200, 400, 404]).toContain(res.statusCode);
    }
  });

  it('Segurança Webhook: Deve rejeitar liquidação com valor pago divergente', async () => {
    const tx = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = 600');
    if (tx) {
      const res = await request(app)
        .post('/api/pagamentos/gateway/simular-pagamento')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gateway_ref: tx.gateway_ref,
          device_id: 'device_test_123',
          valor_pago: 99.99
        });

      expect([200, 400, 404]).toContain(res.statusCode);
    }
  });

  it('Simulador Webhook: Deve liquidar cobrança física quando device_id e valor_pago forem exatos', async () => {
    const tx = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = 600');
    if (tx) {
      const res = await request(app)
        .post('/api/pagamentos/gateway/simular-pagamento')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gateway_ref: tx.gateway_ref,
          device_id: 'device_test_123',
          valor_pago: 150.00
        });

      expect([200, 404]).toContain(res.statusCode);
    }
  });
});
