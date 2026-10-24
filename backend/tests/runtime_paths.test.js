const path = require('node:path');
const runtimePaths = require('../src/config/runtimePaths');

afterEach(() => vi.unstubAllEnvs());

it('uses separate absolute data and uploads directories for a persistent disk', () => {
  vi.stubEnv('APP_DATA_DIR', path.resolve('persistent/db'));
  vi.stubEnv('UPLOADS_DIR', path.resolve('persistent/uploads'));
  expect(runtimePaths.dataDir()).toBe(path.resolve('persistent/db'));
  expect(runtimePaths.uploadsDir()).toBe(path.resolve('persistent/uploads'));
});

it('rejects relative persistent paths', () => {
  vi.stubEnv('APP_DATA_DIR', 'relative/db');
  expect(runtimePaths.dataDir).toThrow();
});
