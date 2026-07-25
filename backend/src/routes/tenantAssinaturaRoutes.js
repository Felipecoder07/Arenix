const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middlewares/auth');
const saasBillingService = require('../services/saasBillingService');

// Todas as rotas requerem usuário autenticado com perfil Administrador ou Gerente da Arena
router.use(verifyToken);
router.use(requireRole(['Administrador', 'Gerente']));

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/tenant/assinatura/plano
// Retorna os dados do plano atual da arena, limites e uso de recursos.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/plano', async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    // 1. Buscar arena e dados do plano
    const arena = await db.getAsync(`
      SELECT a.id, a.nome, a.status as arena_status, a.dia_vencimento, a.trial_expira_em,
             p.id as plano_id, p.nome as plano_nome, p.max_quadras, p.max_usuarios, p.valor_mensal
      FROM Arenas a
      LEFT JOIN PlanosSaaS p ON a.plano_id = p.id
      WHERE a.id = ?
    `, [tenantId]);

    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    // 2. Contar recursos utilizados em tempo real
    const countQuadras = await db.getAsync('SELECT COUNT(*) as total FROM Quadras WHERE tenant_id = ? AND status != "Excluida"', [tenantId]);
    const countUsuarios = await db.getAsync('SELECT COUNT(*) as total FROM Usuarios WHERE tenant_id = ? AND ativo = 1', [tenantId]);

    // 3. Buscar a fatura mais recente (para próximo vencimento/status)
    const ultimaFatura = await db.getAsync(`
      SELECT id, valor, data_vencimento, status
      FROM FaturasSaaS
      WHERE tenant_id = ?
      ORDER BY data_vencimento DESC
      LIMIT 1
    `, [tenantId]);

    res.json({
      arena_id: arena.id,
      arena_nome: arena.nome,
      arena_status: arena.arena_status, // 1 = Ativa, 0 = Inadimplente/Bloqueada
      dia_vencimento: arena.dia_vencimento,
      trial_expira_em: arena.trial_expira_em,
      plano: {
        id: arena.plano_id,
        nome: arena.plano_nome || 'Nenhum',
        valor_mensal: arena.valor_mensal || 0,
        max_quadras: arena.max_quadras || 0,
        max_usuarios: arena.max_usuarios || 0,
      },
      uso: {
        quadras_usadas: countQuadras ? countQuadras.total : 0,
        usuarios_usados: countUsuarios ? countUsuarios.total : 0,
      },
      fatura_atual: ultimaFatura || null,
    });
  } catch (err) {
    console.error('[Tenant Assinatura API Error]', err);
    res.status(500).json({ error: 'Erro ao buscar dados da assinatura.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/tenant/assinatura/faturas
// Retorna a lista de faturas do SaaS pertencentes exclusivamente à arena logada.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/faturas', async (req, res) => {
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const faturas = await db.allAsync(`
      SELECT f.id, f.valor, f.data_vencimento, f.data_pagamento, f.status,
             f.gateway_ref, f.copia_cola, f.qr_expira_em, f.metodo_pagamento,
             p.nome as plano_nome
      FROM FaturasSaaS f
      JOIN PlanosSaaS p ON f.plano_id = p.id
      WHERE f.tenant_id = ?
      ORDER BY f.data_vencimento DESC
    `, [tenantId]);

    res.json(faturas);
  } catch (err) {
    console.error('[Tenant Assinatura API Error]', err);
    res.status(500).json({ error: 'Erro ao buscar faturas da assinatura.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/tenant/assinatura/faturas/:id/gerar-pix
// Gera (ou retorna Pix ativo) para a fatura informada.
// Validação rígida: a fatura DEVE pertencer ao tenant_id do usuário logado!
// ─────────────────────────────────────────────────────────────────────────────
router.post('/faturas/:id/gerar-pix', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const faturaId = parseInt(req.params.id, 10);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }
  if (isNaN(faturaId)) {
    return res.status(400).json({ error: 'ID de fatura inválido.' });
  }

  try {
    // Validação de Tenant Isolation: Garante que o Admin da Arena A não gere Pix de faturas da Arena B
    const fatura = await db.getAsync('SELECT tenant_id FROM FaturasSaaS WHERE id = ?', [faturaId]);
    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }
    if (fatura.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Esta fatura não pertence à sua arena.' });
    }

    // Gerar Pix via saasBillingService (gera no Mercado Pago com credencial Master)
    const pixData = await saasBillingService.gerarPixFaturaSaaS(faturaId);
    res.json(pixData);
  } catch (err) {
    console.error('[Tenant Assinatura Gerar Pix Error]', err);
    res.status(400).json({ error: err.message || 'Erro ao gerar Pix da fatura.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/tenant/assinatura/status-pagamento/:gateway_ref
// Usado pelo Polling do frontend para verificar se o Pix da mensalidade foi pago.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status-pagamento/:gateway_ref', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { gateway_ref } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    let fatura = await db.getAsync(`
      SELECT f.id, f.status, f.data_pagamento, f.tenant_id, f.gateway_ref, a.status as arena_status
      FROM FaturasSaaS f
      JOIN Arenas a ON f.tenant_id = a.id
      WHERE f.gateway_ref = ? OR f.id = ?
    `, [gateway_ref, gateway_ref]);

    if (!fatura) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }
    if (fatura.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Se ainda não consta como Paga no banco local, verifica na API do Mercado Pago em tempo real
    if (fatura.status !== 'Paga' && fatura.gateway_ref) {
      try {
        const token = await saasBillingService.getMasterAccessToken();
        if (token) {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${fatura.gateway_ref}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (mpRes.ok) {
            const mpData = await mpRes.json();
            if (mpData.status === 'approved') {
              const resLiquida = await saasBillingService.liquidarFaturaSaaS(fatura.gateway_ref);
              return res.json({
                fatura_id: fatura.id,
                status: 'Paga',
                data_pagamento: new Date().toISOString().split('T')[0],
                pago: true,
                arena_ativa: true,
                arena_desbloqueada: resLiquida.arena_desbloqueada
              });
            }
          }
        }
      } catch (mpErr) {
        console.error('[Status Polling MP Live Check Error]', mpErr.message);
      }
    }

    const recheckArena = await db.getAsync('SELECT status FROM Arenas WHERE id = ?', [tenantId]);

    res.json({
      fatura_id: fatura.id,
      status: fatura.status,
      data_pagamento: fatura.data_pagamento,
      pago: fatura.status === 'Paga',
      arena_ativa: recheckArena ? recheckArena.status === 1 : fatura.arena_status === 1,
    });
  } catch (err) {
    console.error('[Tenant Assinatura Status Polling Error]', err);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/tenant/assinatura/faturas/:id/simular-pagamento
// Rota auxiliar de teste para simular aprovação imediata do Pix e auto-desbloqueio
// ─────────────────────────────────────────────────────────────────────────────
router.post('/faturas/:id/simular-pagamento', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const faturaId = parseInt(req.params.id, 10);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não associado ao usuário.' });
  }

  try {
    const fatura = await db.getAsync('SELECT gateway_ref, tenant_id FROM FaturasSaaS WHERE id = ?', [faturaId]);
    if (!fatura) return res.status(404).json({ error: 'Fatura não encontrada.' });
    if (fatura.tenant_id !== tenantId) return res.status(403).json({ error: 'Acesso negado.' });

    const refToUse = fatura.gateway_ref || `sim_ref_${faturaId}_${Date.now()}`;
    if (!fatura.gateway_ref) {
      await db.runAsync('UPDATE FaturasSaaS SET gateway_ref = ? WHERE id = ?', [refToUse, faturaId]);
    }

    const resLiquida = await saasBillingService.liquidarFaturaSaaS(refToUse);
    res.json({
      message: 'Pagamento simulado e aprovado com sucesso!',
      ...resLiquida
    });
  } catch (err) {
    console.error('[Simular Pagamento Error]', err);
    res.status(500).json({ error: 'Erro ao simular pagamento.' });
  }
});

module.exports = router;
