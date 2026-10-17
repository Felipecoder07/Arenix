const bcrypt = require('bcrypt');
const fixture = require('./helpers/securityFixture.cjs');
const { bootstrapMaster } = require('../src/services/bootstrapMasterService');
const config = { BOOTSTRAP_MASTER_EMAIL: 'MASTER@fixture.example.test', BOOTSTRAP_MASTER_PASSWORD: 'Test-Only-Master-123!' };
beforeAll(() => fixture.initialize());
beforeEach(async () => { await fixture.db.runAsync('DELETE FROM Usuarios'); });
afterAll(() => fixture.close());

it('does nothing without explicit bootstrap credentials', async () => {
  expect(await bootstrapMaster(fixture.db, {})).toBe('disabled');
  expect((await fixture.db.getAsync('SELECT COUNT(*) AS total FROM Usuarios')).total).toBe(0);
});

it('creates one global Master with a hashed password and preserves it on restart', async () => {
  expect(await bootstrapMaster(fixture.db, config)).toBe('created');
  const user = await fixture.db.getAsync('SELECT * FROM Usuarios');
  expect(user).toMatchObject({ email: 'master@fixture.example.test', perfil: 'SuperAdmin', ativo: 1, tenant_id: null });
  expect(await bcrypt.compare(config.BOOTSTRAP_MASTER_PASSWORD, user.senha_hash)).toBe(true);
  expect(await bootstrapMaster(fixture.db, { ...config, BOOTSTRAP_MASTER_PASSWORD: 'Different-Password-123!' })).toBe('exists');
  expect(await fixture.db.getAsync('SELECT * FROM Usuarios')).toEqual(user);
});

it('rejects an incomplete configuration', async () => {
  await expect(bootstrapMaster(fixture.db, { BOOTSTRAP_MASTER_EMAIL: config.BOOTSTRAP_MASTER_EMAIL })).rejects.toThrow('Configure');
});

it('does not promote an existing regular account', async () => {
  await fixture.db.runAsync("INSERT INTO Usuarios(nome,email,senha_hash,perfil) VALUES('Cliente',?,'unused','Cliente')", [config.BOOTSTRAP_MASTER_EMAIL.toLowerCase()]);
  await expect(bootstrapMaster(fixture.db, config)).rejects.toThrow('outra conta');
  expect((await fixture.db.getAsync('SELECT perfil FROM Usuarios')).perfil).toBe('Cliente');
});
