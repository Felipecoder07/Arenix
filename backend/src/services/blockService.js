const db = require('../config/database');
const { httpError } = require('../utils/security');
const { getTodayString, getLocalTimeString } = require('../utils/dateUtils');

const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function validateInterval(start, end) {
  if (!validTime(start) || !(validTime(end) || end === '24:00') || start >= end) {
    throw httpError(400, 'Informe um intervalo válido, com início anterior ao fim.');
  }
}

async function createBlock(user, body) {
  const { quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo } = body;
  validateInterval(hora_inicio, hora_fim);
  const date = typeof data_bloqueio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data_bloqueio)
    ? new Date(data_bloqueio + 'T00:00:00Z') : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data_bloqueio ||
      !Number.isSafeInteger(Number(quadra_id)) || Number(quadra_id) <= 0 ||
      typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 500) {
    throw httpError(400, 'Informe quadra, data e motivo válidos (até 500 caracteres).');
  }
  return db.transaction(async () => {
    const court = await db.getAsync('SELECT q.*, a.fuso_horario FROM Quadras q JOIN Arenas a ON a.id=q.tenant_id WHERE q.id=? AND q.tenant_id=?', [quadra_id, user.tenant_id]);
    if (!court) throw httpError(404, 'Quadra não encontrada ou não pertence a esta arena.');
    if (court.status !== 'Ativa') throw httpError(400, 'A quadra está inativa.');
    const zone = court.fuso_horario || 'America/Sao_Paulo';
    const today = getTodayString(zone);
    if (data_bloqueio < today || (data_bloqueio === today && hora_fim <= getLocalTimeString(zone))) {
      throw httpError(400, 'Não é permitido bloquear um período já encerrado.');
    }
    if (hora_inicio < (court.hora_abertura || '06:00') || hora_fim > (court.hora_fechamento || '22:00')) {
      throw httpError(400, 'O bloqueio deve estar dentro do horário de funcionamento da quadra.');
    }
    if (await db.getAsync("SELECT id FROM Reservas WHERE quadra_id=? AND data_reserva=? AND status!='Cancelada' AND hora_inicio<? AND hora_fim>?", [quadra_id, data_bloqueio, hora_fim, hora_inicio])) {
      throw httpError(409, 'Já existe uma reserva neste período.');
    }
    if (await db.getAsync('SELECT id FROM Bloqueios WHERE quadra_id=? AND data_bloqueio=? AND hora_inicio<? AND hora_fim>?', [quadra_id, data_bloqueio, hora_fim, hora_inicio])) {
      throw httpError(409, 'Já existe um bloqueio neste período.');
    }
    const result = await db.runAsync('INSERT INTO Bloqueios (quadra_id,data_bloqueio,hora_inicio,hora_fim,motivo,criado_por) VALUES (?,?,?,?,?,?)', [quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo.trim(), user.id]);
    return result.lastID;
  });
}

async function releaseBlock(user, id, start, end, whole = false) {
  if (!whole) validateInterval(start, end);
  return db.transaction(async () => {
    const block = await db.getAsync('SELECT b.* FROM Bloqueios b JOIN Quadras q ON q.id=b.quadra_id WHERE b.id=? AND q.tenant_id=?', [id, user.tenant_id]);
    if (!block) throw httpError(404, 'Bloqueio não encontrado.');
    if (whole) {
      await db.runAsync('DELETE FROM Bloqueios WHERE id=?', [id]);
      return;
    }
    // Intersect the requested slot with the block, preserving minute boundaries.
    const from = start > block.hora_inicio ? start : block.hora_inicio;
    const to = end < block.hora_fim ? end : block.hora_fim;
    if (from >= to) throw httpError(400, 'O período solicitado não pertence a este bloqueio.');
    if (from === block.hora_inicio && to === block.hora_fim) {
      await db.runAsync('DELETE FROM Bloqueios WHERE id=?', [id]);
    } else if (from === block.hora_inicio) {
      await db.runAsync('UPDATE Bloqueios SET hora_inicio=? WHERE id=?', [to, id]);
    } else if (to === block.hora_fim) {
      await db.runAsync('UPDATE Bloqueios SET hora_fim=? WHERE id=?', [from, id]);
    } else {
      await db.runAsync('UPDATE Bloqueios SET hora_fim=? WHERE id=?', [from, id]);
      await db.runAsync('INSERT INTO Bloqueios (quadra_id,data_bloqueio,hora_inicio,hora_fim,motivo,criado_por) VALUES (?,?,?,?,?,?)', [block.quadra_id, block.data_bloqueio, to, block.hora_fim, block.motivo, block.criado_por]);
    }
  });
}

module.exports = { createBlock, releaseBlock, validTime };
