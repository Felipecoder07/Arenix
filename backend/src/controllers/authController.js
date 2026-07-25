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
    `SELECT u.*, a.nome as arena_nome, a.status as arena_status
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

    // Se a arena está excluída (status = -1), bloqueia qualquer login
    if (user.perfil !== 'SuperAdmin' && user.arena_status === -1) {
      logAuditEvent(user.id, 'Tentativa de login falha', `Motivo: Arena excluída`, ip);
      return res.status(403).json({ error: 'Esta arena foi removida do sistema. Entre em contato com o suporte.' });
    }

    // Se a arena está suspensa por inadimplência (status = 0):
    // Apenas o Administrador (dono da arena) pode logar para acessar a aba Assinatura e efetuar o pagamento Pix
    if (user.perfil !== 'SuperAdmin' && user.arena_status === 0 && user.perfil !== 'Administrador') {
      logAuditEvent(user.id, 'Tentativa de login falha', `Motivo: Arena suspensa por inadimplência (Perfil ${user.perfil})`, ip);
      return res.status(403).json({ error: 'A arena está suspensa por pendência financeira. O administrador da arena deve acessar para efetuar o pagamento.' });
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

    // Registra a sessão ativa no banco em background
    db.runAsync(`
      INSERT INTO SessoesAtivas (usuario_id, tenant_id, token, ip, user_agent) 
      VALUES (?, ?, ?, ?, ?)
    `, [user.id, user.tenant_id, token, ip, userAgent]).catch(err => console.error('Erro ao registrar sessao ativa:', err));

    res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        arena_nome: user.arena_nome,
        arena_status: user.arena_status
      }
    });
  });
};

const logout = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const usuario_id = req.user ? req.user.id : null;
  const authHeader = req.headers['authorization'];
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      await db.runAsync('DELETE FROM SessoesAtivas WHERE token = ?', [token]).catch(err => console.error('Erro ao remover sessao no logout:', err));
    }
  }
  
  if (usuario_id) {
    logAuditEvent(usuario_id, 'Logout', 'Logout manual', ip);
  }
  
  res.json({ message: 'Logout registrado com sucesso.' });
};

const register = async (req, res) => {
  const { nome, email, senha, perfil, arena_nome, telefone, arena_cidade } = req.body;
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
      const arenaNomeFinal = arena_nome || `Arena de ${nome}`;
      const planoReq = req.body.plano || req.body.plano_id;

      // Buscar plano correspondente no banco (ou fallback para ID 1 'Basic')
      let planoIdFinal = 1;
      if (planoReq) {
        let planoRow = null;
        if (!isNaN(parseInt(planoReq, 10))) {
          planoRow = await db.getAsync('SELECT id FROM PlanosSaaS WHERE id = ?', [parseInt(planoReq, 10)]);
        }
        if (!planoRow && typeof planoReq === 'string') {
          // Mapear termos comuns: 'starter' / 'basic' -> Basic, 'pro' -> Pro, 'enterprise' -> Enterprise
          let searchName = planoReq.toLowerCase();
          if (searchName === 'starter') searchName = 'basic';
          planoRow = await db.getAsync('SELECT id FROM PlanosSaaS WHERE LOWER(nome) = ?', [searchName]);
        }
        if (planoRow) {
          planoIdFinal = planoRow.id;
        }
      }

      // Buscar dias_trial configurados no SaaS (default 14 dias)
      const trialRow = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'dias_trial'");
      const diasTrial = parseInt(trialRow?.valor || '14', 10);
      const trialExpiraEm = new Date(Date.now() + diasTrial * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      db.run(
        'INSERT INTO Arenas (nome, telefone, endereco, plano_id, trial_expira_em, status) VALUES (?, ?, ?, ?, ?, 1)', 
        [arenaNomeFinal, telefone || null, arena_cidade || null, planoIdFinal, trialExpiraEm], 
        function(err) {
          if (err) {
            console.error('Erro ao criar arena no register:', err);
            return res.status(500).json({ error: 'Erro ao criar arena.' });
          }
          const tenant_id = this.lastID;
          db.run('INSERT INTO Usuarios (nome, email, senha_hash, perfil, tenant_id) VALUES (?, ?, ?, ?, ?)', 
            [nome, email, senha_hash, perfil, tenant_id], function(err) {
              if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail já cadastrado.' });
                return res.status(500).json({ error: 'Erro ao criar usuário administrador.' });
              }
              logAuditEvent(this.lastID, 'Cadastro Administrador', `E-mail: ${email}, Arena: ${arenaNomeFinal}, Plano ID: ${planoIdFinal}`, ip);
              res.status(201).json({ message: 'Cadastro de arena realizado com sucesso!' });
          });
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro interno durante o cadastro.' });
  }
};

const crypto = require('crypto');

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório.' });
  }

  try {
    const user = await db.getAsync('SELECT id, nome, email FROM Usuarios WHERE email = ?', [email.trim()]);
    
    // Proteção contra enumeração de usuários
    if (!user) {
      return res.json({ message: 'Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.' });
    }

    // Gerar token criptográfico e expiração (1 hora)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000).toISOString(); 

    await db.runAsync(
      'UPDATE Usuarios SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );

    // Identificar origem dinâmica (Porta 5173 ou 5174)
    const referer = req.headers['referer'] || req.headers['origin'] || 'http://localhost:5173';
    const baseUri = referer.includes('5174') ? 'http://localhost:5174' : 'http://localhost:5173';
    const resetLink = `${baseUri}/redefinir-senha?token=${token}`;

    logAuditEvent(user.id, 'Recuperação Solicitada', `E-mail: ${user.email}`, ip);

    // Dispara o e-mail de recuperação em background (IIFE)
    (async () => {
      try {
        const { sendEmail } = require('../services/emailService');
        const subject = 'Recuperação de Senha - CourtManager';
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #4A5568;">Olá, ${user.nome}! 👋</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>CourtManager</strong>.</p>
            <p>Para prosseguir com a redefinição de senha, clique no botão abaixo:</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4A5568; color: #FFF; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
            </div>
            <p style="font-size: 0.9em; color: #718096;">Ou se preferir, copie e cole o link a seguir no seu navegador:</p>
            <p style="font-size: 0.85em; color: #4A5568; word-break: break-all;"><a href="${resetLink}">${resetLink}</a></p>
            <p style="font-size: 0.9em; color: #E53E3E; font-weight: bold;">Este link expira em 1 hora.</p>
            <p style="font-size: 0.9em; color: #718096;">Se você não solicitou essa redefinição, por favor ignore este e-mail. Sua senha atual permanecerá segura.</p>
            <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
            <p style="font-size: 0.8em; color: #A0AEC0;">Esta é uma mensagem automática enviada por Arenix CourtManager.</p>
          </div>
        `;
        await sendEmail(user.email, subject, html);
      } catch (e) {
        console.error('[SMTP] Erro ao disparar e-mail de recuperação:', e.message);
      }
    })();

    res.json({ message: 'Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.' });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ error: 'Erro interno ao processar solicitação.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, novaSenha } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!token || !novaSenha) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  }

  try {
    // Busca usuário com token válido e expiração maior que agora
    const user = await db.getAsync(`
      SELECT id, nome, email FROM Usuarios 
      WHERE reset_password_token = ? AND reset_password_expires > datetime('now')
    `, [token]);

    if (!user) {
      return res.status(400).json({ error: 'Token de recuperação inválido ou expirado.' });
    }

    // Hash da nova senha (Bcrypt 12)
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

    // Atualiza a senha e limpa o token (token de uso único)
    await db.runAsync(`
      UPDATE Usuarios 
      SET senha_hash = ?, reset_password_token = NULL, reset_password_expires = NULL 
      WHERE id = ?
    `, [novaSenhaHash, user.id]);

    logAuditEvent(user.id, 'Senha Redefinida', `E-mail: ${user.email}`, ip);

    // Confirmação de alteração de senha por e-mail
    (async () => {
      try {
        const { sendEmail } = require('../services/emailService');
        const subject = 'Sua senha foi alterada - CourtManager';
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #2F855A;">Olá, ${user.nome}! ✔️</h2>
            <p>Confirmamos que a senha da sua conta no <strong>CourtManager</strong> foi alterada com sucesso.</p>
            <p>Se você realizou essa alteração, nenhuma ação adicional é necessária.</p>
            <p style="font-size: 0.9em; color: #E53E3E; font-weight: bold;">Caso você não tenha feito essa alteração, entre em contato imediatamente com o suporte ou o administrador da sua arena.</p>
            <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
            <p style="font-size: 0.8em; color: #A0AEC0;">Esta é uma mensagem automática enviada por Arenix CourtManager.</p>
          </div>
        `;
        await sendEmail(user.email, subject, html);
      } catch (e) {
        console.error('[SMTP] Erro ao disparar e-mail de confirmação de redefinição:', e.message);
      }
    })();

    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
};

module.exports = { login, logout, register, forgotPassword, resetPassword };
