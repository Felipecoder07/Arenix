const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Configura o ambiente como teste ANTES de carregar o banco e app
process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const dbPath = path.resolve(__dirname, '../data/courtmanager_test.sqlite');

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

// Gera token de teste válido com perfil Administrador
const validToken = jwt.sign({
  id: 1,
  tenant_id: 1,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

// Gera token com assinatura inválida
const invalidToken = jwt.sign({
  id: 1,
  tenant_id: 1,
  perfil: 'Administrador'
}, 'wrong-secret-key-123', { expiresIn: '1h' });

describe('Testes de Integração de Segurança — Endpoint /me', () => {

  beforeAll(async () => {
    // Inicializa o esquema de tabelas e sementes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Limpa as tabelas para garantir isolamento contra poluição de dados
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Arenas");

    // Insere dados de teste para o Usuário ID 1
    await db.runAsync("INSERT OR IGNORE INTO Arenas (id, nome, status) VALUES (1, 'Arena Teste', 1)");
    await db.runAsync(`
      INSERT OR IGNORE INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil) 
      VALUES (1, 1, 'Operador Teste', 'test@test.com', 'hash', 'Administrador')
    `);
  });

  it('Deve retornar 200 e os dados detalhados do usuário quando o token for válido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('autenticado', true);
    expect(res.body).toHaveProperty('usuario');
    expect(res.body.usuario).toHaveProperty('nome', 'Operador Teste');
    expect(res.body.usuario).toHaveProperty('email', 'test@test.com');
    expect(res.body.usuario).toHaveProperty('perfil', 'Administrador');
    expect(res.body.usuario).toHaveProperty('arena_nome', 'Arena Teste');
  });

  it('Deve retornar 401 (Não Autorizado) quando o token for inválido (assinatura errada)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${invalidToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Token expirado ou inválido.');
  });

  it('Deve retornar 403 (Token Não Fornecido) quando a requisição não enviar cabeçalho de autenticação', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('error', 'Token não fornecido.');
  });
});
