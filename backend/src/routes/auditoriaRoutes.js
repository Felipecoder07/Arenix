const express = require('express');
const router = express.Router();
const { listarLogs } = require('../controllers/auditoriaController');
const { verifyToken, requireRole } = require('../middlewares/auth');

router.get('/', verifyToken, requireRole(['Administrador']), listarLogs);

module.exports = router;
