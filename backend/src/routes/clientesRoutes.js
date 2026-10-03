const { requirePermission } = require('../utils/permissions');
const express = require('express');
const router = express.Router();
const { 
  listarClientes, 
  obterEstatisticasClientes,
  criarCliente, 
  obterCliente, 
  atualizarCliente, 
  excluirCliente, 
  arquivarCliente, 
  desarquivarCliente
} = require('../controllers/clientesController');
const { verifyToken } = require('../middlewares/auth');

router.use(verifyToken);
router.use(requirePermission('clients.manage'));
router.get('/estatisticas', obterEstatisticasClientes);

router.get('/', listarClientes);
router.post('/', criarCliente);
router.get('/:id', obterCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);
router.patch('/:id/arquivar', arquivarCliente);
router.patch('/:id/desarquivar', desarquivarCliente);

module.exports = router;
