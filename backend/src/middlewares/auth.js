const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Token não fornecido.' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Formato de token inválido.' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token expirado ou inválido.' });
    req.user = decoded; // { id, tenant_id, perfil }

    // Atualiza o último acesso da sessão em background
    const db = require('../config/database');
    db.runAsync('UPDATE SessoesAtivas SET ultimo_acesso = CURRENT_TIMESTAMP WHERE token = ?', [token])
      .catch(err => console.error('Erro ao atualizar atividade da sessao:', err));

    // Validação de segurança de tenant: SuperAdmin é isento de bloqueios.
    // As rotas de assinatura (/api/tenant/assinatura/*) também são isentas do bloqueio status=0
    // para permitir que o dono da arena acesse o painel financeiro e pague sua mensalidade para se desbloquear.
    if (req.user.perfil !== 'SuperAdmin' && req.user.tenant_id) {
      try {
        const isWhitelistedRoute = req.originalUrl && (
          req.originalUrl.includes('/api/tenant/assinatura') || 
          req.originalUrl.includes('/api/auth/me') ||
          req.originalUrl.includes('/api/auth/logout')
        );

        const arena = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [req.user.tenant_id]);
        if (arena && arena.status === 0 && !isWhitelistedRoute) {
          return res.status(403).json({ 
            error: 'Acesso suspenso por pendência financeira. Acesse a aba Assinatura para regularizar.',
            blocked: true 
          });
        }

        const maintRow = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'manutencao_ativa'");
        if (maintRow && maintRow.valor === '1') {
          const msgRow = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'manutencao_mensagem'");
          return res.status(503).json({
            error: msgRow && msgRow.valor ? msgRow.valor : 'O sistema está em manutenção programada. Voltamos em instantes.',
            maintenance: true
          });
        }
      } catch (checkErr) {
        console.error('Erro ao verificar status da arena no middleware:', checkErr);
      }
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
