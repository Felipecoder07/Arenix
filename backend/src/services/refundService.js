const db = require('../config/database');
const { hash, httpError } = require('../utils/security');

async function preview(reservaId, tenantId) {
  await require('../config/securitySchema').ensureSecuritySchema(db);
  const reservation = await db.getAsync('SELECT * FROM Reservas WHERE id=? AND tenant_id=?', [reservaId, tenantId]);
  if (!reservation) throw httpError(404, 'Reserva nao encontrada.');
  const members = await require('./paymentLedgerService').scopeReservations(reservation);
  const transactions = await db.allAsync(`SELECT t.gateway_ref, t.status, c.amount_cents,
    COALESCE(f.amount_cents,0) AS refunded
    FROM TransacoesGateway t JOIN Reservas r ON r.id=t.reserva_id
    LEFT JOIN GatewayCredits c ON c.gateway_ref=t.gateway_ref
    LEFT JOIN RefundIntents f ON f.id='provider:' || t.gateway_ref
    WHERE r.tenant_id=? AND (r.id=? OR (? IS NOT NULL AND r.grupo_id=?))
    ORDER BY t.gateway_ref`, [tenantId, reservation.id, reservation.grupo_id || null, reservation.grupo_id || null]);
  const paid = transactions.filter(tx => ['Pago', 'Aprovado'].includes(tx.status));
  if (paid.some(tx => !tx.amount_cents)) throw httpError(409, 'Pagamento online legado: concilie o recebimento antes de devolver.');
  const targets = paid.map(tx => ({ gateway_ref: tx.gateway_ref, amount: tx.amount_cents - tx.refunded, total: tx.amount_cents }))
    .filter(tx => tx.amount > 0);
  const amount = targets.reduce((sum, tx) => sum + tx.amount, 0);
  const balance = await db.getAsync('SELECT COALESCE(SUM(valor),0) AS paid FROM Pagamentos WHERE reserva_id=?', [reservation.id]);
  const open = await require('./bookingCancellationService').hasInFlight(reservation);
  const manualOnly = amount === 0 && !open && balance.paid > 0;
  return {
    online: transactions.length > 0 && !manualOnly,
    valor_centavos: amount,
    reservas: members.map(row => ({ id: row.id, data: row.data_reserva, inicio: row.hora_inicio, fim: row.hora_fim })),
    confirmacao: hash(JSON.stringify([tenantId, members.map(row => row.id), targets])),
    targets,
  };
}

module.exports = { preview };
