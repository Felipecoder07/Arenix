const request = require('supertest');
const { allowedOrigins } = require('../src/config/cors');
const fixture = require('./helpers/securityFixture.cjs');
const app = require('../src/app');

describe('Local origin configuration', () => {
  const interfaces = { ethernet: [{ address: '192.168.0.3', family: 'IPv4' }] };

  it('accepts this computer on the local app ports', () => {
    const origins = allowedOrigins({ NODE_ENV: 'development' }, interfaces);
    expect(origins).toContain('http://192.168.0.3:5173');
    expect(origins).toContain('http://192.168.0.3:5176');
    expect(origins).toContain('http://127.0.0.1:5173');
    expect(origins).not.toContain('http://192.168.0.10:5173');
    expect(origins).not.toContain('http://192.168.0.3:9999');
  });

  it('uses only explicitly configured origins when configured', () => {
    expect(allowedOrigins({ CORS_ALLOWED_ORIGINS: 'https://arena.example.test' }, interfaces))
      .toEqual(['https://arena.example.test']);
  });

  it('never infers local origins in production', () => {
    expect(allowedOrigins({ NODE_ENV: 'production' }, interfaces)).toEqual([]);
  });
});

describe('Login origin validation', () => {
  beforeAll(fixture.initialize);
  beforeEach(fixture.seed);
  afterAll(fixture.close);

  it.each(allowedOrigins().filter(origin => origin.endsWith(':5173') || origin.endsWith(':5176')))
  ('allows login and session validation through %s', async origin => {
    const response = await request(app).post('/api/auth/login').set('Origin', origin)
      .send({ email: 'u1@example.test', senha: fixture.PASSWORD });
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    const session = await request(app).get('/api/auth/me').set('Origin', origin)
      .set('Cookie', response.headers['set-cookie'].map(cookie => cookie.split(';')[0]));
    expect(session.status).toBe(200);
    expect(session.body.usuario.id).toBe(1);
  });

  it('rejects an external origin with 403 instead of an internal error', async () => {
    const response = await request(app).post('/api/auth/login')
      .set('Origin', 'https://untrusted.example.test')
      .send({ email: 'u1@example.test', senha: fixture.PASSWORD });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Origem nao permitida.');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
