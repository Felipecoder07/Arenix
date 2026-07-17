const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const motivosController = require('../controllers/motivosController');

router.use(verifyToken);

// Qualquer usuário logado pode listar os motivos
router.get('/', motivosController.listarMotivos);

// Apenas Administrador pode criar ou excluir motivos (pode ser ajustado se Gerente puder)
router.post('/', requireRole(['Administrador']), motivosController.criarMotivo);
router.delete('/:id', requireRole(['Administrador']), motivosController.excluirMotivo);

module.exports = router;
