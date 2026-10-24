const { httpError } = require('./security');

function validateArenaDetails(body) {
  for (const [field, limit] of [['nome', 150], ['endereco', 500], ['telefone', 30], ['email', 254]]) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || body[field].length > limit || /[\r\n\x00]/.test(body[field])) {
      throw httpError(400, `Informe um valor válido para ${field}.`);
    }
    body[field] = body[field].trim();
  }
  if (body.nome !== undefined && !body.nome) throw httpError(400, 'Informe o nome da arena.');
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    throw httpError(400, 'Informe um e-mail válido para a arena.');
  }
  if (body.telefone) {
    const digits = body.telefone.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(body.telefone) || !/^(?:55)?[1-9]\d\d{8,9}$/.test(digits)) {
      throw httpError(400, 'Informe um telefone válido com DDD, por exemplo (11) 99999-9999.');
    }
  }
  if (body.fuso_horario !== undefined && !['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'].includes(body.fuso_horario)) {
    throw httpError(400, 'Selecione um fuso horário válido.');
  }
}

module.exports = { validateArenaDetails };
