const express = require('express');
const router = express.Router();
const { listarClientes, criarCliente, obterCliente, atualizarCliente, excluirCliente } = require('../controllers/clientesController');
const { verifyToken } = require('../middlewares/auth');

router.use(verifyToken);
router.get('/', listarClientes);
router.post('/', criarCliente);
router.get('/:id', obterCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);

module.exports = router;
