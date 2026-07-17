const db = require('../config/database');

const listarClientes = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const clientes = await db.allAsync(
      'SELECT id, nome, email, telefone, criado_em FROM Clientes WHERE tenant_id = ? ORDER BY nome ASC',
      [tenant_id]
    );
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno ao listar clientes.' });
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
      'INSERT INTO Clientes (tenant_id, nome, email, telefone) VALUES (?, ?, ?, ?)',
      [tenant_id, nome, email || null, telefone]
    );

    res.status(201).json({ id: result.lastID, nome, email, telefone });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao criar cliente.' });
  }
};

const obterCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    const cliente = await db.getAsync(
      'SELECT id, nome, email, telefone, criado_em FROM Clientes WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });

    // Quantidade de reservas (ignora as canceladas para não travar a exclusão)
    const countRes = await db.getAsync('SELECT COUNT(*) as count FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status != "Cancelada"', [id, tenant_id]);
    
    // Saldo devedor
    const saldo = await db.getAsync('SELECT SUM(valor_total) as total FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status_pagamento = "Pendente" AND status != "Cancelada"', [id, tenant_id]);

    // Últimas reservas
    const reservas = await db.allAsync(`
      SELECT r.id, r.data_reserva, r.hora_inicio, r.status, r.status_pagamento, q.nome as quadra_nome 
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
    console.error('Erro ao obter cliente:', error);
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

    res.json({ message: 'Cliente atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar cliente.' });
  }
};

const excluirCliente = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { id } = req.params;

    // Verificar se tem reservas válidas (ignora as canceladas)
    const reservasCount = await db.getAsync('SELECT COUNT(*) as count FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status != "Cancelada"', [id, tenant_id]);
    if (reservasCount && reservasCount.count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um cliente que possui histórico de reservas válidas.' });
    }

    // Excluir as reservas canceladas residuais do cliente (para limpar o banco de dados)
    await db.runAsync('DELETE FROM Reservas WHERE cliente_id = ? AND tenant_id = ? AND status = "Cancelada"', [id, tenant_id]);

    // Excluir o cliente
    const result = await db.runAsync('DELETE FROM Clientes WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    res.json({ message: 'Cliente excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: 'Erro interno ao excluir cliente.' });
  }
};

module.exports = { listarClientes, criarCliente, obterCliente, atualizarCliente, excluirCliente };
