const db = require('../config/database');
const { httpError, frontendUrl } = require('../utils/security');
const calendar = require('./saasCalendarService');
const dates = require('../utils/dateUtils');

async function cadastrarArena({ nome, adminNome, email, senhaHash, telefone, endereco, planoId, diaVencimento, convite = false }) {
  if (typeof nome !== 'string' || !nome.trim() || typeof email !== 'string' ||
      email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw httpError(400, 'Informe nome e e-mail válidos.');
  }
  email = email.trim().toLowerCase();
  await require('../config/securitySchema').ensureSecuritySchema(db);
  return db.transaction(async () => {
    if (await db.getAsync('SELECT id FROM Usuarios WHERE LOWER(email) = ?', [email])) {
      throw httpError(400, 'E-mail já cadastrado.');
    }
    const plano = await db.getAsync('SELECT * FROM PlanosSaaS WHERE id = ?', [planoId]);
    if (!plano) throw httpError(404, 'Plano não encontrado.');
    const config = await calendar.configurarCadastro();
    if (diaVencimento !== undefined && calendar.validarDia(diaVencimento) !== config.diaVencimento) {
      throw httpError(400, 'No cadastro, o vencimento acompanha o início da assinatura após o trial. Altere o dia depois, na edição da arena.');
    }
    const base = nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'arena';
    let slug = base;
    for (let suffix = 2; await db.getAsync('SELECT id FROM Arenas WHERE slug = ?', [slug]); suffix++) slug = `${base}-${suffix}`;
    const status = convite ? 1 : config.arenaStatus;
    const result = await db.runAsync(`INSERT INTO Arenas
      (nome,slug,email,telefone,endereco,plano_id,dia_vencimento,trial_expira_em,status,ciclo_cobranca,motivo_bloqueio)
      VALUES (?,?,?,?,?,?,?,?,?,'mensal',?)`,
    [nome.trim(),slug,email,telefone || null,endereco || null,plano.id,config.diaVencimento,config.trialExpiraEm,status,status === 0 ? 'cadastro' : null]);
    const tenantId = result.lastID;
    const user = await db.runAsync(`INSERT INTO Usuarios (nome,email,senha_hash,perfil,tenant_id,activation_pending)
      VALUES (?,?,?,'Administrador',?,?)`, [adminNome,email,senhaHash,tenantId,convite ? 1 : 0]);
    let activation;
    if (convite) activation = await require('./recoveryService').createChallenge(user.lastID, 'activation');
    if (status === 0) {
      const hoje = dates.getTodayString();
      await db.runAsync(`INSERT INTO FaturasSaaS
        (tenant_id,plano_id,valor,ciclo,descricao,data_vencimento,periodo_fim,status)
        VALUES (?,?,?,'mensal',?,?,?,'Pendente')`, [tenantId,plano.id,plano.valor_mensal,
        `Assinatura Inicial Plano ${plano.nome}`,hoje,dates.calcularProximaDataVencimento(hoje,config.diaVencimento)]);
    }
    return { tenantId, usuarioId: user.lastID, email, activation };
  });
}

// SMTP is outside the transaction: a delivery failure must not undo a valid
// registration or encourage duplicate registrations. Recovery issues a new link.
async function enviarConvite(cadastro) {
  try {
    return Boolean(await require('./emailService').sendEmail(cadastro.email, 'Ative seu acesso',
      'Defina sua senha (validade: 1 hora): ' + frontendUrl() + '/redefinir-senha?token=' + encodeURIComponent(cadastro.activation)));
  } catch {
    return false;
  }
}

module.exports = { cadastrarArena, enviarConvite };
