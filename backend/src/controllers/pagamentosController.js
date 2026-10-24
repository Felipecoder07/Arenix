const logger = require('../utils/safeLogger').forModule('pagamentosController');
const db=require('../config/database');
const logAuditEvent=require('../utils/auditLogger');
const {getTodayString,getLocalTimeString}=require('../utils/dateUtils');
const {cents,httpError}=require('../utils/security');
const {recompute}=require('../services/paymentLedgerService');
const {manualMethod}=require('../services/manualPaymentService');
const safe=fn=>async(req,res)=>{try{await fn(req,res)}catch(e){res.status(e.status||500).json({error: require('../utils/security').publicError(e, 'Falha na operacao financeira.')})}};
const registrarPagamento=safe(async(req,res)=>{
 const amount=cents(req.body.valor),method=manualMethod(req.body.metodo),tenant=req.user.tenant_id,id=req.body.reserva_id;
 const result=await db.transaction(async()=>{
  const r=await db.getAsync('SELECT * FROM Reservas WHERE id=? AND tenant_id=?',[id,tenant]);
  if(!r) throw httpError(404,'Reserva nao encontrada.');
  if(r.status==='Cancelada') throw httpError(400,'Reserva cancelada.');
  const paid=await db.getAsync('SELECT COALESCE(SUM(valor),0) AS total FROM Pagamentos WHERE reserva_id=?',[id]);
  if(amount>r.valor_total-paid.total) throw httpError(400,'Valor acima do saldo devedor.');
  const inserted=await db.runAsync('INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_por) VALUES(?,?,?,?)',[id,amount,method,req.user.id]);
  return {pagamento_id:inserted.lastID,...await recompute(id)};
 });
 logAuditEvent(req.user.id,'Pagamento manual','Reserva: '+id+', valor: '+amount,req.ip);
 res.status(201).json({message:'Pagamento registrado.',pagamento_id:result.pagamento_id,saldo_devedor:result.saldoDevedor,status_pagamento:result.novoStatus});
});
const aplicarDesconto=safe(async(req,res)=>{
 const percent=Number(req.body.desconto_percentual);
 if(!['Administrador','Gerente'].includes(req.user.perfil)) throw httpError(403,'Perfil nao autorizado.');
 if(typeof req.body.desconto_percentual!=='number'||!Number.isFinite(percent)||percent<0||percent>100) throw httpError(400,'Desconto invalido.');
 if(req.user.perfil==='Gerente'&&percent>30) throw httpError(403,'Limite do gerente: 30%.');
 const result=await db.transaction(async()=>{
  const r=await db.getAsync('SELECT * FROM Reservas WHERE id=? AND tenant_id=?',[req.body.reserva_id,req.user.tenant_id]);
  if(!r) throw httpError(404,'Reserva nao encontrada.');
  const paid=await db.getAsync('SELECT COALESCE(SUM(valor),0) AS total FROM Pagamentos WHERE reserva_id=?',[r.id]);
  const total=Math.round(r.valor_total*(100-percent)/100);
  if(total<paid.total||r.status==='Cancelada') throw httpError(400,'Desconto abaixo do recebido ou reserva cancelada.');
  const open=await db.getAsync("SELECT id FROM TransacoesGateway WHERE reserva_id=? AND status='Pendente'",[r.id]);
  if(open) throw httpError(409,'Existe cobranca online pendente.');
  await db.runAsync('UPDATE Reservas SET valor_total=? WHERE id=?',[total,r.id]);
  return {novo_valor_total:total,...await recompute(r.id)};
 });
 res.json({message:'Desconto aplicado.',novo_valor_total:result.novo_valor_total,saldo_devedor:result.saldoDevedor});
});
const registrarEstorno=safe(async(req,res)=>{
 if(req.user.perfil!=='Administrador') throw httpError(403,'Perfil nao autorizado.');
 const reservation = await db.getAsync('SELECT r.id FROM Reservas r WHERE r.tenant_id=? AND r.id=COALESCE(?,(SELECT reserva_id FROM Pagamentos WHERE id=?))',[req.user.tenant_id,req.body.reserva_id,req.body.pagamento_id]);
 if(!reservation) throw httpError(404,'Pagamento nao encontrado.');
 if(req.body.pagamento_id) {
  const payment = await db.getAsync('SELECT id FROM Pagamentos WHERE id=? AND reserva_id=? AND valor>0',[req.body.pagamento_id,reservation.id]);
  if(!payment) throw httpError(404,'Pagamento nao encontrado.');
 }
 const quote = await require('../services/refundService').preview(reservation.id,req.user.tenant_id);
 if(quote.online) {
  if(typeof req.body.motivo!=='string'||!req.body.motivo.trim()||req.body.motivo.length>100) throw httpError(400,'Informe a justificativa do estorno (ate 100 caracteres).');
  if(!quote.valor_centavos) throw httpError(409,'Nao ha pagamento online confirmado com saldo para devolver.');
  if(req.body.confirmacao!==quote.confirmacao || cents(req.body.valor)!==quote.valor_centavos) throw httpError(409,'Confira novamente o valor integral do pagamento online e os horarios envolvidos.');
  const outcome = await require('../services/gatewayService').estornarPagamentoPix(reservation.id,req.user.tenant_id,{targets:quote.targets});
  if(outcome.reason==='no_gateway_token') throw httpError(409,'Reconecte a conta Mercado Pago da arena para devolver este pagamento.');
  if(outcome.reason==='balance_changed') throw httpError(409,'O saldo mudou. Atualize os dados do estorno.');
  logAuditEvent(req.user.id,outcome.success?'Estorno online confirmado':'Estorno online pendente',JSON.stringify({reserva_id:reservation.id,valor:quote.valor_centavos,motivo:req.body.motivo.trim()}),req.ip);
  return res.status(outcome.success?200:202).json({pending:!outcome.success,message:outcome.success?'Devolucao confirmada pelo Mercado Pago.':'Devolucao pendente de confirmacao do Mercado Pago. O saldo sera atualizado apos a confirmacao.'});
 }
 const result=await db.transaction(async()=>{
  const r=await db.getAsync('SELECT r.* FROM Reservas r WHERE r.tenant_id=? AND r.id=COALESCE(?,(SELECT reserva_id FROM Pagamentos WHERE id=?))',[req.user.tenant_id,req.body.reserva_id,req.body.pagamento_id]);
  if(!r) throw httpError(404,'Pagamento nao encontrado.');
  // Online refunds must use the provider and its persisted allocation; never create a manual receipt.
  const online=await db.getAsync("SELECT id FROM TransacoesGateway WHERE status NOT IN ('Estornado','Chargeback','Cancelado','Rejeitado','Expirado') AND reserva_id IN (SELECT id FROM Reservas WHERE id=? OR (grupo_id=? AND tenant_id=?))",[r.id,r.grupo_id,r.tenant_id]);
  if(online) throw httpError(409,'Pagamento online: use o cancelamento com devolucao pelo provedor.');
  const paid=await db.getAsync('SELECT COALESCE(SUM(valor),0) AS total FROM Pagamentos WHERE reserva_id=?',[r.id]);
  const amount=req.body.valor===undefined?paid.total:cents(req.body.valor);
  if(amount<=0||amount>paid.total) throw httpError(400,'Valor acima do saldo estornavel.');
  await db.runAsync('INSERT INTO Pagamentos(reserva_id,valor,metodo,registrado_por) VALUES(?,?,?,?)',[r.id,-amount,'Estorno',req.user.id]);
  return recompute(r.id);
 });
 logAuditEvent(req.user.id,'Estorno manual',JSON.stringify({reserva_id:reservation.id,motivo:typeof req.body.motivo==='string'?req.body.motivo.slice(0,100):''}),req.ip);
 res.json({message:'Estorno manual registrado.',saldo_devedor:result.saldoDevedor,status_pagamento:result.novoStatus});
});

const { summary, paymentDate, balanceSql, overdueSql } = require('../services/paymentSummaryService');
const resumoPagamentos = safe(async (req, res) => {
  res.json(await summary(req.user.tenant_id, paymentDate(req.query.data)));
});

// ─── LISTAGEM DE RESERVAS COM PAGAMENTOS ─────────────────────────────────────
const listarReservasPagamentos = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { status, busca } = req.query;
    const data = paymentDate(req.query.data);

    let where = `r.tenant_id = ? AND r.status != 'Cancelada'`;
    const params = [tenant_id];

    if (status === 'Pendente') {
      where += ` AND (${balanceSql}) > 0`;
    } else if (status === 'Pago') {
      where += ` AND (${balanceSql}) <= 0`;
    } else if (status === 'inadimplentes') {
      where += ` AND (${balanceSql}) > 0 AND ${overdueSql}`;
      const arena = await db.getAsync('SELECT fuso_horario FROM Arenas WHERE id=?', [req.user.tenant_id]);
      const zone = arena?.fuso_horario || 'America/Sao_Paulo';
      params.push(getTodayString(zone), getTodayString(zone), getLocalTimeString(zone));
    }

    if (data) {
      where += ` AND r.data_reserva = ?`;
      params.push(data);
    }

    if (busca) {
      where += ` AND (c.nome LIKE ? OR CAST(r.id AS TEXT) LIKE ?)`;
      params.push(`%${busca}%`, `%${busca}%`);
    }

    const reservas = await db.allAsync(`
      SELECT
        r.id, r.data_reserva, r.hora_inicio, r.hora_fim,
        r.valor_total, r.status, r.status_pagamento,
        c.nome AS cliente_nome, c.telefone AS cliente_telefone,
        q.nome AS quadra_nome,
        COALESCE((SELECT SUM(valor) FROM Pagamentos WHERE reserva_id = r.id), 0) AS total_pago,
        COALESCE((SELECT GROUP_CONCAT(DISTINCT metodo) FROM Pagamentos WHERE reserva_id = r.id AND metodo != 'Estorno'), '') AS metodos
      FROM Reservas r
      JOIN Clientes c ON r.cliente_id = c.id
      JOIN Quadras q ON r.quadra_id = q.id
      WHERE ${where}
      ORDER BY r.data_reserva DESC, r.hora_inicio DESC
    `, params);

    const comSaldo = reservas.map(r => ({
      ...r,
      status_pagamento: r.status === 'Cancelamento pendente' ? r.status_pagamento :
        r.total_pago >= r.valor_total ? 'Pago' : r.total_pago > 0 ? 'Parcial' : 'Pendente',
      saldo_devedor: r.status === 'Cancelamento pendente' ? 0 : Math.max(0, r.valor_total - r.total_pago)
    }));

    res.json(comSaldo);
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ error: error.status === 400 ? error.message : 'Erro ao listar reservas para pagamentos.' });
  }
};

module.exports = { registrarPagamento, aplicarDesconto, registrarEstorno, resumoPagamentos, listarReservasPagamentos };
