const db = require('../config/database');
const { httpError } = require('../utils/security');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function criar({ message, audience, channel, scheduledAt, expiresAt }) {
  if (typeof message !== 'string' || !message.trim() || message.length > 1000 ||
      !['email','alerta'].includes(channel) || (audience !== 'all' && !/^[1-9]\d*$/.test(String(audience)))) {
    throw httpError(400, 'Informe mensagem, destino e canal válidos.');
  }
  const now = Date.now();
  const inicio = scheduledAt === undefined ? now : Date.parse(scheduledAt);
  if (scheduledAt !== undefined && (typeof scheduledAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(scheduledAt) || !Number.isFinite(inicio) || inicio <= now)) {
    throw httpError(400, 'Escolha uma data futura com fuso horário para o agendamento.');
  }
  const fim = expiresAt === undefined ? inicio + 7 * 86400000 : Date.parse(expiresAt);
  if (!Number.isFinite(fim) || fim <= inicio) throw httpError(400, 'A expiração deve ocorrer após o envio.');
  return db.transaction(async () => {
    if (audience !== 'all' && !await db.getAsync('SELECT id FROM Arenas WHERE id=? AND status!=-1',[audience])) throw httpError(404,'Arena não encontrada.');
    const result = await db.runAsync(`INSERT INTO ComunicadosSaaS (mensagem,destino,canal,expira_em,agendado_em,estado)
      VALUES (?,?,?,?,?,'agendado')`,[message.trim(),String(audience),channel,new Date(fim).toISOString(),new Date(inicio).toISOString()]);
    return { id: result.lastID, agendado: scheduledAt !== undefined };
  });
}

async function processar() {
  const now = new Date().toISOString();
  await db.transaction(async () => {
    const due = await db.allAsync(`SELECT * FROM ComunicadosSaaS WHERE ativo=1 AND estado='agendado'
      AND julianday(agendado_em)<=julianday(?) AND julianday(expira_em)>julianday(?)`,[now,now]);
    for (const item of due) {
      if (item.canal === 'email') {
        const users = await db.allAsync(`SELECT DISTINCT LOWER(TRIM(u.email)) AS email FROM Usuarios u
          JOIN Arenas a ON a.id=u.tenant_id WHERE u.ativo=1 AND a.status!=-1
          AND u.perfil IN ('Administrador','Gerente') AND u.email IS NOT NULL AND TRIM(u.email)!=''
          AND (?='all' OR u.tenant_id=?)`,[item.destino,item.destino]);
        for (const user of users) await db.runAsync('INSERT OR IGNORE INTO ComunicadoEntregas(comunicado_id,email) VALUES (?,?)',[item.id,user.email]);
      }
      await db.runAsync("UPDATE ComunicadosSaaS SET estado='publicado' WHERE id=?",[item.id]);
    }
  });
  const pending = await db.allAsync("SELECT comunicado_id,email FROM ComunicadoEntregas WHERE estado='pendente'");
  for (const item of pending) {
    const claimed = await db.transaction(async () => {
      const comunicado = await db.getAsync(`SELECT mensagem FROM ComunicadosSaaS WHERE id=? AND ativo=1
        AND estado='publicado' AND julianday(expira_em)>julianday('now')`,[item.comunicado_id]);
      if (!comunicado) return null;
      const updated = await db.runAsync("UPDATE ComunicadoEntregas SET estado='enviando' WHERE comunicado_id=? AND email=? AND estado='pendente'",[item.comunicado_id,item.email]);
      return updated.changes ? comunicado : null;
    });
    if (!claimed) continue;
    // Claim before SMTP prevents simultaneous workers/restarts from sending twice.
    // A crash during SMTP leaves 'enviando': delivery is uncertain, not retried.
    let enviado = false;
    try { enviado = await require('./emailService').sendEmail(item.email,'Comunicado Oficial - Arenix CourtManager',`<p>${escapeHtml(claimed.mensagem).replace(/\n/g,'<br>')}</p>`); } catch { /* record failure */ }
    await db.runAsync('UPDATE ComunicadoEntregas SET estado=? WHERE comunicado_id=? AND email=?',[enviado ? 'enviado' : 'falhou',item.comunicado_id,item.email]);
  }
}

module.exports = { criar, processar };
