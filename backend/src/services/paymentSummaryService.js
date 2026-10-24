const db = require('../config/database');
const { getTodayString, getLocalTimeString } = require('../utils/dateUtils');
const { httpError } = require('../utils/security');

function paymentDate(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw httpError(400, 'Data invalida. Use AAAA-MM-DD.');
  }
  return value;
}

// SQLite stores payment timestamps in UTC. Convert local calendar boundaries
// using the configured business timezone, independently of the server timezone.
function midnightUtc(date, timeZone) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    instant += target - local;
  }
  return new Date(instant).toISOString();
}

function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

// A cancellation awaiting a refund is an amount to return, not a customer debt.
const balanceSql = `CASE WHEN r.status IN ('Cancelada','Cancelamento pendente') THEN 0
  ELSE r.valor_total - COALESCE((SELECT SUM(p.valor) FROM Pagamentos p WHERE p.reserva_id=r.id),0) END`;
const overdueSql = `(r.data_reserva < ? OR (r.data_reserva = ? AND r.hora_fim <= ?))`;

async function summary(tenant, filter) {
  const arena = await db.getAsync('SELECT fuso_horario FROM Arenas WHERE id=?', [tenant]);
  const zone = arena?.fuso_horario || 'America/Sao_Paulo';
  const today = getTodayString(zone);
  const time = getLocalTimeString(zone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  async function receipts(start, end) {
    // A cancellation does not erase cash movements: only an actual refund does.
    return db.getAsync(`SELECT COALESCE(SUM(p.valor),0) total,
      COUNT(CASE WHEN p.valor>0 THEN 1 END) qtd FROM Pagamentos p
      JOIN Reservas r ON r.id=p.reserva_id WHERE r.tenant_id=?
      AND julianday(p.registrado_em)>=julianday(?) AND julianday(p.registrado_em)<julianday(?)`,
    [tenant, midnightUtc(start, zone), midnightUtc(end, zone)]);
  }
  async function bookings(date) {
    const rows = await db.allAsync(`SELECT r.data_reserva,r.hora_fim,r.valor_total,
      MAX(0,${balanceSql}) saldo FROM Reservas r WHERE r.tenant_id=? AND r.status!='Cancelada'
      ${date ? 'AND r.data_reserva=?' : ''}`, date ? [tenant, date] : [tenant]);
    const pending = rows.filter(r => r.saldo > 0);
    const overdue = pending.filter(r => r.data_reserva < today || (r.data_reserva === today && r.hora_fim <= time));
    return {
      pendente: pending.reduce((sum, r) => sum + r.saldo, 0),
      inadimplencia: overdue.reduce((sum, r) => sum + r.saldo, 0),
      faturamento: rows.reduce((sum, r) => sum + r.valor_total, 0),
      counts: { pendentes: pending.length, pagos: rows.length - pending.length, todos: rows.length, inadimplentes: overdue.length }
    };
  }
  const receivedToday = await receipts(today, nextDay(today));
  const receivedMonth = await receipts(monthStart, nextMonth);
  const global = await bookings();
  const daily = await bookings(today);
  let filtered = null;
  let counts = global.counts;
  if (filter) {
    const received = await receipts(filter, nextDay(filter));
    const selected = await bookings(filter);
    counts = selected.counts;
    filtered = { data: filter, recebido: received.total, qtdPagamentos: received.qtd,
      pendente: selected.pendente, qtdPendente: counts.pendentes,
      faturamentoTotal: selected.faturamento, totalReservas: counts.todos, qtdInadimplentes: counts.inadimplentes };
  }
  return { recebidoHoje: receivedToday.total, qtdPagamentosHoje: receivedToday.qtd,
    pendenteHoje: daily.pendente, qtdPendenteHoje: daily.counts.pendentes,
    recebidoMes: receivedMonth.total, totalInadimplencia: global.inadimplencia,
    qtdInadimplentes: global.counts.inadimplentes, dataFiltro: filter,
    resumoFiltrado: filtered, counts, countsGlobais: global.counts };
}

module.exports = { summary, paymentDate, balanceSql, overdueSql };
