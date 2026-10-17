const { validateEnvironment } = require('../src/config/envValidation');

beforeEach(() => {
  vi.stubEnv('RENDER', '');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('JWT_SECRET', 'production-fixture-key-' + 'a'.repeat(48));
  vi.stubEnv('FRONTEND_URL', 'https://fixture.example.test');
  vi.stubEnv('CORS_ALLOWED_ORIGINS', 'https://fixture.example.test');
  vi.stubEnv('SECRETS_KEYRING', JSON.stringify({ first: 'ab'.repeat(32) }));
  vi.stubEnv('SECRETS_ACTIVE_KEY_ID', 'first');
  vi.stubEnv('TRUST_PROXY', '127.0.0.1/32,::1/128');
  vi.stubEnv('LISTEN_HOST', '127.0.0.1');
});
afterEach(() => vi.unstubAllEnvs());

it('accepts complete production configuration', () => expect(validateEnvironment()).toBeUndefined());
it('accepts the Render HTTPS origin and one trusted load balancer hop', () => {
  vi.stubEnv('RENDER', 'true');
  vi.stubEnv('RENDER_EXTERNAL_URL', 'https://arenix.onrender.com');
  vi.stubEnv('FRONTEND_URL', '');
  vi.stubEnv('CORS_ALLOWED_ORIGINS', '');
  vi.stubEnv('TRUST_PROXY', '');
  vi.stubEnv('LISTEN_HOST', '0.0.0.0');
  expect(validateEnvironment()).toBeUndefined();
  expect(require('../src/config/cors').allowedOrigins()).toEqual(['https://arenix.onrender.com']);
  const app = { set: vi.fn() };
  require('../src/config/proxy').configureProxy(app);
  expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
});
it('rejects incomplete Render proxy configuration', () => {
  vi.stubEnv('RENDER', 'true');
  vi.stubEnv('RENDER_EXTERNAL_URL', 'https://arenix.onrender.com');
  vi.stubEnv('LISTEN_HOST', '0.0.0.0');
  expect(validateEnvironment).toThrow();
});
it('allows local development without production settings', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('JWT_SECRET', '');
  expect(validateEnvironment()).toBeUndefined();
});
it.each([
  ['JWT_SECRET', ''], ['JWT_SECRET', 'short'], ['FRONTEND_URL', 'http://fixture.example.test'],
  ['CORS_ALLOWED_ORIGINS', '*'], ['CORS_ALLOWED_ORIGINS', 'https://fixture.example.test/path'],
  ['SECRETS_ACTIVE_KEY_ID', 'missing'], ['SECRETS_KEYRING', '{}'],
  ['TRUST_PROXY', 'true'], ['TRUST_PROXY', '0.0.0.0/0'], ['TRUST_PROXY', ''], ['LISTEN_HOST', '0.0.0.0'],
])('fails before startup for invalid %s', (key, value) => {
  vi.stubEnv(key, value);
  expect(validateEnvironment).toThrow();
});
