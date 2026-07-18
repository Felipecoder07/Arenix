const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saasController');
const { verifyToken, verifySuperAdmin } = require('../middlewares/auth');

router.use(verifyToken);
router.use(verifySuperAdmin);

router.get('/arenas', saasController.getArenas);
router.post('/arenas', saasController.createArena);
router.get('/arenas/:id', saasController.getArenaById);
router.put('/arenas/:id', saasController.updateArena);
router.delete('/arenas/:id', saasController.deleteArena);
router.patch('/arenas/:id/status', saasController.toggleArenaStatus);

router.get('/planos', saasController.getPlanosSaaS);
router.patch('/arenas/:id/plano', saasController.updateArenaPlan);
router.get('/arenas/:id/faturas', saasController.getFaturasSaaS);
router.post('/faturas/:id/pagar', saasController.payFaturaSaaS);

router.get('/metrics', saasController.getMetrics);

router.get('/faturas', saasController.getAllFaturasSaaS);
router.get('/auditoria', saasController.getAuditoriaMaster);

module.exports = router;
