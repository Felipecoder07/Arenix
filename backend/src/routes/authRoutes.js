const express = require('express');
const router = express.Router();
const { login, logout, register } = require('../controllers/authController');
const { loginLimiter } = require('../middlewares/rateLimiter');
const { verifyToken } = require('../middlewares/auth');

router.post('/login', loginLimiter, login);
router.post('/register', register);
router.post('/logout', verifyToken, logout);

module.exports = router;
