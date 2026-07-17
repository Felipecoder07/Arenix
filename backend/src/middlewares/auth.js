const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Token não fornecido.' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Formato de token inválido.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token expirado ou inválido.' });
    req.user = decoded; // { id, tenant_id, perfil }
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

module.exports = { verifyToken, requireRole };
