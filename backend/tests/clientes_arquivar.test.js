const request = require('supertest');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

const testToken = jwt.sign({
  id: 1,
  tenant_id: 100,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

describe('Testes de Integração — Arquivamento de Clientes (Soft Delete)', () => {
  let clienteId;

  beforeAll(async () => {
    initDb();
    await new Promise(resolve => setTimeout(resolve, 500));
    await db.runAsync('INSERT OR IGNORE INTO Arenas (id, nome, slug, status) VALUES (100, "Arena Teste", "arena-teste", 1)');
    await db.runAsync('DELETE FROM Reservas WHERE tenant_id = 100');
    await db.runAsync('DELETE FROM Clientes WHERE tenant_id = 100');
  });

  afterAll(async () => {
    await db.runAsync('DELETE FROM Reservas WHERE tenant_id = 100');
    await db.runAsync('DELETE FROM Clientes WHERE tenant_id = 100');
  });

  test('1. Deve criar cliente novo (ativo = 1 por padrão)', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        nome: 'Carlos Arquivavel',
        telefone: '(11) 98888-7777',
        email: 'carlos.teste@email.com'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.ativo).toBe(1);
    clienteId = res.body.id;
  });

  test('2. Deve listar o novo cliente na busca padrão (?ativo=1)', async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    const encontrado = res.body.find(c => c.id === clienteId);
    expect(encontrado).toBeDefined();
    expect(encontrado.nome).toBe('Carlos Arquivavel');
  });

  test('3. Deve arquivar o cliente com sucesso (PATCH /api/clientes/:id/arquivar)', async () => {
    const res = await request(app)
      .patch(`/api/clientes/${clienteId}/arquivar`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('arquivado com sucesso');
  });

  test('4. Não deve mais retornar o cliente na lista principal de ativos', async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    const encontrado = res.body.find(c => c.id === clienteId);
    expect(encontrado).toBeUndefined();
  });

  test('5. Deve retornar o cliente arquivado ao buscar com ?ativo=0', async () => {
    const res = await request(app)
      .get('/api/clientes?ativo=0')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    const encontrado = res.body.find(c => c.id === clienteId);
    expect(encontrado).toBeDefined();
    expect(encontrado.ativo).toBe(0);
  });

  test('6. Deve desarquivar/reativar o cliente (PATCH /api/clientes/:id/desarquivar)', async () => {
    const res = await request(app)
      .patch(`/api/clientes/${clienteId}/desarquivar`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('reativado com sucesso');

    // Verifica se voltou para a lista de ativos
    const resList = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${testToken}`);

    expect(resList.status).toBe(200);
    const reativado = resList.body.find(c => c.id === clienteId);
    expect(reativado).toBeDefined();
  });
});
