const bcrypt = require('bcrypt');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

// ─── LISTAR USUÁRIOS ─────────────────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await db.allAsync(
      `SELECT id, nome, email, perfil, criado_em, cliente_id FROM Usuarios WHERE tenant_id = ? ORDER BY nome ASC`,
      [req.user.tenant_id]
    );
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
};

// ─── CRIAR USUÁRIO ───────────────────────────────────────────────────────────
const criarUsuario = async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios para criação.' });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 12);
    const result = await db.runAsync(
      `INSERT INTO Usuarios (tenant_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)`,
      [req.user.tenant_id, nome, email, senha_hash, perfil]
    );

    logAuditEvent(admin_id, 'Criação de Usuário', `Criou o usuário ${email} (${perfil})`, ip);
    res.status(201).json({ message: 'Usuário criado com sucesso.', id: result.lastID });
  } catch (error) {
    console.error(error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

// ─── EDITAR USUÁRIO ──────────────────────────────────────────────────────────
const editarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nome, email, perfil, senha } = req.body;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!nome || !email || !perfil) {
    return res.status(400).json({ error: 'Nome, e-mail e perfil são obrigatórios.' });
  }

  try {
    let sql = `UPDATE Usuarios SET nome = ?, email = ?, perfil = ? WHERE id = ? AND tenant_id = ?`;
    let params = [nome, email, perfil, id, req.user.tenant_id];

    if (senha) {
      const senha_hash = await bcrypt.hash(senha, 12);
      sql = `UPDATE Usuarios SET nome = ?, email = ?, perfil = ?, senha_hash = ? WHERE id = ? AND tenant_id = ?`;
      params = [nome, email, perfil, senha_hash, id, req.user.tenant_id];
    }

    const result = await db.runAsync(sql, params);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    logAuditEvent(admin_id, 'Edição de Usuário', `Editou os dados do usuário ID ${id} (${email})`, ip);
    res.json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    console.error(error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'O e-mail informado já está em uso por outro usuário.' });
    }
    res.status(500).json({ error: 'Erro ao editar usuário.' });
  }
};

// ─── EXCLUIR USUÁRIO ─────────────────────────────────────────────────────────
const excluirUsuario = async (req, res) => {
  const { id } = req.params;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  // Evita que o admin exclua a si mesmo
  if (Number(id) === Number(admin_id)) {
    return res.status(400).json({ error: 'Você não pode excluir a sua própria conta.' });
  }

  try {
    const usuario = await db.getAsync(`SELECT perfil FROM Usuarios WHERE id = ? AND tenant_id = ?`, [id, req.user.tenant_id]);
    if (usuario && usuario.perfil === 'Administrador') {
      return res.status(403).json({ error: 'Não é possível excluir um Administrador.' });
    }

    const result = await db.runAsync(`DELETE FROM Usuarios WHERE id = ? AND tenant_id = ?`, [id, req.user.tenant_id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    logAuditEvent(admin_id, 'Exclusão de Usuário', `Excluiu o usuário ID ${id}`, ip);
    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
};

module.exports = {
  listarUsuarios,
  criarUsuario,
  editarUsuario,
  excluirUsuario
};
