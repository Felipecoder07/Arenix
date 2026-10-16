const db = require('../config/database');
const { getTodayString } = require('../utils/dateUtils');
const { httpError, cents } = require('../utils/security');

// Called inside the same transaction that records payment.
async function aplicarPagamento(fatura) {
  const arena = await db.getAsync('SELECT * FROM Arenas WHERE id = ?', [fatura.tenant_id]);
  let planoAtualizado = false;
  if (arena.status !== -1 && Number(arena.fatura_plano_pendente_id) === fatura.id) {
    const inicio = getTodayString();
    const dia = Number(inicio.slice(8, 10));
    const fim = require('../utils/dateUtils').calcularProximaDataVencimento(inicio, dia, fatura.ciclo || 'mensal');
    // The full new cycle starts when payment is confirmed, even after Pix renewal.
    await db.runAsync('UPDATE FaturasSaaS SET data_vencimento = ?, periodo_fim = ? WHERE id = ?',
      [inicio, fim, fatura.id]);
    await db.runAsync(`UPDATE Arenas SET plano_id = ?, ciclo_cobranca = ?,
      dia_vencimento = ?, trial_expira_em = NULL, fatura_plano_pendente_id = NULL WHERE id = ?`,
    [fatura.plano_id, fatura.ciclo || 'mensal', dia, arena.id]);
    planoAtualizado = true;
  }
  const pendencia = await db.getAsync(`SELECT id FROM FaturasSaaS WHERE tenant_id = ?
    AND status IN ('Pendente', 'Atrasada')
    AND (data_vencimento < ? OR status = 'Atrasada') LIMIT 1`, [arena.id, getTodayString()]);
  const desbloquear = arena.status === 0 && !pendencia &&
    ['inadimplencia', 'cadastro', 'estorno'].includes(arena.motivo_bloqueio);
  if (desbloquear) {
    await db.runAsync('UPDATE Arenas SET status = 1, motivo_bloqueio = NULL WHERE id = ?', [arena.id]);
  }
  return { arena_desbloqueada: desbloquear, plano_atualizado: planoAtualizado };
}

async function registrarPagamentoManual(id, usuarioId) {
  return db.transaction(async () => {
    const fatura = await db.getAsync('SELECT * FROM FaturasSaaS WHERE id = ?', [id]);
    if (!fatura) throw httpError(404, 'Fatura não encontrada.');
    if (fatura.status === 'Paga') throw httpError(400, 'Fatura já está paga.');
    if (!['Pendente', 'Atrasada'].includes(fatura.status)) throw httpError(409, 'Fatura indisponível para pagamento.');
    await db.runAsync(`UPDATE FaturasSaaS SET status = 'Paga', data_pagamento = ?,
      registrado_por = ?, metodo_pagamento = 'Manual' WHERE id = ?`, [getTodayString(), usuarioId, id]);
    return aplicarPagamento(fatura);
  });
}

async function registrarEstorno(gatewayRef, payment) {
  const token = await require('./saasBillingService').getMasterAccessToken();
  if (!token || String(payment.collector_id) !== await require('./saasPixService').masterReceiver(token)) {
    throw httpError(400, 'Recebedor divergente do estorno.');
  }
  return db.transaction(async () => {
    const fatura = await db.getAsync('SELECT * FROM FaturasSaaS WHERE gateway_ref = ?', [gatewayRef]);
    if (!fatura) return;
    if (String(payment.id) !== String(gatewayRef) || payment.currency_id !== 'BRL' ||
        cents(payment.transaction_amount) !== Number(fatura.valor) ||
        !['refunded', 'charged_back'].includes(payment.status)) {
      throw httpError(400, 'Estorno divergente da fatura.');
    }
    // Keep the reversal attached to this payment after manual regularization.
    // Replayed notifications must neither reopen the debt nor undo a new payment.
    if (String(fatura.gateway_estornado_ref) === String(gatewayRef)) return;
    await db.runAsync("UPDATE FaturasSaaS SET status = 'Atrasada', data_pagamento = NULL, gateway_estornado_ref = ? WHERE id = ?", [String(gatewayRef), fatura.id]);
    // Preserve a manual/unknown block and never resurrect a deleted arena.
    await db.runAsync(`UPDATE Arenas SET status = 0, motivo_bloqueio = 'estorno'
      WHERE id = ? AND (status = 1 OR (status = 0 AND motivo_bloqueio IN ('cadastro', 'inadimplencia', 'estorno')))`, [fatura.tenant_id]);
  });
}

module.exports = { aplicarPagamento, registrarPagamentoManual, registrarEstorno };
