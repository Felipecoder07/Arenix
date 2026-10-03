const request = require('supertest');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');
const { getTodayString } = require('../src/utils/dateUtils');

describe('Indicadores financeiros do dashboard', () => {
  beforeAll(fixture.initialize);
  beforeEach(fixture.seed);
  afterAll(fixture.close);

  test('soma apenas o saldo pendente das reservas de hoje da arena', async () => {
    const hoje = getTodayString('America/Sao_Paulo');
    await fixture.db.runAsync('UPDATE Reservas SET data_reserva = ? WHERE id IN (1, 2, 3)', [hoje]);
    await fixture.db.runAsync("UPDATE Reservas SET status_pagamento = 'Parcial' WHERE id = 1");
    await fixture.db.runAsync("UPDATE Reservas SET status_pagamento = 'Pago' WHERE id = 2");
    await fixture.db.runAsync("INSERT INTO Pagamentos(reserva_id, valor, metodo) VALUES(1, 3000, 'Pix'), (2, 10000, 'Pix')");

    const session = await fixture.login(app, fixture.actors.admin);
    const response = await fixture.auth(request(app).get('/api/dashboard/resumo'), session);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      faturamentoPendente: 7000,
      reservasPendentesDia: 1,
      reservasDia: 2
    });
  });
});
