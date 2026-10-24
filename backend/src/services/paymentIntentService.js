const db=require('../config/database');
const {ensureSecuritySchema}=require('../config/securitySchema');
const {httpError,secret}=require('../utils/security');
const {paymentError,normalizePaymentError}=require('../utils/paymentProviderError');
function cachedResponse(intent) {
  if (!intent?.response_json || intent.state !== 'pending') return null;
  let response;
  try { response = JSON.parse(intent.response_json); } catch { return null; }
  if (!response?.gateway_ref || response.error) return null;
  if (intent.method === 'Pix' && (!response.copia_cola ||
      (intent.expires_at && !(Date.parse(intent.expires_at) > Date.now())))) return null;
  return response;
}
async function withIntent(method,reservationId,value,tenantId,create) {
  await ensureSecuritySchema(db);
  // Callers pass integer centavos, matching Reservations, Pagamentos and the gateway API.
  const amount=Number(value);
  if(!Number.isSafeInteger(amount)||amount<=0) throw httpError(400,'Valor monetário inválido.');
  const selected=await db.transaction(async()=>{
    const reservation=await db.getAsync('SELECT * FROM Reservas WHERE id=? AND tenant_id=?',[reservationId,tenantId]);
    if(!reservation||['Cancelada','Cancelamento pendente'].includes(reservation.status)) throw httpError(400,'Reserva indisponível para pagamento.');
    const scope=reservation.grupo_id||'reservation:'+reservation.id;
    const existing=await db.getAsync("SELECT * FROM PaymentIntents WHERE tenant_id=? AND scope=? AND method=? AND state IN ('creating','pending','unknown')",[tenantId,scope,method]);
    if(existing) {
      if(existing.amount_cents!==amount) throw httpError(409,'Já existe uma cobrança em andamento para este pedido.');
      const cached = cachedResponse(existing);
      if(cached) return {cached};
      // Age is not proof of failure. Never POST again from a request/polling path.
      // The outbox recovers the original operation by its reference.
      throw normalizePaymentError(paymentError('PIX_RECONCILIATION_PENDING'), existing.id);
    }
    const rows=await require('./paymentLedgerService').scopeReservations(reservation);
    let balance=0;
    for(const r of rows) {
      if(['Cancelada','Cancelamento pendente'].includes(r.status)) throw httpError(409,'Pedido contém reserva cancelada.');
      const paid=await db.getAsync('SELECT COALESCE(SUM(valor),0) AS total FROM Pagamentos WHERE reserva_id=?',[r.id]);
      const totalCents=Number(r.valor_total),paidCents=Number(paid.total);
      if(!Number.isSafeInteger(totalCents)||totalCents<=0||!Number.isSafeInteger(paidCents)||paidCents<0) throw httpError(409,'Saldo da reserva inválido; é necessária uma conciliação.');
      balance+=Math.max(0,totalCents-paidCents);
    }
    if(amount>balance) throw httpError(400,'Valor acima do saldo do pedido.');
    const id=secret();
    await db.runAsync('INSERT INTO PaymentIntents(id,tenant_id,reserva_id,scope,method,amount_cents,created,updated) VALUES(?,?,?,?,?,?,?,?)',[id,tenantId,reservationId,scope,method,amount,Date.now(),Date.now()]);
    return {id};
  });
  if(selected.cached) return selected.cached;
  try {
    const response=await create(selected.id);
    const responseState = ['rejected','cancelled'].includes(response.status) ? 'failed' : 'pending';
    await db.runAsync("UPDATE PaymentIntents SET state=CASE WHEN state='paid' OR EXISTS(SELECT 1 FROM TransacoesGateway t WHERE t.gateway_ref=? AND t.status IN ('Pago','Estornado','Chargeback')) THEN 'paid' ELSE ? END,gateway_ref=?,response_json=?,updated=? WHERE id=? AND state IN ('creating','pending','unknown','paid')",[response.gateway_ref,responseState,response.gateway_ref,JSON.stringify(response),Date.now(),selected.id]);
    return response;
  } catch(error) {
    const failure = method === 'Pix' ? normalizePaymentError(error, selected.id) : error;
    const state = failure.outcome === 'definitive_rejection' ? 'failed' : 'unknown';
    await db.runAsync(`UPDATE PaymentIntents SET state=?,diagnostic_json=?,updated=?
      WHERE id=? AND state IN ('creating','unknown') AND NOT EXISTS
      (SELECT 1 FROM TransacoesGateway t WHERE t.gateway_ref=PaymentIntents.gateway_ref AND t.status IN ('Pago','Estornado','Chargeback'))`,
    [state, JSON.stringify(failure.diagnostic || {}), Date.now(), selected.id]);
    require('../utils/safeLogger').payment(failure.diagnostic);
    throw failure;
  }
}
async function getPixIntent(reservationId, tenantId) {
  await ensureSecuritySchema(db);
  const reservation = await db.getAsync('SELECT * FROM Reservas WHERE id=? AND tenant_id=?', [reservationId, tenantId]);
  if (!reservation) throw httpError(404, 'Reserva não encontrada.');
  return db.getAsync(`SELECT * FROM PaymentIntents WHERE tenant_id=? AND scope=? AND method='Pix'
    ORDER BY created DESC,rowid DESC LIMIT 1`, [tenantId, reservation.grupo_id || 'reservation:' + reservation.id]);
}
async function consultPix(reservationId, tenantId) {
  const intent = await getPixIntent(reservationId, tenantId);
  if (!intent || !['creating','pending','unknown'].includes(intent.state)) return intent;
  // Static QR codes have no provider transaction to consult. Known online
  // charges can be checked promptly while ambiguous creation keeps its backoff.
  if (intent.gateway_ref?.startsWith('PIX_ESTATICO_')) return intent;
  const interval = intent.gateway_ref ? 5000 : 30000;
  if (Date.now() - intent.updated < interval) return intent;
  const now = Date.now();
  const claim = await db.runAsync(`UPDATE PaymentIntents SET next_reconcile=?,last_reconciled=?,reconcile_count=reconcile_count+1
    WHERE id=? AND (next_reconcile IS NULL OR next_reconcile<=?)`, [now + interval, now, intent.id, now]);
  if (!claim.changes) return intent;
  try {
    const gateway = require('./gatewayService');
    if (!intent.gateway_ref) await gateway.reconciliarPagamentoSemReferencia(intent.id);
    else if (/^\d+$/.test(intent.gateway_ref)) {
      const context = await gateway.resolverContextoWebhookMercadoPago(intent.gateway_ref);
      if (context) await gateway.liquidarWebhookMercadoPago(intent.gateway_ref, context);
    }
  } catch (error) {
    const failure = normalizePaymentError(error, intent.id);
    await db.runAsync('UPDATE PaymentIntents SET diagnostic_json=? WHERE id=?', [JSON.stringify(failure.diagnostic), intent.id]);
    require('../utils/safeLogger').payment(failure.diagnostic);
  }
  return getPixIntent(reservationId, tenantId);
}
module.exports={withIntent,cachedResponse,getPixIntent,consultPix};
