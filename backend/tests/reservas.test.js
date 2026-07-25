const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Configura o ambiente como teste ANTES de carregar o banco e app
process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const dbPath = path.resolve(__dirname, '../data/courtmanager_test.sqlite');

// Limpa o banco de teste antigo se existir para garantir isolamento total
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
  } catch (e) {
    console.warn("Erro ao deletar banco de teste, pode estar travado:", e.message);
  }
}

const db = require('../src/config/database');
const initDb = require('../src/config/init_db');
const app = require('../src/app');

// Gera token de teste válido com tenant_id = 1 (Arena 1)
const testToken = jwt.sign({
  id: 1,
  tenant_id: 1,
  perfil: 'Administrador'
}, JWT_SECRET, { expiresIn: '1h' });

describe('Testes de Integração de Reservas e Validação de Conflito de Horário (RN-001)', () => {

  beforeAll(async () => {
    // Inicializa o esquema de tabelas e sementes
    initDb();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Insere dados de teste específicos (Arena, Quadras e Cliente)
    await db.runAsync("INSERT OR IGNORE INTO Arenas (id, nome, status) VALUES (1, 'Arena Teste', 1)");
    await db.runAsync("INSERT OR IGNORE INTO Clientes (id, tenant_id, nome, telefone) VALUES (1, 1, 'Cliente Teste', '11999999999')");
    await db.runAsync("INSERT OR IGNORE INTO Quadras (id, tenant_id, nome, tipo, preco_base) VALUES (1, 1, 'Quadra 1 Areia', 'Areia', 100)");
    await db.runAsync("INSERT OR IGNORE INTO Quadras (id, tenant_id, nome, tipo, preco_base) VALUES (2, 1, 'Quadra 2 Padel', 'Saibro', 120)");
  });

  afterAll(async () => {
    // Fecha o banco de dados e tenta deletar o arquivo temporário
    await new Promise((resolve) => {
      db.close(() => {
        resolve();
      });
    });
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {}
    }
  });

  it('Deve criar uma reserva com sucesso na Quadra 1 se não houver conflito', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-14', // data futura válida
        hora_inicio: '19:00',
        hora_fim: '20:30'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Reserva criada com sucesso.');
    expect(res.body).toHaveProperty('valor_total', 150); // 1.5 horas * 100/hora = 150
    expect(res.body).toHaveProperty('reserva_id');
  });

  it('Deve impedir a criação de reserva (409) se houver sobreposição exata de horários', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-14',
        hora_inicio: '19:00',
        hora_fim: '20:30'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error', 'A quadra já possui uma reserva neste horário.');
  });

  it('Deve impedir a criação de reserva (409) se houver sobreposição parcial (dentro do intervalo)', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-14',
        hora_inicio: '19:30',
        hora_fim: '20:00'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error', 'A quadra já possui uma reserva neste horário.');
  });

  it('Deve criar a reserva com sucesso se o horário iniciar exatamente quando a outra termina (boundary check)', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-14',
        hora_inicio: '20:30',
        hora_fim: '21:30'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Reserva criada com sucesso.');
  });

  it('Deve criar a reserva com sucesso se for no mesmo horário, mas em outra quadra', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 2, // Quadra 2 está livre nesse horário
        data_reserva: '2026-12-14',
        hora_inicio: '19:00',
        hora_fim: '20:30'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Reserva criada com sucesso.');
    expect(res.body).toHaveProperty('valor_total', 180); // 1.5 horas * 120/hora = 180
    expect(res.body).toHaveProperty('reserva_id');
  });

  it('Deve impedir a criação de reserva (400) se o horário estiver fora de expediente', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-14',
        hora_inicio: '07:00', // funcionamento inicia as 08:00
        hora_fim: '08:30'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Reserva fora do horário de funcionamento (08:00 às 22:00).');
  });

  it('Deve impedir a criação de reserva (400) se a data for passada', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2025-01-01', // data passada
        hora_inicio: '10:00',
        hora_fim: '11:00'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Não é permitido criar agendamentos em datas passadas.');
  });

  it('Deve cancelar uma reserva com sucesso', async () => {
    const resCreate = await request(app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        cliente_id: 1,
        quadra_id: 1,
        data_reserva: '2026-12-15',
        hora_inicio: '10:00',
        hora_fim: '11:00'
      });

    const reservaId = resCreate.body.reserva_id;

    const resCancel = await request(app)
      .patch(`/api/reservas/${reservaId}/cancelar`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        motivo: -1,
        observacoes: 'Cliente ligou desistindo'
      });

    expect(resCancel.statusCode).toBe(200);
    expect(resCancel.body).toHaveProperty('message', 'Reserva cancelada com sucesso.');
  });
});
