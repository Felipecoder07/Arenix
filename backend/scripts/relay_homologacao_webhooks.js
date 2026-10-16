// The public tunnel reaches only webhook routes, never the UI, login or files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const instanceTools = require('./homologacao_instance.cjs');
const instance = instanceTools.resolveInstance();
const manifest = instanceTools.verifySnapshot(instance);
const config = instanceTools.config(instance);
const evidence = path.join(instance, 'webhook-receipts.jsonl');
const allowed = new Set(['/api/pagamentos/gateway/webhook', '/api/saas/webhook-pagamento']);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const callback = req.method === 'GET' && url.pathname === '/api/pagamentos/gateway/oauth/callback' && Boolean(config.MERCADO_PAGO_REDIRECT_URI);
  if (!callback && (req.method !== 'POST' || !allowed.has(url.pathname))) { res.writeHead(404).end(); return; }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 262144) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const headers = { 'Content-Type': 'application/json' };
    for (const key of ['x-signature', 'x-request-id']) if (req.headers[key]) headers[key] = req.headers[key];
    const upstream = await fetch('http://127.0.0.1:' + config.PORT + url.pathname + url.search, {
      method: callback ? 'GET' : 'POST', headers, ...(callback ? {} : { body: Buffer.concat(chunks) }), signal: AbortSignal.timeout(25000), redirect: 'manual',
    });
    const body = await upstream.text();
    let event = {};
    try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* Invalid JSON is rejected by the application. */ }
    const id = String(event.data?.id || url.searchParams.get('data.id') || '');
    const action = String(event.action || '');
    fs.appendFileSync(evidence, JSON.stringify({ at: new Date().toISOString(), version: manifest.digest, path: url.pathname, status: upstream.status,
      paymentId: /^\d{1,30}$/.test(id) ? id : undefined,
      action: /^[a-z_.]{1,60}$/i.test(action) ? action : undefined,
      signaturePresent: Boolean(req.headers['x-signature']) }) + '\n');
    const location = upstream.headers.get('location');
    const redirect = callback && location && new URL(location, config.FRONTEND_URL).origin === new URL(config.FRONTEND_URL).origin;
    res.writeHead(upstream.status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', ...(redirect ? { Location: location } : {}) }).end(body);
  } catch { res.writeHead(503).end('Retry'); }
}).listen(Number(config.RELAY_PORT), '127.0.0.1', () => console.log('Homologation relay ready.'));
