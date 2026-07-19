const express = require('express');
const router = express.Router();
const { listarQuadras, criarQuadra, atualizarQuadra, alterarStatusQuadra, criarBloqueio, deletarQuadra } = require('../controllers/quadrasController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Todas as rotas de quadras exigem token
router.use(verifyToken);

// Listar quadras (Qualquer perfil interno logado)
router.get('/', listarQuadras);

// Apenas Gerentes e Admins podem criar ou modificar quadras
router.post('/', requireRole(['Administrador', 'Gerente']), criarQuadra);
router.put('/:id', requireRole(['Administrador', 'Gerente']), atualizarQuadra);
router.patch('/:id/status', requireRole(['Administrador', 'Gerente']), alterarStatusQuadra);
router.delete('/:id', requireRole(['Administrador', 'Gerente']), deletarQuadra);

// Bloqueios
router.post('/bloqueios', requireRole(['Administrador', 'Gerente', 'Recepcionista']), criarBloqueio);

module.exports = router;
