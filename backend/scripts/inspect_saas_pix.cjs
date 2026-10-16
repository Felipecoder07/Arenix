// Read-only provider inspection. Does not import the app or create charges.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const sqlite = require('sqlite3');
const { decrypt, hash } = require('../src/utils/security');
const invoiceId = Number(process.argv.find(a => a.startsWith('--invoice='))?.slice(10));
if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) throw new Error('Use --invoice=ID');
const db = new sqlite.Database(path.resolve(__dirname, '../data/courtmanager.sqlite'), sqlite.OPEN_READONLY);
const get = (sql, args = []) => new Promise((resolve, reject) => db.get(sql, args, (e, row) => e ? reject(e) : resolve(row)));
async function main() {
  const invoice = await get('SELECT id,tenant_id,valor FROM FaturasSaaS WHERE id=?', [invoiceId]);
  if (!invoice) throw new Error('Invoice not found');
  const attempt = await get('SELECT * FROM SaasPixAttempts WHERE invoice_id=? ORDER BY created DESC LIMIT 1', [invoiceId]);
  const row = await get("SELECT valor FROM ConfiguracoesSaaS WHERE chave='mp_master_access_token'");
  const token = row ? decrypt(row.valor) : process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Missing credential');
  console.log(JSON.stringify({ invoiceId, state: attempt?.state, legacy: Boolean(attempt?.legacy), credentialMatches: attempt?.credential_fingerprint === hash(token) }));
  const headers = { Authorization: `Bearer ${token}` };
  let scanned = 0;
  for (let offset = 0; offset < 1000; offset += 100) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=100&offset=${offset}`, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body.results)) {
      console.log(JSON.stringify({ httpStatus: response.status, ...require('../src/utils/paymentProviderError').responseDiagnostic(response, body) }));
      process.exitCode = 1; return;
    }
    scanned += body.results.length;
    const matches = body.results.filter(p => String(p.metadata?.fatura_saas_id) === String(invoice.id) && String(p.metadata?.tenant_id) === String(invoice.tenant_id));
    console.log(JSON.stringify({ offset, total: body.paging?.total, scanned, matches: matches.map(p => ({ id: p.id, status: p.status, amountMatches: Math.round(Number(p.transaction_amount) * 100) === invoice.valor, liveMode: p.live_mode, qrPresent: Boolean(p.point_of_interaction?.transaction_data?.qr_code) })) }));
    if (scanned >= body.paging?.total || body.results.length === 0) return;
  }
  console.log('Search capped; no absence conclusion.');
}
main().catch(error => { console.error('Inspection failed:', error.cause?.code || error.code || error.name); process.exitCode = 1; }).finally(() => db.close());
