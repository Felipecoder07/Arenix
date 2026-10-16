const { requirePermission } = require('../utils/permissions');
const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middlewares/auth');

// Rotas restritas para Administrador
router.use(verifyToken);
router.use(requirePermission('users.manage'));

// Compact staff activity feed, without exposing audit details, IPs or customer data.
router.get('/atividades', async (req, res) => {
  try {
    const db = require('../config/database');
    const atividades = await db.allAsync(`
      SELECT l.id, l.evento, l.criado_em, u.nome AS usuario_nome
      FROM LogsAuditoria l
      JOIN Usuarios u ON u.id = l.usuario_id AND u.tenant_id = l.tenant_id
      WHERE l.tenant_id = ? AND u.perfil IN ('Administrador', 'Gerente', 'Recepcionista')
      ORDER BY l.criado_em DESC, l.id DESC LIMIT 3
    `, [req.user.tenant_id]);
    res.json(atividades);
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar a atividade recente.' });
  }
});

router.post('/transferir-administracao', requirePermission('owner.transfer'), require('../middlewares/rateLimiter').recoveryLimiter, require('../controllers/ownershipController').transfer);

router.get('/', usuariosController.listarUsuarios);
router.post('/', usuariosController.criarUsuario);
router.put('/:id', usuariosController.editarUsuario);
router.delete('/:id', usuariosController.excluirUsuario);

module.exports = router;
