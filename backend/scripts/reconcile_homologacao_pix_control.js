// Read-only lookup for an uncertain control payment in the isolated TEST instance.
const fs = require('node:fs');
const path = require('node:path');
const { resolveInstance, verifySnapshot, config } = require('./homologacao_instance.cjs');
const { installNetworkGuard } = require('./homologacao_network.cjs');

async function main() {
  const folder = resolveInstance();
  const manifest = verifySnapshot(folder);
  const settings = config(folder);
  const operation = JSON.parse(fs.readFileSync(path.join(folder, 'pix-control-operation.json'), 'utf8'));
  if (!/^cm-control-[0-9a-f-]{36}$/.test(operation.reference)) throw new Error('Invalid control reference.');
  const guardedFetch = installNetworkGuard(settings, folder, manifest.digest);
  const url = 'https://api.mercadopago.com/v1/payments/search?external_reference=' +
    encodeURIComponent(operation.reference) + '&limit=10';
  const response = await guardedFetch(url, { method: 'GET',
    headers: { Authorization: 'Bearer ' + settings.MERCADO_PAGO_ACCESS_TOKEN },
    signal: AbortSignal.timeout(20000) });
  const body = await response.json().catch(() => ({}));
  const matches = Array.isArray(body.results)
    ? body.results.filter(row => String(row.external_reference) === operation.reference)
    : [];
  const report = { at: new Date().toISOString(), version: manifest.digest, httpStatus: response.status,
    reference: operation.reference, matchCount: matches.length,
    payments: matches.map(row => ({ id: /^\d+$/.test(String(row.id)) ? String(row.id) : undefined,
      status: /^[a-z_]{1,40}$/.test(row.status || '') ? row.status : undefined,
      liveMode: typeof row.live_mode === 'boolean' ? row.live_mode : undefined,
      currency: row.currency_id === 'BRL' ? 'BRL' : undefined,
      amountMatches: Number(row.transaction_amount) === operation.amount,
    })), resolved: false };
  fs.writeFileSync(path.join(folder, 'pix-control-reconciliation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!response.ok) process.exitCode = 1;
}
main().catch(error => { console.error('Pix control reconciliation failed:', error.cause?.code || error.code || error.name); process.exitCode = 1; });
