const db = require('../config/database');
const { httpError } = require('../utils/security');

// Caller owns the transaction, so validation and mutation see the same state.
async function alterarPlano(id, planoId) {
  if (!/^\d+$/.test(String(planoId)) || Number(planoId) < 1) throw httpError(400, 'Plano inválido.');
  const arena = await db.getAsync('SELECT plano_id FROM Arenas WHERE id = ? AND status != -1', [id]);
  if (!arena) throw httpError(404, 'Arena não encontrada.');
  const plano = await db.getAsync('SELECT * FROM PlanosSaaS WHERE id = ?', [planoId]);
  if (!plano) throw httpError(404, 'Plano não encontrado.');
  if (Number(arena.plano_id) === Number(planoId)) return;
  const quadras = await db.getAsync("SELECT COUNT(*) AS total FROM Quadras WHERE tenant_id = ? AND status != 'Excluida'", [id]);
  const usuarios = await db.getAsync("SELECT COUNT(*) AS total FROM Usuarios WHERE tenant_id = ? AND ativo = 1 AND (perfil IS NULL OR LOWER(perfil) != 'cliente')", [id]);
  if (plano.max_quadras > 0 && quadras.total > plano.max_quadras) throw httpError(400, `A arena excede o limite de ${plano.max_quadras} quadras do plano ${plano.nome}.`);
  if (plano.max_usuarios > 0 && usuarios.total > plano.max_usuarios) throw httpError(400, `A arena excede o limite de ${plano.max_usuarios} usuários do plano ${plano.nome}.`);
  await db.runAsync('UPDATE Arenas SET plano_id = ?, fatura_plano_pendente_id = NULL WHERE id = ?', [planoId,id]);
}

module.exports = { alterarPlano };
