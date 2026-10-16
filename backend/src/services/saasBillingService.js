const logger = require('../utils/safeLogger').forModule('saasBillingService');
const {fetch} = require('../utils/providerHttp');
const { decrypt, simulationAllowed, cents, httpError } = require('../utils/security');
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

const crypto = require("node:crypto");
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { gerarPixEMV } = require('../utils/pixPayload');
const { sendEmail } = require('./emailService');

function faturaValorCentavos(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw httpError(409, 'Valor da fatura inválido.');
  }
  return amount;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OBTER ACCESS TOKEN DO MASTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o access_token pessoal da conta Mercado Pago do SaaS Master.
 * Este token é usado EXCLUSIVAMENTE para gerar cobranças de mensalidades.
 * É diferente do mp_client_id/secret (usados para OAuth dos tenants).
 * @returns {Promise<string|null>}
 */
const getMasterAccessToken = () => require('./credentialService').readCredential('mp_master_access_token');

// ─────────────────────────────────────────────────────────────────────────────
// 2. GERAR PIX DE FATURA DE MENSALIDADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera (ou reutiliza se ainda válido) o QR Code Pix para pagamento de uma fatura de mensalidade.
 * - Se já existe um Pix não expirado para esta fatura → reutiliza.
 * - Se não existe ou está expirado → gera um novo via API do Mercado Pago (ou fallback EMV em dev).
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
  if (!['Pendente', 'Atrasada'].includes(fatura.status)) throw httpError(409, 'Fatura indisponível para pagamento.');
  if (fatura.gateway_ref && fatura.gateway_estornado_ref === fatura.gateway_ref) {
    throw httpError(409, 'Este Pix foi estornado. Solicite a regularização da fatura ao suporte.');
  }
  const valorCentavos = faturaValorCentavos(fatura.valor);
  const valorReais = valorCentavos / 100;

  // Online QR reuse must honor the recorded attempt, amount and receiving account.
  const token = await getMasterAccessToken();
  if (token) return require('./saasPixService').issue(fatura, token);
  if (!simulationAllowed()) throw require('../utils/paymentProviderError').paymentError('PIX_PROVIDER_REJECTED');
  if (fatura.gateway_ref && !String(fatura.gateway_ref).startsWith('SIM_SAAS_')) {
    throw require('../utils/paymentProviderError').paymentError('PIX_RECONCILIATION_PENDING');
  }

  // 2. Reutilizar Pix existente se ainda válido (não expirado)
  if (fatura.gateway_ref && fatura.qr_expira_em) {
    const agora = new Date();
    const expiracao = new Date(fatura.qr_expira_em);
    if (agora < expiracao) {
      const fallbackQr = fatura.copia_cola 
        ? await require('qrcode').toDataURL(fatura.copia_cola) 
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

  // 3. Obter Access Token do Master
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const expiraEmISO = expiraEm.toISOString();

  // Se estiver em ambiente de teste ou não há token do MP configurado ou o token não é válido, usa gerador de Pix EMV local (Dev/Sandbox/Test)
  if (simulationAllowed() && !token) {
    const copiaCola = gerarPixEMV({
      chave: 'financeiro@arenix.com.br',
      nome: 'Arenix SaaS Master',
      cidade: 'SAO PAULO',
      valor: valorReais,
      txid: `SAAS${fatura.id}`
    }) || `00020101021226580014BR.GOV.BCB.PIX0114financeiro@arenix520400005303986540${valorReais.toFixed(2)}5802BR5916Arenix SaaS6009SAO PAULO62070503***6304`;

    const gatewayRef = fatura.gateway_ref || `SIM_SAAS_FATURA_${fatura.id}_${Date.now()}`;
    const qrCodeUrl = await require('qrcode').toDataURL(copiaCola);

    await db.runAsync(`
      UPDATE FaturasSaaS
      SET gateway_ref     = ?,
          copia_cola      = ?,
          qr_expira_em    = ?,
          metodo_pagamento = 'Pix Online'
      WHERE id = ?
    `, [gatewayRef, copiaCola, expiraEmISO, faturaId]);

    logAuditEvent(0, 'SaaS Billing: Pix Gerado (Dev/EMV)',
      `Pix de R$${valorReais.toFixed(2)} gerado para Fatura #${faturaId} (Arena: ${fatura.arena_nome})`, '127.0.0.1');

    return {
      qr_code: qrCodeUrl,
      copia_cola: copiaCola,
      gateway_ref: gatewayRef,
      expira_em: expiraEmISO,
      reutilizado: false,
    };
  }

  if (!token) throw require('../utils/paymentProviderError').paymentError('PIX_PROVIDER_REJECTED');
  return require('./saasPixService').issue(fatura, token);
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
const liquidarFaturaSaaS = async (gatewayRef, payment) => db.transaction(async () => {
  const fatura = await db.getAsync(`
    SELECT f.*, a.status as arena_status, a.nome as arena_nome
    FROM FaturasSaaS f
    JOIN Arenas a ON f.tenant_id = a.id
    WHERE f.gateway_ref = ?
  `, [gatewayRef]);

  if (!fatura) {
    const safeRef = String(gatewayRef || '').replace(/[\r\n]/g, '');
    logger.warn(`[SaaS Billing] Webhook recebido para gateway_ref desconhecido: ${safeRef}`);
    return { sucesso: false, mensagem: `Fatura com gateway_ref ${safeRef} não encontrada.` };
  }

  // A delayed approval cannot undo a reversal of this same provider payment.
  if (String(fatura.gateway_estornado_ref) === String(gatewayRef)) {
    throw httpError(409, 'Este pagamento já foi estornado. Reconcilie a fatura antes de regularizá-la.');
  }

  // IDEMPOTÊNCIA: já processado → não faz nada
  if (fatura.status === 'Paga') {
    logger.log(`[SaaS Billing] Fatura #${fatura.id} já estava paga. Webhook ignorado (idempotente).`);
    return { sucesso: true, mensagem: 'Fatura já estava paga.', fatura_id: fatura.id, arena_desbloqueada: false };
  }

  const valorCentavos = faturaValorCentavos(fatura.valor);
  if (!payment && !simulationAllowed()) throw httpError(403,'Confirmacao do provedor obrigatoria.');
  if(payment && (String(payment.id)!==String(gatewayRef) || payment.status!=='approved' || payment.currency_id!=='BRL' || cents(payment.transaction_amount)!==valorCentavos)) throw httpError(400,'Pagamento divergente da fatura.');
  if (payment) {
    const token = await getMasterAccessToken();
    if (!token || String(payment.collector_id) !== await require('./saasPixService').masterReceiver(token)) {
      throw httpError(400, 'Recebedor divergente da fatura.');
    }
  }
  const hoje = require('../utils/dateUtils').getTodayString();

  // Marcar fatura como Paga
  await db.runAsync(`
    UPDATE FaturasSaaS
    SET status = 'Paga', data_pagamento = ?
    WHERE id = ?
  `, [hoje, fatura.id]);

  const { arena_desbloqueada: arenaDesbloqueada, plano_atualizado: planoAtualizado } =
    await require('./saasSettlementService').aplicarPagamento(fatura);
  const novoCiclo = fatura.ciclo || 'mensal';

  logAuditEvent(0, 'SaaS Billing: Fatura Liquidada',
    `Fatura #${fatura.id} paga via Pix Online (ref: ${gatewayRef}). Arena ${arenaDesbloqueada ? 'REATIVADA' : 'já ativa'}.${planoAtualizado ? ` Plano atualizado para ID ${fatura.plano_id} (${novoCiclo}).` : ''}`,
    '127.0.0.1');

  return {
    sucesso: true,
    mensagem: arenaDesbloqueada
      ? `Fatura #${fatura.id} paga. Arena '${fatura.arena_nome}' reativada com sucesso.`
      : `Fatura #${fatura.id} paga com sucesso.`,
    fatura_id: fatura.id,
    arena_desbloqueada: arenaDesbloqueada,
    plano_atualizado: planoAtualizado,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENVIAR AVISOS DE VENCIMENTO (CRON DIÁRIO)
// ─────────────────────────────────────────────────────────────────────────────

const formatarDataBR = (dataStr) => {
  if (!dataStr) return '-';
  const parts = dataStr.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dataStr;
};

const gerarHtmlAvisoVencimento = (fatura) => {
  const dataFormatada = formatarDataBR(fatura.data_vencimento);
  const valorFormatado = (faturaValorCentavos(fatura.valor) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Arenix CourtManager</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Gestão Inteligente de Arenas Esportivas</p>
      </div>
      <div style="padding: 32px 24px;">
        <div style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px;">
          ⚠️ AVISO DE VENCIMENTO PRÓXIMO
        </div>
        <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">Olá, ${fatura.arena_nome || 'Gestor'}!</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Informamos que a fatura de mensalidade da sua arena está próxima do vencimento. Mantenha seus pagamentos em dia para garantir a continuidade dos serviços e o agendamento de quadras sem interrupções.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #64748b; padding-bottom: 8px;">Fatura:</td>
              <td style="text-align: right; color: #0f172a; font-weight: 600; padding-bottom: 8px;">#${fatura.id}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding-bottom: 8px;">Valor:</td>
              <td style="text-align: right; color: #16a34a; font-weight: 700; font-size: 16px; padding-bottom: 8px;">R$ ${valorFormatado}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Data de Vencimento:</td>
              <td style="text-align: right; color: #dc2626; font-weight: 700;">${dataFormatada}</td>
            </tr>
          </table>
        </div>

        <p style="color: #475569; font-size: 13.5px; line-height: 1.5; margin: 0 0 24px 0;">
          Você pode pagar instantaneamente via <strong>Pix</strong> diretamente no painel administrativo da arena com liberação automática em segundos.
        </p>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="https://app.arenix.com.br" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
            Acessar Painel & Pagar com Pix
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; line-height: 1.4; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Caso o pagamento já tenha sido efetuado, por favor desconsidere esta mensagem.
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Arenix SaaS. Todos os direitos reservados.</p>
      </div>
    </div>
  `;
};

/**
 * Busca arenas com faturas vencendo nos próximos 3 dias, envia e-mails e registra logs de auditoria.
 * @returns {Promise<{avisadas: number}>}
 */
const enviarAvisosVencimento = async () => {
  try {
    const faturasProximas = await db.allAsync(`
      SELECT f.id, f.valor, f.data_vencimento, a.nome as arena_nome,
             COALESCE(a.email, (SELECT email FROM Usuarios WHERE tenant_id = a.id AND perfil = 'Administrador' AND ativo = 1 LIMIT 1)) as arena_email
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.status IN ('Pendente', 'Atrasada')
        AND date(f.data_vencimento) >= date(?)
        AND date(f.data_vencimento) <= date(?, '+3 days')
    `, [require('../utils/dateUtils').getTodayString(), require('../utils/dateUtils').getTodayString()]);

    let enviadosCount = 0;

    for (const fatura of faturasProximas) {
      logger.log(
        `[SaaS Billing] AVISO: Fatura #${fatura.id} de R$${(faturaValorCentavos(fatura.valor) / 100).toFixed(2)} ` +
        `para '${fatura.arena_nome}' vence em ${fatura.data_vencimento}. E-mail: ${fatura.arena_email || 'Nenhum'}`
      );

      if (fatura.arena_email) {
        const assunto = `⚠️ Aviso de Vencimento: Fatura #${fatura.id} vence em ${formatarDataBR(fatura.data_vencimento)} — Arenix`;
        const html = gerarHtmlAvisoVencimento(fatura);
        const enviado = await sendEmail(fatura.arena_email, assunto, html);
        if (enviado) {
          enviadosCount++;
        }
      }

      logAuditEvent(
        0,
        'SaaS Billing: Aviso de Vencimento',
        `Aviso enviado para Arena '${fatura.arena_nome}' (E-mail: ${fatura.arena_email || 'Não informado'}) — Fatura #${fatura.id} vence em ${fatura.data_vencimento}`,
        '127.0.0.1'
      );
    }

    return { avisadas: faturasProximas.length, enviados: enviadosCount };
  } catch (err) {
    logger.error('[SaaS Billing] Erro ao enviar avisos de vencimento:', err);
    return { avisadas: 0, enviados: 0 };
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
