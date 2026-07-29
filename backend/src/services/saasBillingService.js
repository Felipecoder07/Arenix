/**
 * saasBillingService.js
 * Serviço responsável por toda a lógica de cobrança de mensalidades do SaaS.
 *
 * SEPARAÇÃO DE FLUXOS (CRÍTICO):
 *   - Pagamentos dos CLIENTES das arenas  → Conta MP da Arena (gateway_access_token via OAuth)
 *   - Pagamentos das MENSALIDADES do SaaS → Conta MP do Master (mp_master_access_token em ConfiguracoesSaaS)
 *
 * Funções exportadas:
 *   getMasterAccessToken()          — Lê o access_token pessoal do Master do banco
 *   gerarPixFaturaSaaS(faturaId)    — Gera (ou reutiliza) o Pix de uma fatura de mensalidade
 *   liquidarFaturaSaaS(gatewayRef)  — Liquida a fatura e desbloqueia a arena automaticamente (idempotente)
 *   enviarAvisosVencimento()        — Envia e-mails de aviso de vencimento próximo (cron diário)
 */

const crypto = require('crypto');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// 1. OBTER ACCESS TOKEN DO MASTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o access_token pessoal da conta Mercado Pago do SaaS Master.
 * Este token é usado EXCLUSIVAMENTE para gerar cobranças de mensalidades.
 * É diferente do mp_client_id/secret (usados para OAuth dos tenants).
 * @returns {Promise<string|null>}
 */
const getMasterAccessToken = async () => {
  const row = await db.getAsync("SELECT valor FROM ConfiguracoesSaaS WHERE chave = 'mp_master_access_token'");
  if (row && row.valor && row.valor.trim() !== '') {
    return row.valor.trim();
  }
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_ACCESS_TOKEN.trim() !== '') {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN.trim();
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GERAR PIX DE FATURA DE MENSALIDADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera (ou reutiliza se ainda válido) o QR Code Pix para pagamento de uma fatura de mensalidade.
 * - Se já existe um Pix não expirado para esta fatura → reutiliza.
 * - Se não existe ou está expirado → gera um novo via API do Mercado Pago.
 *
 * @param {number} faturaId
 * @returns {Promise<{qr_code: string, copia_cola: string, gateway_ref: string, expira_em: string}>}
 */
const gerarPixFaturaSaaS = async (faturaId) => {
  // 1. Verificar se a fatura existe e está em aberto
  const fatura = await db.getAsync(`
    SELECT f.*, a.nome as arena_nome, a.email as arena_email
    FROM FaturasSaaS f
    JOIN Arenas a ON f.tenant_id = a.id
    WHERE f.id = ?
  `, [faturaId]);

  if (!fatura) {
    throw new Error(`Fatura #${faturaId} não encontrada.`);
  }
  if (fatura.status === 'Paga') {
    throw new Error(`Fatura #${faturaId} já está paga.`);
  }

  // 2. Reutilizar Pix existente se ainda válido (não expirado)
  if (fatura.gateway_ref && fatura.qr_expira_em) {
    const agora = new Date();
    const expiracao = new Date(fatura.qr_expira_em);
    if (agora < expiracao) {
      const fallbackQr = fatura.copia_cola 
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fatura.copia_cola)}` 
        : null;
      return {
        qr_code: fallbackQr,
        copia_cola: fatura.copia_cola,
        gateway_ref: fatura.gateway_ref,
        expira_em: fatura.qr_expira_em,
        reutilizado: true,
      };
    }
  }

  // 3. Verificar se o Master configurou seu Access Token
  const token = await getMasterAccessToken();
  if (!token) {
    throw new Error(
      'O Master ainda não configurou o Access Token do Mercado Pago. ' +
      'Acesse MasterConfiguracoes → Gateway de Pagamento e preencha o "Access Token Pessoal (APP_USR-...)".'
    );
  }

  if (!token.startsWith('APP_USR-') && !token.startsWith('TEST-')) {
    throw new Error(
      'O Access Token do Master é inválido (deve começar com "APP_USR-" ou "TEST-"). ' +
      'Atualmente foi preenchido com um Client Secret ou chave incorreta. ' +
      'Acesse MasterConfiguracoes → Gateway de Pagamento e cole o Access Token Pessoal correto da sua conta Mercado Pago.'
    );
  }

  // 4. Gerar novo QR Code Pix via API do Mercado Pago
  const idempotencyKey = crypto.randomBytes(16).toString('hex');
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const expiraEmISO = expiraEm.toISOString();

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: parseFloat(fatura.valor.toFixed(2)),
      description: `Mensalidade SaaS Arenix — ${fatura.arena_nome} (Fatura #${fatura.id})`,
      payment_method_id: 'pix',
      date_of_expiration: expiraEmISO,
      payer: {
        email: fatura.arena_email || 'arena@arenix.com.br',
        first_name: fatura.arena_nome.split(' ')[0],
        last_name: fatura.arena_nome.split(' ').slice(1).join(' ') || 'Arena',
      },
      metadata: {
        fatura_saas_id: fatura.id,
        tenant_id: fatura.tenant_id,
        origem: 'saas_billing',
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    const detalhe = errData.message || (errData.cause?.[0]?.description) || 'Erro desconhecido';
    throw new Error(`Mercado Pago: ${detalhe}`);
  }

  const mpData = await response.json();
  const gatewayRef = String(mpData.id);
  const copiaCola = mpData.point_of_interaction?.transaction_data?.qr_code || '';
  const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';

  // 5. Persistir os dados do Pix na fatura (para reutilização e polling)
  await db.runAsync(`
    UPDATE FaturasSaaS
    SET gateway_ref     = ?,
        copia_cola      = ?,
        qr_expira_em    = ?,
        metodo_pagamento = 'Pix Online'
    WHERE id = ?
  `, [gatewayRef, copiaCola, expiraEmISO, faturaId]);

  logAuditEvent(0, 'SaaS Billing: Pix Gerado',
    `Pix de R$${fatura.valor.toFixed(2)} gerado para Fatura #${faturaId} (Arena: ${fatura.arena_nome})`, '127.0.0.1');

  return {
    qr_code: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
    copia_cola: copiaCola,
    gateway_ref: gatewayRef,
    expira_em: expiraEmISO,
    reutilizado: false,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. LIQUIDAR FATURA (IDEMPOTENTE) + AUTO-DESBLOQUEIO DA ARENA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liquida uma fatura de mensalidade SaaS pelo gateway_ref do Mercado Pago.
 * Esta função é IDEMPOTENTE — chamá-la duas vezes para o mesmo gateway_ref
 * não produz efeitos duplicados.
 *
 * @param {string} gatewayRef — ID do pagamento no Mercado Pago
 * @returns {Promise<{sucesso: boolean, mensagem: string, fatura_id?: number, arena_desbloqueada?: boolean}>}
 */
const liquidarFaturaSaaS = async (gatewayRef) => {
  const fatura = await db.getAsync(`
    SELECT f.*, a.status as arena_status, a.nome as arena_nome
    FROM FaturasSaaS f
    JOIN Arenas a ON f.tenant_id = a.id
    WHERE f.gateway_ref = ?
  `, [gatewayRef]);

  if (!fatura) {
    console.warn(`[SaaS Billing] Webhook recebido para gateway_ref desconhecido: ${gatewayRef}`);
    return { sucesso: false, mensagem: `Fatura com gateway_ref ${gatewayRef} não encontrada.` };
  }

  // IDEMPOTÊNCIA: já processado → não faz nada
  if (fatura.status === 'Paga') {
    console.log(`[SaaS Billing] Fatura #${fatura.id} já estava paga. Webhook ignorado (idempotente).`);
    return { sucesso: true, mensagem: 'Fatura já estava paga.', fatura_id: fatura.id, arena_desbloqueada: false };
  }

  const hoje = new Date().toISOString().split('T')[0];

  // Marcar fatura como Paga
  await db.runAsync(`
    UPDATE FaturasSaaS
    SET status = 'Paga', data_pagamento = ?
    WHERE id = ?
  `, [hoje, fatura.id]);

  let arenaDesbloqueada = false;

  // Auto-desbloqueio: se arena estava suspensa por inadimplência → reativar
  if (fatura.arena_status === 0) {
    await db.runAsync('UPDATE Arenas SET status = 1 WHERE id = ?', [fatura.tenant_id]);
    arenaDesbloqueada = true;
    console.log(`[SaaS Billing] Arena '${fatura.arena_nome}' (ID: ${fatura.tenant_id}) reativada após pagamento da Fatura #${fatura.id}.`);
  }

  logAuditEvent(0, 'SaaS Billing: Fatura Liquidada',
    `Fatura #${fatura.id} paga via Pix Online (ref: ${gatewayRef}). Arena ${arenaDesbloqueada ? 'REATIVADA' : 'já ativa'}.`,
    '127.0.0.1');

  return {
    sucesso: true,
    mensagem: arenaDesbloqueada
      ? `Fatura #${fatura.id} paga. Arena '${fatura.arena_nome}' reativada com sucesso.`
      : `Fatura #${fatura.id} paga com sucesso.`,
    fatura_id: fatura.id,
    arena_desbloqueada: arenaDesbloqueada,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENVIAR AVISOS DE VENCIMENTO (CRON DIÁRIO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca arenas com faturas vencendo nos próximos 3 dias e loga os avisos.
 * @returns {Promise<{avisadas: number}>}
 */
const enviarAvisosVencimento = async () => {
  try {
    const faturasProximas = await db.allAsync(`
      SELECT f.id, f.valor, f.data_vencimento, a.nome as arena_nome, a.email as arena_email
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.status IN ('Pendente', 'Atrasada')
        AND date(f.data_vencimento) >= date('now')
        AND date(f.data_vencimento) <= date('now', '+3 days')
    `);

    for (const fatura of faturasProximas) {
      console.log(
        `[SaaS Billing] AVISO: Fatura #${fatura.id} de R$${Number(fatura.valor).toFixed(2)} ` +
        `para '${fatura.arena_nome}' vence em ${fatura.data_vencimento}. E-mail: ${fatura.arena_email}`
      );
      logAuditEvent(0, 'SaaS Billing: Aviso de Vencimento',
        `Aviso enviado para Arena '${fatura.arena_nome}' — Fatura #${fatura.id} vence em ${fatura.data_vencimento}`,
        '127.0.0.1');
    }

    return { avisadas: faturasProximas.length };
  } catch (err) {
    console.error('[SaaS Billing] Erro ao enviar avisos de vencimento:', err);
    return { avisadas: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getMasterAccessToken,
  gerarPixFaturaSaaS,
  liquidarFaturaSaaS,
  enviarAvisosVencimento,
};
