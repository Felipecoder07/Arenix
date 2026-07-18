const db = require('../config/database');
const bcrypt = require('bcrypt');
const logAuditEvent = require('../utils/auditLogger');

const getArenas = async (req, res) => {
  try {
    const arenas = await db.allAsync(`
      SELECT 
        a.id, 
        a.nome, 
        a.email, 
        a.status,
        a.criado_em,
        a.plano_id,
        a.dia_vencimento,
        p.nome as plano_nome,
        (SELECT COUNT(*) FROM Usuarios WHERE tenant_id = a.id AND perfil = 'Administrador') as admins,
        (SELECT COUNT(*) FROM FaturasSaaS WHERE tenant_id = a.id AND status = 'Atrasada') as faturas_atrasadas
      FROM Arenas a
      LEFT JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.status != -1
      ORDER BY a.criado_em DESC
    `);
    res.json(arenas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar arenas.' });
  }
};

const getMetrics = async (req, res) => {
  try {
    const totalArenas = await db.getAsync(`SELECT COUNT(*) as total FROM Arenas WHERE status != -1`);
    const arenasAtivas = await db.getAsync(`SELECT COUNT(*) as total FROM Arenas WHERE status = 1`);
    const arenasBloqueadas = await db.getAsync(`SELECT COUNT(*) as total FROM Arenas WHERE status = 0`);
    const totalClientes = await db.getAsync(`SELECT COUNT(*) as total FROM Clientes`);
    const totalQuadras = await db.getAsync(`SELECT COUNT(*) as total FROM Quadras`);
    const mrr = await db.getAsync(`
      SELECT SUM(p.valor_mensal) as valor 
      FROM Arenas a 
      JOIN PlanosSaaS p ON a.plano_id = p.id 
      WHERE a.status = 1
    `);
    
    res.json({
      totalArenas: totalArenas.total,
      arenasAtivas: arenasAtivas.total,
      arenasBloqueadas: arenasBloqueadas.total,
      totalClientes: totalClientes.total,
      totalQuadras: totalQuadras.total,
      totalReceitaSaaS: mrr.valor || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar métricas.' });
  }
};

const toggleArenaStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 

  if (status === undefined) {
    return res.status(400).json({ error: 'Status não fornecido.' });
  }

  try {
    await db.runAsync(`UPDATE Arenas SET status = ? WHERE id = ?`, [status, id]);
    logAuditEvent(req.user.id, 'SaaS: Status Alterado', `Arena ID: ${id}, Novo Status: ${status === 1 ? 'Ativa' : 'Bloqueada'}`, req.ip);
    res.json({ message: 'Status da arena atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status da arena.' });
  }
};

const getArenaById = async (req, res) => {
  const { id } = req.params;
  try {
    const arena = await db.getAsync(`
      SELECT a.id, a.nome, a.email, a.telefone, a.endereco, a.status, a.criado_em, a.plano_id, a.dia_vencimento, p.nome as plano_nome
      FROM Arenas a 
      LEFT JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.id = ? AND a.status != -1
    `, [id]);
    if (!arena) return res.status(404).json({ error: 'Arena não encontrada.' });

    const totais = await db.getAsync(`SELECT COUNT(*) as total Quadras FROM Quadras WHERE tenant_id = ?`, [id]);
    const clientes = await db.getAsync(`SELECT COUNT(*) as total FROM Clientes WHERE tenant_id = ?`, [id]);
    const admins = await db.allAsync(`SELECT id, nome, email FROM Usuarios WHERE tenant_id = ? AND perfil = 'Administrador'`, [id]);

    logAuditEvent(req.user.id, 'SaaS: Inspeção de Arena', `Modo inspeção aberto para Arena ID: ${id}`, req.ip);

    res.json({
      ...arena,
      quadras: totais ? totais.total : 0,
      clientes: clientes ? clientes.total : 0,
      administradores: admins || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhes da arena.' });
  }
};

const createArena = async (req, res) => {
  const { arena_nome, arena_email, arena_telefone, arena_endereco, resp_nome, resp_email, resp_senha, plano_id, dia_vencimento } = req.body;

  if (!arena_nome || !resp_nome || !resp_email || !resp_senha) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
  }

  try {
    const senhaHash = await bcrypt.hash(resp_senha, 10);
    const plano = plano_id || 1;
    const dia = dia_vencimento || 10;
    
    const resultArena = await db.runAsync(
      'INSERT INTO Arenas (nome, email, telefone, endereco, plano_id, dia_vencimento) VALUES (?, ?, ?, ?, ?, ?)', 
      [arena_nome, arena_email || null, arena_telefone || null, arena_endereco || null, plano, dia]
    );
    const tenantId = resultArena.lastID;

    await db.runAsync('INSERT INTO Usuarios (nome, email, senha_hash, perfil, tenant_id) VALUES (?, ?, ?, ?, ?)', [
      resp_nome, resp_email, senhaHash, 'Administrador', tenantId
    ]);

    logAuditEvent(req.user.id, 'SaaS: Arena Criada', `Arena ID: ${tenantId}, Nome: ${arena_nome}`, req.ip);

    res.status(201).json({ message: 'Arena e administrador criados com sucesso!', id: tenantId });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail do administrador já cadastrado.' });
    res.status(500).json({ error: 'Erro ao criar arena.' });
  }
};

const updateArena = async (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, endereco, dia_vencimento } = req.body;

  if (!nome) return res.status(400).json({ error: 'Nome da arena é obrigatório.' });

  try {
    let query = 'UPDATE Arenas SET nome = ?, email = ?, telefone = ?, endereco = ? WHERE id = ? AND status != -1';
    let params = [nome, email || null, telefone || null, endereco || null, id];

    if (dia_vencimento) {
      query = 'UPDATE Arenas SET nome = ?, email = ?, telefone = ?, endereco = ?, dia_vencimento = ? WHERE id = ? AND status != -1';
      params = [nome, email || null, telefone || null, endereco || null, dia_vencimento, id];
    }

    await db.runAsync(query, params);
    
    logAuditEvent(req.user.id, 'SaaS: Arena Editada', `Arena ID: ${id}, Novo Nome: ${nome}`, req.ip);

    res.json({ message: 'Arena atualizada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar arena.' });
  }
};

const deleteArena = async (req, res) => {
  const { id } = req.params;
  const { senha_master } = req.body;
  const superAdminId = req.user.id;

  if (!senha_master) return res.status(400).json({ error: 'Senha do Master é obrigatória.' });

  try {
    const master = await db.getAsync('SELECT senha_hash FROM Usuarios WHERE id = ? AND perfil = ?', [superAdminId, 'Superadmin']);
    if (!master) return res.status(403).json({ error: 'Usuário master inválido.' });

    const isValid = await bcrypt.compare(senha_master, master.senha_hash);
    if (!isValid) return res.status(401).json({ error: 'Senha incorreta. Exclusão negada.' });

    await db.runAsync('UPDATE Arenas SET status = -1 WHERE id = ?', [id]);
    
    logAuditEvent(req.user.id, 'SaaS: Arena Excluída (Soft Delete)', `Arena ID: ${id}`, req.ip);

    res.json({ message: 'Arena excluída (soft-delete) com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir arena.' });
  }
};

// --- MÓDULO FINANCEIRO (BILLING) ---

const getPlanosSaaS = async (req, res) => {
  try {
    const planos = await db.allAsync('SELECT * FROM PlanosSaaS ORDER BY valor_mensal ASC');
    res.json(planos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar planos.' });
  }
};

const updateArenaPlan = async (req, res) => {
  const { id } = req.params;
  const { plano_id } = req.body;

  if (!plano_id) return res.status(400).json({ error: 'Plano não fornecido.' });

  try {
    const novoPlano = await db.getAsync('SELECT max_quadras, nome FROM PlanosSaaS WHERE id = ?', [plano_id]);
    if (!novoPlano) return res.status(404).json({ error: 'Plano não encontrado.' });

    const quadrasAtuais = await db.getAsync('SELECT COUNT(*) as total FROM Quadras WHERE tenant_id = ?', [id]);

    if (quadrasAtuais.total > novoPlano.max_quadras) {
      return res.status(400).json({ 
        error: `A arena possui ${quadrasAtuais.total} quadras, o que excede o limite do plano ${novoPlano.nome} (${novoPlano.max_quadras}). Remova as quadras excedentes antes de fazer o downgrade.`
      });
    }

    await db.runAsync('UPDATE Arenas SET plano_id = ? WHERE id = ?', [plano_id, id]);
    logAuditEvent(req.user.id, 'SaaS: Plano Alterado', `Arena ID: ${id}, Novo Plano ID: ${plano_id}`, req.ip);
    
    res.json({ message: 'Plano da arena atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar plano.' });
  }
};

const getFaturasSaaS = async (req, res) => {
  const { id } = req.params;
  try {
    const faturas = await db.allAsync(`
      SELECT f.*, p.nome as plano_nome 
      FROM FaturasSaaS f 
      JOIN PlanosSaaS p ON f.plano_id = p.id
      WHERE f.tenant_id = ? 
      ORDER BY f.data_vencimento DESC
    `, [id]);
    res.json(faturas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar faturas.' });
  }
};

const payFaturaSaaS = async (req, res) => {
  const { id } = req.params; // ID da fatura
  const superAdminId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const fatura = await db.getAsync('SELECT tenant_id, status FROM FaturasSaaS WHERE id = ?', [id]);
    if (!fatura) return res.status(404).json({ error: 'Fatura não encontrada.' });
    if (fatura.status === 'Paga') return res.status(400).json({ error: 'Fatura já está paga.' });

    await db.runAsync(`
      UPDATE FaturasSaaS 
      SET status = 'Paga', data_pagamento = ?, registrado_por = ? 
      WHERE id = ?
    `, [today, superAdminId, id]);

    logAuditEvent(superAdminId, 'SaaS: Fatura Paga', `Fatura #${id} marcada como paga (Arena ID: ${fatura.tenant_id})`, req.ip);

    // Se a arena estava bloqueada (status=0) por atraso, talvez deva desbloquear?
    // Deixaremos o SuperAdmin desbloquear manualmente ou poderíamos fazer automático.
    
    res.json({ message: 'Pagamento registrado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar pagamento.' });
  }
};

const getAllFaturasSaaS = async (req, res) => {
  try {
    const faturas = await db.allAsync(`
      SELECT f.*, p.nome as plano_nome, a.nome as arena_nome
      FROM FaturasSaaS f
      JOIN PlanosSaaS p ON f.plano_id = p.id
      JOIN Arenas a ON f.tenant_id = a.id
      ORDER BY f.data_vencimento DESC
    `);
    res.json(faturas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar todas as faturas.' });
  }
};

const getAuditoriaMaster = async (req, res) => {
  try {
    // Busca os últimos 500 logs globais para o Master
    const logs = await db.allAsync(`
      SELECT l.*, u.nome as usuario_nome, u.email as usuario_email, a.nome as arena_nome
      FROM LogsAuditoria l
      LEFT JOIN Usuarios u ON l.usuario_id = u.id
      LEFT JOIN Arenas a ON l.tenant_id = a.id
      ORDER BY l.criado_em DESC
      LIMIT 500
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar auditoria global.' });
  }
};

module.exports = { 
  getArenas, getMetrics, toggleArenaStatus, getArenaById, 
  createArena, updateArena, deleteArena,
  getPlanosSaaS, updateArenaPlan, getFaturasSaaS, getAllFaturasSaaS, payFaturaSaaS, getAuditoriaMaster
};
