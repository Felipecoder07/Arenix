const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';
const JWT_EXPIRES_IN = '8h'; // RNF-005

const login = (req, res) => {
  const { email, senha } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  db.get(
    `SELECT u.*, a.nome as arena_nome 
     FROM Usuarios u 
     LEFT JOIN Arenas a ON u.tenant_id = a.id 
     WHERE u.email = ?`, 
    [email], 
    async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }

    if (!user) {
      logAuditEvent(null, 'Tentativa de login falha', `E-mail tentado: ${email}, Motivo: Usuário inexistente`, ip);
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      logAuditEvent(user.id, 'Tentativa de login falha', `E-mail tentado: ${email}, Motivo: Senha inválida`, ip);
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    // Login bem-sucedido
    const payload = {
      id: user.id,
      tenant_id: user.tenant_id,
      perfil: user.perfil,
      cliente_id: user.cliente_id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logAuditEvent(user.id, 'Login bem-sucedido', `User-Agent: ${userAgent}`, ip);

    res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        arena_nome: user.arena_nome
      }
    });
  });
};

const logout = (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const usuario_id = req.user ? req.user.id : null;
  
  if (usuario_id) {
    logAuditEvent(usuario_id, 'Logout', 'Logout manual', ip);
  }
  
  res.json({ message: 'Logout registrado com sucesso.' });
};

const register = async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  if (perfil !== 'Cliente' && perfil !== 'Administrador') {
    return res.status(400).json({ error: 'Perfil inválido para cadastro.' });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 12);

    if (perfil === 'Cliente') {
      db.run('INSERT INTO Clientes (nome, email) VALUES (?, ?)', [nome, email], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail já cadastrado.' });
          return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
        }
        const cliente_id = this.lastID;
        db.run('INSERT INTO Usuarios (nome, email, senha_hash, perfil, cliente_id) VALUES (?, ?, ?, ?, ?)', 
          [nome, email, senha_hash, perfil, cliente_id], function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao criar usuário.' });
            logAuditEvent(this.lastID, 'Cadastro Cliente', `E-mail: ${email}`, ip);
            res.status(201).json({ message: 'Cadastro realizado com sucesso!' });
        });
      });
    } else if (perfil === 'Administrador') {
      const arenaNome = `Arena de ${nome}`;
      db.run('INSERT INTO Arenas (nome) VALUES (?)', [arenaNome], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao criar arena.' });
        const tenant_id = this.lastID;
        db.run('INSERT INTO Usuarios (nome, email, senha_hash, perfil, tenant_id) VALUES (?, ?, ?, ?, ?)', 
          [nome, email, senha_hash, perfil, tenant_id], function(err) {
            if (err) {
              if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail já cadastrado.' });
              return res.status(500).json({ error: 'Erro ao criar usuário administrador.' });
            }
            logAuditEvent(this.lastID, 'Cadastro Administrador', `E-mail: ${email}, Arena: ${arenaNome}`, ip);
            res.status(201).json({ message: 'Cadastro de arena realizado com sucesso!' });
        });
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro interno durante o cadastro.' });
  }
};

module.exports = { login, logout, register };
