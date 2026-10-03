const request = require('supertest');
const app = require('../src/app');
const { checkoutContact } = require('../src/services/bookingService');
const fixture = require('./helpers/securityFixture.cjs');
const { db, initialize, seed } = fixture;

beforeAll(async () => {
  await initialize();
});

beforeEach(async () => {
  await seed();
});

it('keeps public bookings Pix-only even when an arena has a card key', async () => {
  await db.runAsync("UPDATE Arenas SET gateway_public_key='TEST-PUBLIC-FIXTURE' WHERE id=1");
  const before = (await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count;
  const response = await request(app)
    .post('/api/public/tenant/arena-a/agendar')
    .send({
      payment_method: 'card', nome: 'Visitante Seguro', telefone: '11999999999',
      quadra_id: 1, data_reserva: '2099-12-22', hora_inicio: '10:00', hora_fim: '11:00'
    });
  expect(response.status).toBe(403);
  expect((await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count).toBe(before);
});

it('generates a direct Pix QR when the arena has only a Pix key', async () => {
  const before = (await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count;
  const response = await request(app)
    .post('/api/public/tenant/arena-a/agendar')
    .send({
      nome: 'Visitante Seguro', telefone: '11999999999',
      quadra_id: 1, data_reserva: '2099-12-22', hora_inicio: '10:00', hora_fim: '11:00'
    });
  expect(response.status).toBe(201);
  expect(response.body.manual_confirmation).toBe(true);
  expect(response.body.copia_cola).toContain('BR.GOV.BCB.PIX');
  expect(response.body.qr_code).toMatch(/^data:image\/png;base64,/);
  expect((await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count).toBe(before + 1);
});

it('does not replace a failed dynamic Pix charge with an untracked static QR', async () => {
  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-TOKEN' WHERE id=1");
  const provider = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fixture gateway unavailable'));
  try {
    const response = await request(app)
      .post('/api/public/tenant/arena-a/agendar')
      .send({
        nome: 'Visitante Seguro', telefone: '11999999999', email: 'visitante@example.test',
        quadra_id: 1, data_reserva: '2099-12-22', hora_inicio: '10:00', hora_fim: '11:00'
      });
    expect(response.status).toBe(202);
    expect(response.body.payment_pending_review).toBe(true);
    expect(response.body).not.toHaveProperty('qr_code');
    expect(response.body).not.toHaveProperty('copia_cola');
    expect(provider).toHaveBeenCalledTimes(1);
    const row = await db.getAsync('SELECT status_pagamento,observacoes_cancelamento FROM Reservas WHERE id=?', [response.body.reserva_id]);
    expect(row.status_pagamento).toBe('Pendente');
    expect(row.observacoes_cancelamento).toBe('Cobranca pendente de conciliacao');
    expect((await db.getAsync('SELECT COUNT(*) AS count FROM Pagamentos')).count).toBe(0);
  } finally { provider.mockRestore(); }
});

it('reopens a direct Pix QR without a gateway and reports gateway outages for gateway bookings', async () => {
  const owner = await fixture.login(app, fixture.actors.owner);
  const noGateway = await fixture.auth(request(app).get('/api/public/tenant/arena-a/reserva-pix/1'), owner);
  expect(noGateway.status).toBe(200);
  expect(noGateway.body.manual_confirmation).toBe(true);
  expect(noGateway.body.copia_cola).toContain('BR.GOV.BCB.PIX');

  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-TOKEN' WHERE id=1");
  await db.runAsync("UPDATE Reservas SET pix_checkout_mode='mercado_pago' WHERE id=1");
  const provider = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fixture gateway unavailable'));
  try {
    const unavailable = await fixture.auth(request(app).get('/api/public/tenant/arena-a/reserva-pix/1'), owner);
    expect(unavailable.status).toBe(202);
    expect(unavailable.body.payment_pending_review).toBe(true);
    expect(unavailable.body).not.toHaveProperty('copia_cola');
    expect(unavailable.body).not.toHaveProperty('qr_code');
    expect(provider).toHaveBeenCalledTimes(1);
  } finally { provider.mockRestore(); }
});

it('validates guest contact data on the server', () => {
  expect(() => checkoutContact({ nome: 'A', telefone: 'abc' })).toThrow(/Nome e telefone/);
  expect(() => checkoutContact({ nome: 'Visitante', telefone: '11999999999', email: 'invalid' })).toThrow(/Contato inválido/);
  expect(() => checkoutContact({ nome: 'Visitante', telefone: '11999999999', cpf: '123' })).toThrow(/Contato inválido/);
  expect(checkoutContact({
    nome: ' Visitante Seguro ',
    telefone: '(11) 99999-9999',
    email: 'visitante@example.test',
    cpf: '123.456.789-01'
  })).toEqual({
    nome: 'Visitante Seguro',
    telefone: '(11) 99999-9999',
    email: 'visitante@example.test',
    cpf: '123.456.789-01'
  });
});

it('rolls back the booking if its scoped guest capability cannot be persisted', async () => {
  await db.runAsync("UPDATE Arenas SET gateway_access_token='FIXTURE-TOKEN' WHERE id=1");
  const before = {
    reservas: (await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count,
    clientes: (await db.getAsync('SELECT COUNT(*) AS count FROM Clientes')).count,
    contacts: (await db.getAsync('SELECT COUNT(*) AS count FROM BookingContacts')).count
  };
  await db.runAsync(`
    CREATE TRIGGER reject_guest_access
    BEFORE INSERT ON GuestAccess
    BEGIN
      SELECT RAISE(ABORT, 'guest access unavailable');
    END
  `);

  const response = await request(app)
    .post('/api/public/tenant/arena-a/agendar')
    .send({
      nome: 'Visitante Seguro',
      telefone: '11999999999',
      quadra_id: 1,
      data_reserva: '2099-12-22',
      hora_inicio: '10:00',
      hora_fim: '11:00'
    });

  expect(response.status).toBe(500);
  expect(response.headers['set-cookie']).toBeUndefined();
  expect((await db.getAsync('SELECT COUNT(*) AS count FROM Reservas')).count).toBe(before.reservas);
  expect((await db.getAsync('SELECT COUNT(*) AS count FROM Clientes')).count).toBe(before.clientes);
  expect((await db.getAsync('SELECT COUNT(*) AS count FROM BookingContacts')).count).toBe(before.contacts);
});
