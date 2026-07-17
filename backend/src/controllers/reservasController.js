const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

// Listar grade de quadras e horários ocupados
const listarGrade = async (req, res) => {
  try {
    const { data, data_inicio, data_fim } = req.query; 
    const inicio = data_inicio || data;
    const fim = data_fim || data;

    if (!inicio || !fim) return res.status(400).json({ error: 'Data ou intervalo de datas é obrigatório' });

    const tenant_id = req.user.tenant_id;

    // Pegar todas as quadras ativas
    const quadras = await db.allAsync('SELECT * FROM Quadras WHERE status = "Ativa" AND tenant_id = ?', [tenant_id]);

    // Pegar reservas confirmadas/pendentes/parciais do intervalo
    const reservas = await db.allAsync(`
      SELECT r.*, c.nome as cliente_nome 
      FROM Reservas r 
      LEFT JOIN Clientes c ON r.cliente_id = c.id
      WHERE r.data_reserva >= ? AND r.data_reserva <= ? AND r.status != 'Cancelada' AND r.tenant_id = ?
    `, [inicio, fim, tenant_id]);

    // Pegar bloqueios do intervalo
    const bloqueios = await db.allAsync(`
      SELECT b.* FROM Bloqueios b
      JOIN Quadras q ON b.quadra_id = q.id
      WHERE b.data_bloqueio >= ? AND b.data_bloqueio <= ? AND q.tenant_id = ?
    `, [inicio, fim, tenant_id]);

    res.json({ quadras, reservas, bloqueios });
  } catch (error) {
    console.error('Erro ao listar grade:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const criarReserva = async (req, res) => {
  try {
    const { cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const usuario_id = req.user ? req.user.id : null; 

    if (!cliente_id || !quadra_id || !data_reserva || !hora_inicio || !hora_fim) {
      return res.status(400).json({ error: 'Todos os campos (cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim) são obrigatórios.' });
    }

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset).toISOString();
    const todayStr = localISOTime.split('T')[0];
    const currentTimeStr = localISOTime.split('T')[1].substring(0, 5);

    if (data_reserva < todayStr) {
      return res.status(400).json({ error: 'Não é permitido criar agendamentos em datas passadas.' });
    }
    if (data_reserva === todayStr && hora_fim <= currentTimeStr) {
      return res.status(400).json({ error: 'Não é permitido criar agendamentos em horários que já se encerraram.' });
    }

    // 1. RN-002: Validar horário de expediente (08:00 as 22:00)
    if (hora_inicio < '08:00' || hora_fim > '22:00') {
      return res.status(400).json({ error: 'Reserva fora do horário de funcionamento (08:00 às 22:00).' });
    }

    // 2. RN-001: Validar sobreposição de reservas
    const conflitoReservas = await db.getAsync(`
      SELECT id FROM Reservas 
      WHERE quadra_id = ? AND data_reserva = ? AND status != 'Cancelada'
      AND (hora_inicio < ? AND hora_fim > ?)
    `, [quadra_id, data_reserva, hora_fim, hora_inicio]);

    if (conflitoReservas) {
      return res.status(409).json({ error: 'A quadra já possui uma reserva neste horário.' });
    }

    // 3. RN-003, RN-012: Validar conflito com bloqueios
    const conflitoBloqueios = await db.getAsync(`
      SELECT id FROM Bloqueios
      WHERE quadra_id = ? AND data_bloqueio = ?
      AND (hora_inicio < ? AND hora_fim > ?)
    `, [quadra_id, data_reserva, hora_fim, hora_inicio]);

    if (conflitoBloqueios) {
      return res.status(409).json({ error: 'A quadra está bloqueada para manutenção/evento neste horário.' });
    }

    // 4. RN-004: Calcular valor da reserva
    const [hI, mI] = hora_inicio.split(':').map(Number);
    const [hF, mF] = hora_fim.split(':').map(Number);
    const tenant_id = req.user.tenant_id;

    const quadra = await db.getAsync('SELECT preco_base FROM Quadras WHERE id = ? AND tenant_id = ?', [quadra_id, tenant_id]);
    if (!quadra) return res.status(404).json({ error: 'Quadra não encontrada ou não pertence a esta arena.' });

    const duracaoHoras = (hF + mF/60) - (hI + mI/60);
    const valor_total = quadra.preco_base * duracaoHoras;

    // 5. Salvar a reserva
    const insert = await db.runAsync(`
      INSERT INTO Reservas (tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, criado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total || 0, usuario_id]);

    logAuditEvent(usuario_id, 'Criação de reserva', `Reserva ID: ${insert.lastID}, Quadra: ${quadra_id}, Data: ${data_reserva} ${hora_inicio}`, ip);

    res.status(201).json({ 
      message: 'Reserva criada com sucesso.', 
      reserva_id: insert.lastID,
      valor_total 
    });

  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const minhasReservas = async (req, res) => {
  try {
    const { cliente_id } = req.user;
    if (!cliente_id) {
      return res.status(403).json({ error: 'Usuário não tem perfil de cliente vinculado.' });
    }

    const tenant_id = req.user.tenant_id;
    const reservas = await db.allAsync(`
      SELECT r.id, r.data_reserva, r.hora_inicio, r.hora_fim, r.status, r.valor_total, r.status_pagamento, q.nome as quadra_nome 
      FROM Reservas r
      JOIN Quadras q ON r.quadra_id = q.id
      WHERE r.cliente_id = ? AND r.tenant_id = ?
      ORDER BY r.data_reserva DESC, r.hora_inicio DESC
    `, [cliente_id, tenant_id]);

    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar reservas do cliente.' });
  }
};

const cancelarReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, observacoes } = req.body; // 'motivo' now actually expects motivo_id from frontend
    const tenant_id = req.user.tenant_id;
    
    const reserva = await db.getAsync('SELECT * FROM Reservas WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });

    let novoStatusPagamento = reserva.status_pagamento;
    if (reserva.status_pagamento === 'Pendente') {
      novoStatusPagamento = 'Cancelado';
    } else if (reserva.status_pagamento === 'Pago') {
      novoStatusPagamento = 'Estornado';
    }

    // Busca o texto do motivo para o log
    // Busca o texto do motivo para o log
    let motivoTexto = 'Motivo desconhecido';
    if (motivo) {
      if (motivo == -1) motivoTexto = 'Desistência do Cliente';
      else if (motivo == -2) motivoTexto = 'Condições Climáticas';
      else if (motivo == -3) motivoTexto = 'Manutenção da Quadra';
      else {
        const m = await db.getAsync('SELECT motivo FROM MotivosCancelamento WHERE id = ?', [motivo]);
        if (m) motivoTexto = m.motivo;
      }
    }

    await db.runAsync(
      'UPDATE Reservas SET status = "Cancelada", status_pagamento = ?, motivo_cancelamento_id = ?, observacoes_cancelamento = ? WHERE id = ?',
      [novoStatusPagamento, motivo || null, observacoes || null, id]
    );

    logAuditEvent(req.user.id, 'Cancelamento de reserva', `Reserva ID: ${id}, Motivo: ${motivoTexto}`, req.ip);

    res.json({ message: 'Reserva cancelada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
};

const criarBloqueio = async (req, res) => {
  try {
    const { quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo } = req.body;
    const usuario_id = req.user ? req.user.id : null;
    
    if (!quadra_id || !data_bloqueio || !hora_inicio || !hora_fim || !motivo) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset).toISOString();
    const todayStr = localISOTime.split('T')[0];
    const currentTimeStr = localISOTime.split('T')[1].substring(0, 5);

    if (data_bloqueio < todayStr) {
      return res.status(400).json({ error: 'Não é permitido criar bloqueios em datas passadas.' });
    }
    if (data_bloqueio === todayStr && hora_fim <= currentTimeStr) {
      return res.status(400).json({ error: 'Não é permitido criar bloqueios em horários que já se encerraram.' });
    }

    const tenant_id = req.user.tenant_id;
    const quadra = await db.getAsync('SELECT id FROM Quadras WHERE id = ? AND tenant_id = ?', [quadra_id, tenant_id]);
    if (!quadra) return res.status(404).json({ error: 'Quadra não encontrada ou não pertence a esta arena.' });

    const conflitoReservas = await db.getAsync(`
      SELECT id FROM Reservas 
      WHERE quadra_id = ? AND data_reserva = ? AND status != 'Cancelada' AND tenant_id = ?
      AND (hora_inicio < ? AND hora_fim > ?)
    `, [quadra_id, data_reserva, tenant_id, hora_fim, hora_inicio]);

    if (conflitoReservas) {
      return res.status(409).json({ error: 'Não é possível bloquear: já existe uma reserva confirmada neste horário.' });
    }

    const insert = await db.runAsync(`
      INSERT INTO Bloqueios (quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo, criado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo, usuario_id]);

    logAuditEvent(usuario_id, 'Criação de bloqueio', `Bloqueio ID: ${insert.lastID}, Quadra: ${quadra_id}, Data: ${data_bloqueio}`, req.ip);

    res.status(201).json({ message: 'Quadra bloqueada com sucesso.', bloqueio_id: insert.lastID });
  } catch (error) {
    console.error('Erro ao criar bloqueio:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const removerBloqueio = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user ? req.user.id : null;

    const tenant_id = req.user.tenant_id;

    const bloqueio = await db.getAsync(`
      SELECT b.* FROM Bloqueios b
      JOIN Quadras q ON b.quadra_id = q.id
      WHERE b.id = ? AND q.tenant_id = ?
    `, [id, tenant_id]);
    if (!bloqueio) return res.status(404).json({ error: 'Bloqueio não encontrado.' });

    await db.runAsync('DELETE FROM Bloqueios WHERE id = ?', [id]);
    
    logAuditEvent(usuario_id, 'Remoção de bloqueio', `Bloqueio ID: ${id} removido integralmente`, req.ip);

    res.json({ message: 'Bloqueio removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover bloqueio:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const desbloquearParcialmente = async (req, res) => {
  try {
    const { id } = req.params;
    const { hora_inicio_desbloqueio, hora_fim_desbloqueio } = req.body;
    const usuario_id = req.user ? req.user.id : null;

    const tenant_id = req.user.tenant_id;

    const b = await db.getAsync(`
      SELECT b.* FROM Bloqueios b
      JOIN Quadras q ON b.quadra_id = q.id
      WHERE b.id = ? AND q.tenant_id = ?
    `, [id, tenant_id]);
    if (!b) return res.status(404).json({ error: 'Bloqueio não encontrado.' });

    // Se o desbloqueio for exatamente igual ao bloqueio, removemos
    if (b.hora_inicio >= hora_inicio_desbloqueio && b.hora_fim <= hora_fim_desbloqueio) {
      await db.runAsync('DELETE FROM Bloqueios WHERE id = ?', [id]);
    } else if (b.hora_inicio === hora_inicio_desbloqueio) {
      // Começa igual, então só empurramos o início do bloqueio mais pra frente
      await db.runAsync('UPDATE Bloqueios SET hora_inicio = ? WHERE id = ?', [hora_fim_desbloqueio, id]);
    } else if (b.hora_fim === hora_fim_desbloqueio) {
      // Termina igual, recuamos o final do bloqueio
      await db.runAsync('UPDATE Bloqueios SET hora_fim = ? WHERE id = ?', [hora_inicio_desbloqueio, id]);
    } else {
      // Furo no meio: atualiza o atual para terminar no início do furo, e cria um novo começando no fim do furo
      await db.runAsync('UPDATE Bloqueios SET hora_fim = ? WHERE id = ?', [hora_inicio_desbloqueio, id]);
      await db.runAsync(`
        INSERT INTO Bloqueios (quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo, criado_por)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [b.quadra_id, b.data_bloqueio, hora_fim_desbloqueio, b.hora_fim, b.motivo, b.criado_por]);
    }

    logAuditEvent(usuario_id, 'Desbloqueio Parcial', `Bloqueio ID: ${id}, Furo: ${hora_inicio_desbloqueio} - ${hora_fim_desbloqueio}`, req.ip);
    res.json({ message: 'Horário desbloqueado com sucesso.' });
  } catch (error) {
    console.error('Erro ao desbloquear parcialmente:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
};

module.exports = { listarGrade, criarReserva, minhasReservas, cancelarReserva, criarBloqueio, removerBloqueio, desbloquearParcialmente };
