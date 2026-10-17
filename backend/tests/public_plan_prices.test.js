const request = require('supertest');
const app = require('../src/app');
const fixture = require('./helpers/securityFixture.cjs');

beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

it('returns public plan prices in reais while preserving cents in storage', async () => {
  const stored = await fixture.db.allAsync('SELECT * FROM PlanosSaaS ORDER BY valor_mensal ASC');
  expect(stored.length).toBeGreaterThan(0);
  const response = await request(app).get('/api/auth/planos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(stored.map(plan => ({
    ...plan,
    valor_mensal: plan.valor_mensal / 100,
    valor_anual: plan.valor_anual / 100,
  })));
  expect(response.body.find(plan => plan.nome === 'Basic')).toMatchObject({
    valor_mensal: 49.99,
    valor_anual: 39.99,
  });
  expect(await fixture.db.allAsync('SELECT * FROM PlanosSaaS ORDER BY valor_mensal ASC')).toEqual(stored);
});
