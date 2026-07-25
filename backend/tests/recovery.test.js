const request = require('supertest');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Configura o ambiente como teste ANTES de carregar o banco e app
process.env.NODE_ENV = 'test';

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

describe('Testes de Integração de Segurança — Fluxo de Recuperação de Senha', () => {

  beforeAll(async () => {
    // Inicializa o esquema de tabelas e sementes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Insere dados de teste para o Usuário
    await db.runAsync("INSERT OR IGNORE INTO Arenas (id, nome, status) VALUES (1, 'Arena Teste', 1)");
    const hash = await bcrypt.hash('senhaAntiga123', 12);
    await db.runAsync(`
      INSERT OR IGNORE INTO Usuarios (id, tenant_id, nome, email, senha_hash, perfil) 
      VALUES (99, 1, 'Usuario Recuperacao', 'recuperacao@test.com', ?, 'Administrador')
    `, [hash]);
  });

  it('Deve responder sucesso genérico mesmo se o e-mail não estiver cadastrado (User Enumeration Protection)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'inexistente@test.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.');
  });

  it('Deve gerar token de redefinição no banco quando o e-mail for válido', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'recuperacao@test.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.');

    // Verifica no banco de dados se o token foi gerado e salvo
    const user = await db.getAsync('SELECT reset_password_token, reset_password_expires FROM Usuarios WHERE id = 99');
    expect(user.reset_password_token).not.toBeNull();
    expect(user.reset_password_expires).not.toBeNull();
  });

  it('Deve impedir a redefinição se o token for incorreto ou inválido', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'token-falso-e-errado-12345',
        novaSenha: 'novaSenhaSegura123'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Token de recuperação inválido ou expirado.');
  });

  it('Deve redefinir a senha com sucesso quando o token for correto', async () => {
    // Busca o token válido gerado na etapa anterior
    const userBefore = await db.getAsync('SELECT reset_password_token FROM Usuarios WHERE id = 99');
    const validToken = userBefore.reset_password_token;

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validToken,
        novaSenha: 'novaSenhaSuperSegura123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Senha redefinida com sucesso!');

    // Verifica que o token de recuperação foi apagado (uso único)
    const userAfter = await db.getAsync('SELECT reset_password_token, reset_password_expires, senha_hash FROM Usuarios WHERE id = 99');
    expect(userAfter.reset_password_token).toBeNull();
    expect(userAfter.reset_password_expires).toBeNull();

    // Verifica que o hash da senha foi atualizado e condiz com a nova senha
    const isSamePassword = await bcrypt.compare('novaSenhaSuperSegura123', userAfter.senha_hash);
    expect(isSamePassword).toBe(true);
  });
});
