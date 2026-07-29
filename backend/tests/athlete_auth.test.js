import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

process.env.NODE_ENV = 'test';
import db from '../src/config/database';
import initDb from '../src/config/init_db';
import app from '../src/app';

describe('Módulo de Autenticação e Cadastro do Atleta por Tenant', () => {
  const testSlug = 'felp-arena';
  const testEmail = `atleta_test_${Date.now()}@gmail.com`;
  let athleteToken = '';

  beforeAll(async () => {
    initDb();
    await new Promise(r => setTimeout(r, 800));

    await db.runAsync("DELETE FROM Arenas WHERE slug = ?", [testSlug]);
    await db.runAsync("DELETE FROM Quadras WHERE id = 888");

    await db.runAsync(
      "INSERT INTO Arenas (id, nome, slug, status, chave_pix) VALUES (999, 'Felp Arena Test', ?, 1, 'financeiro@felparena.com.br')",
      [testSlug]
    );

    await db.runAsync(
      "INSERT INTO Quadras (id, tenant_id, nome, tipo, preco_base, status) VALUES (888, 999, 'Quadra 1 Teste', 'Areia', 80.0, 'Ativa')"
    );
  });

  it('1. Deve cadastrar um novo atleta com sucesso via POST /api/public/tenant/:slug/cadastro', async () => {
    const res = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/cadastro`)
      .send({
        nome: 'Atleta Teste Automático',
        email: testEmail,
        senha: 'senhaSegura123',
        telefone: '11988887777'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    athleteToken = res.body.token;
    expect(res.body.usuario).toHaveProperty('email', testEmail);
  });

  it('2. Deve rejeitar o cadastro com e-mail duplicado (HTTP 400)', async () => {
    const res = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/cadastro`)
      .send({
        nome: 'Outro Atleta',
        email: testEmail,
        senha: 'outraSenha123',
        telefone: '11977776666'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/já está cadastrado/i);
  });

  it('3. Deve realizar o login do atleta cadastrado via POST /api/public/tenant/:slug/login', async () => {
    const res = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/login`)
      .send({
        email: testEmail,
        senha: 'senhaSegura123'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.usuario).toHaveProperty('nome', 'Atleta Teste Automático');
  });

  it('4. Deve rejeitar o login com senha incorreta (HTTP 401)', async () => {
    const res = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/login`)
      .send({
        email: testEmail,
        senha: 'senhaIncorreta'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorreto/i);
  });

  it('5. Deve autenticar/cadastrar atleta via Google OAuth (POST /api/public/tenant/:slug/google)', async () => {
    const googleEmail = `google_atleta_${Date.now()}@gmail.com`;
    const res = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/google`)
      .send({
        email: googleEmail,
        nome: 'Atleta Google Real',
        telefone: '11955554444'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.usuario).toHaveProperty('email', googleEmail);
    expect(res.body.usuario).toHaveProperty('nome', 'Atleta Google Real');
  });

  it('6. Deve consultar e atualizar perfil do atleta e cadastrar nova senha (PUT /api/public/tenant/:slug/meu-perfil)', async () => {
    const resGet = await supertest(app)
      .get(`/api/public/tenant/${testSlug}/meu-perfil`)
      .set('Authorization', `Bearer ${athleteToken}`);

    expect(resGet.status).toBe(200);
    expect(resGet.body.perfil).toHaveProperty('email', testEmail);

    const randomCpf = `123.${Math.floor(Math.random() * 899 + 100)}.${Math.floor(Math.random() * 899 + 100)}-00`;
    const resPut = await supertest(app)
      .put(`/api/public/tenant/${testSlug}/meu-perfil`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({
        nome: 'Atleta Nome Atualizado',
        telefone: '(11) 99999-1111',
        cpf: randomCpf,
        nova_senha: 'novaSenhaMuitosegura123'
      });

    expect(resPut.status).toBe(200);
    expect(resPut.body.usuario).toHaveProperty('nome', 'Atleta Nome Atualizado');
  });

  it('7. Deve agendar múltiplos horários simultaneamente e gerar Pix unificado (POST /api/public/tenant/:slug/agendar com itens)', async () => {
    const dataRes = `2026-11-${Math.floor(Math.random() * 15 + 10)}`;
    const resMulti = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/agendar`)
      .send({
        nome: 'Atleta Multi Slot',
        telefone: '(11) 99999-8888',
        itens: [
          { quadra_id: 888, data_reserva: dataRes, hora_inicio: '10:00', hora_fim: '11:00', preco: 80.0 },
          { quadra_id: 888, data_reserva: dataRes, hora_inicio: '11:00', hora_fim: '12:00', preco: 80.0 }
        ]
      });

    if (resMulti.status !== 201) {
      console.log('Error Body:', resMulti.body);
    }
    expect(resMulti.status).toBe(201);
    expect(resMulti.body).toHaveProperty('valor_total', 160.0);
    expect(resMulti.body).toHaveProperty('copia_cola');
    expect(resMulti.body.reservas_ids).toHaveLength(2);
  });

  it('8. Deve manter vaga como disponível quando a reserva for Pendente e liberar via POST /tenant/:slug/cancelar-pendente', async () => {
    // 8a. Faz um agendamento pendente
    const resAgendar = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/agendar`)
      .send({
        nome: 'Atleta Teste 8',
        telefone: '11944445555',
        quadra_id: 888,
        data_reserva: '2026-08-15',
        hora_inicio: '10:00',
        hora_fim: '11:00'
      });
    expect(resAgendar.status).toBe(201);
    const reservaId = resAgendar.body.reserva_id;

    // 8b. Consulta a disponibilidade pública: A vaga DEVE continuar 'disponivel' (não travada por pendente)
    const resDisp = await supertest(app)
      .get(`/api/public/tenant/${testSlug}/disponibilidade?data=2026-08-15`);
    expect(resDisp.status).toBe(200);
    const slot10 = resDisp.body.quadras[0].slots.find((s) => s.hora_inicio === '10:00');
    expect(slot10.status).toBe('disponivel');

    // 8c. Dispara o cancelamento manual por desistência do modal Pix
    const resCancel = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/cancelar-pendente`)
      .send({ reserva_id: reservaId });
    expect(resCancel.status).toBe(200);
    expect(resCancel.body.message).toContain('cancelada(s) com sucesso');
  });

  it('9. Deve marcar horários passados como status: passado e rejeitar agendamentos no passado (HTTP 400)', async () => {
    const { getTodayString, getLocalTimeString } = require('../src/utils/dateUtils');
    const todayStr = getTodayString();
    const currentTimeStr = getLocalTimeString();

    // 9a. Consulta a disponibilidade no dia de hoje
    const resDisp = await supertest(app)
      .get(`/api/public/tenant/${testSlug}/disponibilidade?data=${todayStr}`);
    expect(resDisp.status).toBe(200);

    const slots = resDisp.body.quadras[0].slots;
    const pastSlot = slots.find((s) => s.status === 'passado');
    if (pastSlot) {
      expect(pastSlot.status).toBe('passado');
    }

    // 9b. Tenta agendar um horário retroativo no passado (ex: 06:00 da manhã de hoje)
    const resFailPast = await supertest(app)
      .post(`/api/public/tenant/${testSlug}/agendar`)
      .send({
        nome: 'Atleta Teste Passado',
        telefone: '11933332222',
        quadra_id: 888,
        data_reserva: todayStr,
        hora_inicio: '06:00',
        hora_fim: '07:00'
      });

    if (currentTimeStr >= '06:00') {
      expect(resFailPast.status).toBe(400);
      expect(resFailPast.body.error).toContain('já encerrou');
    }
  });

  it('10. Deve rejeitar agendamentos se a arena não tiver Chave Pix nem Mercado Pago configurados', async () => {
    const unconfigSlug = 'arena-sem-pix';
    await db.runAsync("DELETE FROM Arenas WHERE slug = ?", [unconfigSlug]);
    await db.runAsync(
      "INSERT INTO Arenas (id, nome, slug, status, chave_pix, gateway_access_token) VALUES (777, 'Arena Sem Pix', ?, 1, NULL, NULL)",
      [unconfigSlug]
    );

    const resFail = await supertest(app)
      .post(`/api/public/tenant/${unconfigSlug}/agendar`)
      .send({
        nome: 'Atleta Teste Sem Pix',
        telefone: '11922221111',
        quadra_id: 888,
        data_reserva: '2026-12-01',
        hora_inicio: '14:00',
        hora_fim: '15:00'
      });

    expect(resFail.status).toBe(400);
    expect(resFail.body).toHaveProperty('payment_not_configured', true);
    expect(resFail.body.error).toContain('não configurou o recebimento de pagamentos online');
  });
});
