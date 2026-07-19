const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Rotas restritas para Administrador
router.use(verifyToken);
router.use(requireRole(['Administrador', 'Gerente']));

router.get('/', usuariosController.listarUsuarios);
router.post('/', usuariosController.criarUsuario);
router.put('/:id', usuariosController.editarUsuario);
router.delete('/:id', usuariosController.excluirUsuario);

module.exports = router;
