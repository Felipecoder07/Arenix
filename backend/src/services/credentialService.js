const db = require('../config/database');
const { decrypt, httpError } = require('../utils/security');
const environmentKeys = Object.freeze({
  mp_client_secret: ['MERCADO_PAGO_CLIENT_SECRET'],
  mp_master_access_token: ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADOPAGO_ACCESS_TOKEN'],
  mp_webhook_secret: ['MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET'],
});
async function readCredential(key) {
  if (!Object.hasOwn(environmentKeys, key)) throw httpError(400, 'Credencial inválida.');
  const row = await db.getAsync('SELECT valor FROM ConfiguracoesSaaS WHERE chave=?', [key]);
  if (row?.valor) return decrypt(row.valor);
  if (row) {
    // Older databases seeded an empty webhook row. It must not mask a configured
    // environment secret, unless the master explicitly removed that credential.
    if (key !== 'mp_webhook_secret') return null;
    const removed = await db.getAsync(
      "SELECT 1 FROM LogsAuditoria WHERE evento='Credencial master removida' AND detalhes=? LIMIT 1",
      [key]
    );
    if (removed) return null;
  }
  return environmentKeys[key].map(name => process.env[name]?.trim()).find(Boolean) || null;
}
async function removeCredential(req, res) {
  try {
    const key = req.params.key;
    if (!Object.hasOwn(environmentKeys, key)) throw httpError(400, 'Credencial inválida.');
    await db.transaction(async () => {
      await require('../middlewares/reauthenticate').reauthenticate(req);
      await db.runAsync('INSERT OR REPLACE INTO ConfiguracoesSaaS(chave,valor) VALUES(?,?)', [key, '']);
      await db.runAsync('INSERT INTO LogsAuditoria(usuario_id,evento,detalhes,ip) VALUES(?,?,?,?)', [req.user.id,'Credencial master removida',key,req.ip]);
    });
    res.json({ message: 'Credencial removida.' });
  } catch (error) { res.status(error.status || 500).json({ error: require('../utils/security').publicError(error, 'Não foi possível remover a credencial.') }); }
}
module.exports = { readCredential, removeCredential };
