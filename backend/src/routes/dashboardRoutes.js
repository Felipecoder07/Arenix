const express = require('express');
const router = express.Router();
const { obterResumoDia } = require('../controllers/dashboardController');
const { verifyToken, requireRole } = require('../middlewares/auth');

router.get('/resumo', verifyToken, requireRole(['Administrador', 'Gerente', 'Recepcionista']), obterResumoDia);

module.exports = router;
