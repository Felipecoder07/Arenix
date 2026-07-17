const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

// ─── BUSCAR ARENA ───────────────────────────────────────────────────────────
const getMinhaArena = async (req, res) => {
  const tenant_id = req.user.tenant_id;
  
  try {
    const arena = await db.getAsync(`SELECT * FROM Arenas WHERE id = ?`, [tenant_id]);
    
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }
    
    res.json(arena);
  } catch (error) {
    console.error('Erro ao buscar arena:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da arena.' });
  }
};

// ─── ATUALIZAR ARENA ────────────────────────────────────────────────────────
const atualizarMinhaArena = async (req, res) => {
  const tenant_id = req.user.tenant_id;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const { 
    nome, endereco, telefone, email,
    notif_reserva_email, notif_reserva_whatsapp,
    notif_cancelamento_email, notif_pagamento_email,
    alerta_pagamento_minutos
  } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O nome da arena é obrigatório.' });
  }

  try {
    await db.runAsync(
      `UPDATE Arenas 
       SET nome = ?, endereco = ?, telefone = ?, email = ?,
           notif_reserva_email = ?, notif_reserva_whatsapp = ?,
           notif_cancelamento_email = ?, notif_pagamento_email = ?,
           alerta_pagamento_minutos = ?
       WHERE id = ?`,
      [
        nome, endereco, telefone, email,
        notif_reserva_email !== undefined ? (notif_reserva_email ? 1 : 0) : 1,
        notif_reserva_whatsapp !== undefined ? (notif_reserva_whatsapp ? 1 : 0) : 0,
        notif_cancelamento_email !== undefined ? (notif_cancelamento_email ? 1 : 0) : 1,
        notif_pagamento_email !== undefined ? (notif_pagamento_email ? 1 : 0) : 1,
        alerta_pagamento_minutos || 30,
        tenant_id
      ]
    );

    logAuditEvent(admin_id, 'Atualização de Arena', `Editou os dados e configurações da arena ID ${tenant_id}`, ip);
    res.json({ message: 'Dados da arena atualizados com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar arena:', error);
    res.status(500).json({ error: 'Erro ao salvar os dados da arena.' });
  }
};

module.exports = {
  getMinhaArena,
  atualizarMinhaArena
};
