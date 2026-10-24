const { httpError } = require('./security');

// Authorization and token exchange must send exactly the same redirect URI.
function redirectUri(req) {
  const configured = process.env.MERCADO_PAGO_REDIRECT_URI?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw httpError(503, 'Configure a URL de retorno do Mercado Pago na plataforma.');
  }
  const value = configured || `${req.protocol}://${req.get('host')}/api/pagamentos/gateway/oauth/callback`;
  let url;
  try { url = new URL(value); } catch { throw httpError(503, 'URL de retorno do Mercado Pago invalida.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      url.pathname !== '/api/pagamentos/gateway/oauth/callback' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && process.env.NODE_ENV !== 'production'))) {
    throw httpError(503, 'Configure uma URL HTTPS de retorno do Mercado Pago. HTTP local e permitido somente em desenvolvimento.');
  }
  return value;
}

module.exports = { redirectUri };
