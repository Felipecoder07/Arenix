const os = require('node:os');

function allowedOrigins(env = process.env, interfaces = os.networkInterfaces()) {
  const configured = env.CORS_ALLOWED_ORIGINS || (env.RENDER === 'true' ? env.RENDER_EXTERNAL_URL : '');
  if (configured) {
    return configured.split(',').map(origin => origin.trim());
  }
  if (env.NODE_ENV === 'production') return [];

  // Vite also serves the local apps through this computer's network addresses.
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  for (const addresses of Object.values(interfaces)) {
    for (const { address, family } of addresses || []) {
      if (family === 'IPv4' || family === 4) hosts.add(address);
    }
  }
  return [...hosts].flatMap(host => [3000, 5173, 5174, 5175, 5176].map(port => `http://${host}:${port}`));
}

module.exports = { allowedOrigins };
