const bcrypt = require('bcrypt');
const { passwordError } = require('../utils/security');

async function bootstrapMaster(db, env = process.env) {
  const email = (env.BOOTSTRAP_MASTER_EMAIL || '').trim().toLowerCase();
  const password = env.BOOTSTRAP_MASTER_PASSWORD || '';
  if (!email && !password) return 'disabled';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      passwordError(password) || password.length < 12) {
    throw new Error('Configure BOOTSTRAP_MASTER_EMAIL e BOOTSTRAP_MASTER_PASSWORD (12 a 72 bytes).');
  }
  if (await db.getAsync("SELECT id FROM Usuarios WHERE perfil='SuperAdmin' LIMIT 1")) return 'exists';
  const hash = await bcrypt.hash(password, 12);
  return db.transaction(async () => {
    if (await db.getAsync("SELECT id FROM Usuarios WHERE perfil='SuperAdmin' LIMIT 1")) return 'exists';
    if (await db.getAsync('SELECT id FROM Usuarios WHERE LOWER(email)=?', [email])) {
      throw new Error('O e-mail de inicializacao ja pertence a outra conta. Escolha outro e-mail.');
    }
    await db.runAsync("INSERT INTO Usuarios(nome,email,senha_hash,perfil,ativo) VALUES(?,?,?,'SuperAdmin',1)",
      ['Administrador Master', email, hash]);
    return 'created';
  });
}

module.exports = { bootstrapMaster };
