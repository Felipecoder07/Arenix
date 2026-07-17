const rateLimit = require('express-rate-limit');

// Bloqueio de IP após 10 tentativas de login falhas consecutivas em 5 minutos
// Regra de Negócio: RN-015 (Flexibilizada para UX SaaS)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos de bloqueio
  max: 10, // Limite de 10 tentativas erradas por IP na janela
  message: { error: 'Muitas tentativas de login. Tente novamente em 5 minutos.' },
  skipSuccessfulRequests: true // Conta apenas as falhas
});

module.exports = { loginLimiter };
