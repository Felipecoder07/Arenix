const db = require('../config/database');
const dates = require('../utils/dateUtils');
const { httpError } = require('../utils/security');

function validarDia(value) {
  if (!['number', 'string'].includes(typeof value) || !/^\d{1,2}$/.test(String(value)) ||
      Number(value) < 1 || Number(value) > 31) {
    throw httpError(400, 'O dia de vencimento deve ser um inteiro entre 1 e 31.');
  }
  return Number(value);
}

function adicionarDias(date, days) {
  const result = new Date(date + 'T00:00:00Z');
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function dataCadastro(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // SQLite CURRENT_TIMESTAMP is UTC even when it has no timezone suffix.
  const timestamp = String(value).replace(' ', 'T');
  const instant = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : timestamp + 'Z');
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

// The first new due date may extend a previous period, never shorten it.
function alinharVencimento(base, dia) {
  const [year, month] = base.split('-').map(Number);
  const day = Math.min(validarDia(dia), new Date(Date.UTC(year, month, 0)).getUTCDate());
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return candidate >= base ? candidate : dates.calcularProximaDataVencimento(base, dia, 'mensal');
}

function fimPeriodo(fatura, dia) {
  return fatura.periodo_fim || dates.calcularProximaDataVencimento(
    fatura.data_vencimento, dia, fatura.ciclo || 'mensal');
}

async function congelarPeriodos(arena) {
  const faturas = await db.allAsync('SELECT * FROM FaturasSaaS WHERE tenant_id = ? ORDER BY data_vencimento, id', [arena.id]);
  for (const fatura of faturas) {
    if (!fatura.periodo_fim) {
      fatura.periodo_fim = fimPeriodo(fatura, arena.dia_vencimento || Number(fatura.data_vencimento.slice(8, 10)));
      await db.runAsync('UPDATE FaturasSaaS SET periodo_fim = ? WHERE id = ? AND periodo_fim IS NULL', [fatura.periodo_fim, fatura.id]);
    }
  }
  return faturas;
}

async function lerPolitica() {
  const rows = await db.allAsync("SELECT chave, valor FROM ConfiguracoesSaaS WHERE chave IN ('trial_ativo', 'dias_trial', 'dias_tolerancia_bloqueio')");
  const config = Object.fromEntries(rows.map(row => [row.chave, row.valor]));
  const inteiro = (value, fallback) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) <= 365 ? Number(value) : fallback;
  return {
    trialAtivo: config.trial_ativo === undefined || config.trial_ativo === '1',
    diasTrial: inteiro(config.dias_trial, 14),
    diasTolerancia: inteiro(config.dias_tolerancia_bloqueio, 5),
  };
}

async function configurarCadastro() {
  const politica = await lerPolitica();
  const hoje = dates.getTodayString();
  const trialExpiraEm = politica.trialAtivo && politica.diasTrial > 0 ? adicionarDias(hoje, politica.diasTrial) : null;
  return { trialExpiraEm, diaVencimento: Number((trialExpiraEm || hoje).slice(8, 10)), arenaStatus: trialExpiraEm ? 1 : 0 };
}

module.exports = { validarDia, adicionarDias, dataCadastro, alinharVencimento, fimPeriodo, congelarPeriodos, lerPolitica, configurarCadastro };
