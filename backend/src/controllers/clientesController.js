const logger = require('../utils/safeLogger').forModule('clientesController');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

const listarClientes = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    // Suporta ?ativo=0 para arquivados, ?ativo=1 ou sem param para ativos
    const ativo = req.query.ativo !== undefined ? Number.parseInt(req.query.ativo) : 1;
    const clientes = await db.allAsync(`
      SELECT 
        c.id, c.nome, c.email, c.telefone, c.ativo, c.criado_em,
        COUNT(CASE WHEN r.status != 'Cancelada' THEN r.id ELSE NULL END) as reservas_count,
        MAX(CASE WHEN r.status != 'Cancelada' THEN r.data_reserva ELSE NULL END) as ultima_visita,
        AVG(CASE WHEN r.status != 'Cancelada' THEN r.valor_total ELSE NULL END) as ticket_medio
      FROM Clientes c
      LEFT JOIN Reservas r ON r.cliente_id = c.id AND r.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.ativo = ?
      GROUP BY c.id
      ORDER BY c.nome ASC
    `, [tenant_id, ativo]);
    res.json(clientes);
  } catch (error) {
    logger.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno ao listar clientes.' });
  }
};

const obterEstatisticasClientes = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const stats = await db.getAsync(`
      SELECT
        COUNT(DISTINCT CASE WHEN c.ativo = 1 THEN c.id END) as total_ativos,
        COUNT(DISTINCT CASE WHEN c.ativo = 1 AND r.id IS NOT NULL AND r.status != 'Cancelada' THEN c.id END) as com_reservas,
        COUNT(DISTINCT CASE WHEN c.ativo = 1 AND strftime('%Y-%m', c.criado_em) = strftime('%Y-%m', 'now') THEN c.id END) as novos_mes,
        COUNT(DISTINCT CASE WHEN c.ativo = 0 THEN c.id END) as arquivados
      FROM Clientes c
      LEFT JOIN Reservas r ON r.cliente_id = c.id AND r.tenant_id = c.tenant_id
      WHERE c.tenant_id = ?
    `, [tenant_id]);

    res.json({
      totalAtivos: stats?.total_ativos ?? 0,
      comReservas: stats?.com_reservas ?? 0,
      novosMes: stats?.novos_mes ?? 0,
      arquivados: stats?.arquivados ?? 0
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas de clientes:', error);
    res.status(500).json({ error: 'Erro interno ao obter estatísticas.' });
  }
};

const criarCliente = async (req, res) => {
  try {
    const { nome, email, telefone } = req.body;
    const tenant_id = req.user.tenant_id;

    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      return res.status(400).json({ field: 'nome', error: 'O nome é obrigatório.' });
    } else if (nome.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ field: 'nome', error: 'Informe pelo menos o nome e sobrenome.' });
    }

    if (!telefone || typeof telefone !== 'string' || telefone.trim() === '') {
      return res.status(400).json({ field: 'telefone', error: 'O telefone é obrigatório.' });
    } else if (!/^\(\d{2}\)\s\d{5}-\d{4}$/.test(telefone.trim())) {
      return res.status(400).json({ field: 'telefone', error: 'Formato inválido. Use (99) 99999-9999.' });
    }
    
    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ field: 'email', error: 'E-mail inválido.' });
      }
      
      const emailExists = await db.getAsync('SELECT id FROM Clientes WHERE email = ? AND tenant_id = ?', [email, tenant_id]);
      if (emailExists) {
        return res.status(400).json({ field: 'email', error: 'Este e-mail já está em uso.' });
      }
    }

    const result = await db.runAsync(
      'INSERT INTO Clientes (tenant_id, nome, email, telefone, ativo) VALUES (?, ?, ?, ?, 1)',
      [tenant_id, nome, email || null, telefone]
    );

    logAuditEvent(req.user?.id || null, 'Criação de Cliente', `Criou o cliente "${nome}" (${telefone}${email ? ' · ' + email : ''})`, req.ip);

    res.status(201).json({ id: result.lastID, nome, email, telefone, ativo: 1 });
  } catch (error) {
    logger.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao criar cliente.' });
  }
};

const obterCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    const cliente = await db.getAsync(
      'SELECT id, nome, email, telefone, ativo, criado_em FROM Clientes WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const countRes = await db.getAsync('SELECT COUNT(*) as count FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status != "Cancelada"', [id, tenant_id]);
    const saldo = await db.getAsync('SELECT SUM(valor_total) as total FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status_pagamento = "Pendente" AND status != "Cancelada"', [id, tenant_id]);

    const reservas = await db.allAsync(`
      SELECT r.id, r.data_reserva, r.hora_inicio, r.status, r.status_pagamento, r.valor_total, q.nome as quadra_nome 
      FROM Reservas r 
      JOIN Quadras q ON r.quadra_id = q.id 
      WHERE r.cliente_id = ? AND r.tenant_id = ? 
      ORDER BY r.data_reserva DESC, r.hora_inicio DESC 
      LIMIT 5
    `, [id, tenant_id]);

    cliente.reservasCount = countRes ? countRes.count : 0;
    cliente.saldoDevedor = saldo && saldo.total ? saldo.total : 0;
    cliente.ultimasReservas = reservas || [];

    res.json(cliente);
  } catch (error) {
    logger.error('Erro ao obter cliente:', error);
    res.status(500).json({ error: 'Erro interno ao obter cliente.' });
  }
};

const atualizarCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;
    const { nome, email, telefone } = req.body;

    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      return res.status(400).json({ field: 'nome', error: 'O nome é obrigatório.' });
    } else if (nome.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ field: 'nome', error: 'Informe pelo menos o nome e sobrenome.' });
    }

    if (!telefone || typeof telefone !== 'string' || telefone.trim() === '') {
      return res.status(400).json({ field: 'telefone', error: 'O telefone é obrigatório.' });
    } else if (!/^\(\d{2}\)\s\d{5}-\d{4}$/.test(telefone.trim())) {
      return res.status(400).json({ field: 'telefone', error: 'Formato inválido. Use (99) 99999-9999.' });
    }
    
    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ field: 'email', error: 'E-mail inválido.' });
      }
      
      const emailExists = await db.getAsync('SELECT id FROM Clientes WHERE email = ? AND tenant_id = ? AND id != ?', [email, tenant_id, id]);
      if (emailExists) {
        return res.status(400).json({ field: 'email', error: 'Este e-mail já está em uso.' });
      }
    }

    const result = await db.runAsync(
      'UPDATE Clientes SET nome = ?, email = ?, telefone = ? WHERE id = ? AND tenant_id = ?',
      [nome, email || null, telefone, id, tenant_id]
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    logAuditEvent(req.user.id, 'Edição de Cliente', `Atualizou dados do cliente "${nome}" (ID ${id})`, req.ip);

    res.json({ message: 'Cliente atualizado com sucesso.' });
  } catch (error) {
    logger.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar cliente.' });
  }
};

// Arquivar cliente (soft delete) — nunca apaga o histórico financeiro
const arquivarCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    const result = await db.runAsync(
      'UPDATE Clientes SET ativo = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const cliente = await db.getAsync('SELECT nome FROM Clientes WHERE id = ?', [id]);
    logAuditEvent(req.user.id, 'Arquivamento de Cliente', `Arquivou o cliente "${cliente ? cliente.nome : id}" (preservando histórico financeiro)`, req.ip);

    res.json({ message: 'Cliente arquivado com sucesso. O histórico de reservas e pagamentos foi preservado.' });
  } catch (error) {
    logger.error('Erro ao arquivar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao arquivar cliente.' });
  }
};

// Desarquivar cliente — reativa na lista principal
const desarquivarCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    const result = await db.runAsync(
      'UPDATE Clientes SET ativo = 1 WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const cliente = await db.getAsync('SELECT nome FROM Clientes WHERE id = ?', [id]);
    logAuditEvent(req.user.id, 'Reativação de Cliente', `Reativou o cliente "${cliente ? cliente.nome : id}"`, req.ip);

    res.json({ message: 'Cliente reativado com sucesso!' });
  } catch (error) {
    logger.error('Erro ao desarquivar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao desarquivar cliente.' });
  }
};

const excluirCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    const reservasCount = await db.getAsync('SELECT COUNT(*) as count FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status != "Cancelada"', [id, tenant_id]);
    if (reservasCount && reservasCount.count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um cliente com histórico de reservas. Use "Arquivar" para escondê-lo da lista.' });
    }

    await db.runAsync('DELETE FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status = "Cancelada"', [id, tenant_id]);
    const result = await db.runAsync('DELETE FROM Clientes WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    logAuditEvent(req.user.id, 'Exclusão de Cliente', `Excluiu definitivamente o cliente ID ${id}`, req.ip);

    res.json({ message: 'Cliente excluído com sucesso.' });
  } catch (error) {
    logger.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: 'Erro interno ao excluir cliente.' });
  }
};

module.exports = { 
  listarClientes, obterEstatisticasClientes, criarCliente, obterCliente, atualizarCliente, excluirCliente, arquivarCliente, desarquivarCliente,
};
