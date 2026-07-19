const express = require('express');
const router = express.Router();
const arenasController = require('../controllers/arenasController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Rotas restritas para Administrador
router.use(verifyToken);
router.use(requireRole(['Administrador', 'Gerente']));

router.get('/minha', arenasController.getMinhaArena);
router.put('/minha', arenasController.atualizarMinhaArena);

module.exports = router;
