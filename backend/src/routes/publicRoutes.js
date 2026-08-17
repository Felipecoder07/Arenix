const express = require('express');
const router = express.Router();
const {
  getTenantBySlug,
  getQuadrasBySlug,
  getDisponibilidadeBySlug,
  agendarReservaPublica,
  cadastrarAtletaPublico,
  loginAtletaPublico,
  googleAuthAtletaPublico,
  getPerfilAtleta,
  atualizarPerfilAtleta,
  getStatusReservaPublica,
  cancelarPendentePublico,
  getMinhasReservasAtleta,
  solicitarRecuperacaoSenhaAtleta,
  redefinirSenhaAtleta,
  obterPixReservaPendente,
  cancelarReservaAtleta,
  excluirContaAtleta
} = require('../controllers/publicController');


const {
  publicApiLimiter,
  publicAuthLimiter,
  publicBookingLimiter
} = require('../middlewares/rateLimiter');

// Rotas públicas de consulta geral com proteção contra DDoS
router.get('/tenant/:slug', publicApiLimiter, getTenantBySlug);
router.get('/tenant/:slug/quadras', publicApiLimiter, getQuadrasBySlug);
router.get('/tenant/:slug/disponibilidade', publicApiLimiter, getDisponibilidadeBySlug);
router.get('/tenant/:slug/minhas-reservas', publicApiLimiter, getMinhasReservasAtleta);
router.get('/tenant/:slug/status-reserva/:reserva_id', publicApiLimiter, getStatusReservaPublica);
router.get('/status-reserva/:reserva_id', publicApiLimiter, getStatusReservaPublica);
router.get('/tenant/:slug/reserva-pix/:reserva_id', publicApiLimiter, obterPixReservaPendente);

// Rotas públicas sensíveis com proteção contra Brute Force & Bot Spam
router.post('/tenant/:slug/login', publicAuthLimiter, loginAtletaPublico);
router.post('/tenant/:slug/cadastro', publicAuthLimiter, cadastrarAtletaPublico);
router.post('/tenant/:slug/google', publicAuthLimiter, googleAuthAtletaPublico);
router.post('/tenant/:slug/esqueci-senha', publicAuthLimiter, solicitarRecuperacaoSenhaAtleta);
router.post('/tenant/:slug/redefinir-senha', publicAuthLimiter, redefinirSenhaAtleta);
router.post('/tenant/:slug/cancelar-reserva/:id', publicBookingLimiter, cancelarReservaAtleta);
router.post('/tenant/:slug/excluir-conta', publicAuthLimiter, excluirContaAtleta);


// Rota de criação de reserva com limite de agendamento por IP
router.post('/tenant/:slug/agendar', publicBookingLimiter, agendarReservaPublica);

// Rota de cancelamento de reservas expiradas/pendentes não pagas
router.post('/tenant/:slug/cancelar-pendente', publicApiLimiter, cancelarPendentePublico);

// Rota de alteração de perfil
router.get('/tenant/:slug/meu-perfil', publicApiLimiter, getPerfilAtleta);
router.put('/tenant/:slug/meu-perfil', publicApiLimiter, atualizarPerfilAtleta);

module.exports = router;
