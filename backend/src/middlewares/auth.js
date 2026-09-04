const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

async function verificarStatusTenantEManutencao(db, user, originalUrl) {
  if (user.perfil === 'SuperAdmin' || !user.tenant_id) return null;

  try {
    const isWhitelistedRoute = originalUrl && (
      originalUrl.includes('/api/tenant/assinatura') || 
      originalUrl.includes('/api/auth/me') ||
      originalUrl.includes('/api/auth/logout')
    );

    const arena = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [user.tenant_id]);
    if (!arena || arena.status === -1) {
      return { 
        status: 403, 
        body: { error: 'Esta arena foi removida da plataforma. O acesso foi revogado.', deleted: true } 
      };
    }

    if (arena.status === 0 && !isWhitelistedRoute) {
      return { 
        status: 403, 
        body: { error: 'Acesso suspenso por pendência financeira. Acesse a aba Assinatura para regularizar.', blocked: true } 
      };
    }

    const maintRow = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'manutencao_ativa'");
    if (maintRow && maintRow.valor === '1') {
      const msgRow = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'manutencao_mensagem'");
      return {
        status: 503,
        body: {
          error: msgRow && msgRow.valor ? msgRow.valor : 'O sistema está em manutenção programada. Voltamos em instantes.',
          maintenance: true
        }
      };
    }
  } catch (checkErr) {
    console.error('Erro ao verificar status da arena no middleware:', checkErr);
  }

  return null;
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Token não fornecido.' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Formato de token inválido.' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token expirado ou inválido.' });
    req.user = decoded;

    const db = require('../config/database');
    db.runAsync('UPDATE SessoesAtivas SET ultimo_acesso = CURRENT_TIMESTAMP WHERE token = ?', [token])
      .catch(errSess => console.error('Erro ao atualizar atividade da sessao:', errSess));

    const checkResult = await verificarStatusTenantEManutencao(db, req.user, req.originalUrl);
    if (checkResult) {
      return res.status(checkResult.status).json(checkResult.body);
    }

    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Acesso negado para este perfil.' });
    }
    next();
  };
};

const verifySuperAdmin = (req, res, next) => {
  if (!req.user || req.user.perfil !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o Super Administrador pode realizar esta ação.' });
  }
  next();
};

module.exports = { verifyToken, requireRole, verifySuperAdmin };
