const bcrypt = require('bcrypt');
const db = require('../config/database');
const { httpError } = require('../utils/security');

async function reauthenticate(req) {
  const user = await db.getAsync('SELECT senha_hash, ativo, perfil, tenant_id FROM Usuarios WHERE id=?', [req.user.id]);
  if (!user || user.ativo !== 1 || user.perfil !== req.user.perfil || user.tenant_id !== req.user.tenant_id
      || typeof req.body?.senha_atual !== 'string' || !await bcrypt.compare(req.body?.senha_atual, user.senha_hash)) {
    throw httpError(403, 'Confirme sua senha atual para continuar.');
  }
}
module.exports = { reauthenticate };
