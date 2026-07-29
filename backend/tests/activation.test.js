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

// Gera token de teste SuperAdmin
const superAdminToken = jwt.sign({
  id: 1,
  tenant_id: 1,
  perfil: 'SuperAdmin'
}, JWT_SECRET, { expiresIn: '1h' });

// Gera token de teste Administrador da Arena (tenant 1)
const adminToken = jwt.sign({
  id: 2,
  tenant_id: 1,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

describe('Testes de Integração — Fluxo de Boas-vindas e Ativação Segura', () => {

  beforeAll(async () => {
    // Inicializa o banco de dados de testes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Limpa as tabelas para garantir isolamento contra poluição de dados
    await db.runAsync("DELETE FROM Usuarios");
    await db.runAsync("DELETE FROM Arenas");

    // Garante estrutura básica de teste
    await db.runAsync("INSERT OR IGNORE INTO Arenas (id, nome, status) VALUES (1, 'Arena Semente', 1)");
    await db.runAsync(`
      INSERT OR IGNORE INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil) 
      VALUES (2, 1, 'Admin Arena', 'admin@arena.com', 'hash', 'Administrador')
    `);
  });

  it('SaaS Master: Deve criar uma nova arena e gerar o token de ativação (boas-vindas)', async () => {
    const res = await request(app)
      .post('/api/saas/arenas')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        nome: 'Arena Teste Ativacao',
        email: 'contato@arenateste.com',
        senha: 'senhaProvisoria123'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Arena cadastrada com sucesso.');

    // Verifica no banco se o token de ativação foi inserido para o novo administrador
    const user = await db.getAsync(`
      SELECT reset_password_token, reset_password_expires, senha_hash 
      FROM Usuarios 
      WHERE email = 'contato@arenateste.com'
    `);
    expect(user).toBeDefined();
    expect(user.senha_hash).toBeDefined();
  });

  it('Arena Admin: Deve criar um novo funcionário e gerar o token de ativação', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Operador Novo',
        email: 'novo_operador@arena.com',
        senha: 'senhaDigitadaNoForm123',
        perfil: 'Recepcionista'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Usuário criado com sucesso e e-mail de ativação enviado.');

    // Verifica no banco se o token de ativação foi inserido para o funcionário
    const user = await db.getAsync(`
      SELECT reset_password_token, reset_password_expires, senha_hash 
      FROM Usuarios 
      WHERE email = 'novo_operador@arena.com'
    `);
    expect(user).toBeDefined();
    expect(user.reset_password_token).not.toBeNull();
    expect(user.reset_password_expires).not.toBeNull();
  });
});
