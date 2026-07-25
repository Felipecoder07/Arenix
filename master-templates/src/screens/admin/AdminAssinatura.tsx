import React, { useState, useEffect } from 'react';
import '../../assets/css/configuracoes.css';
import '../../assets/css/pagamentos.css';

interface PlanoDados {
  arena_id: number;
  arena_nome: string;
  arena_status: number; // 1 = Ativa, 0 = Inadimplente/Bloqueada
  dia_vencimento: number;
  trial_expira_em: string | null;
  plano: {
    id: number;
    nome: string;
    valor_mensal: number;
    max_quadras: number;
    max_usuarios: number;
  };
  uso: {
    quadras_usadas: number;
    usuarios_usados: number;
  };
  fatura_atual: {
    id: number;
    valor: number;
    data_vencimento: string;
    status: string;
  } | null;
}

interface Fatura {
  id: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'Paga' | 'Pendente' | 'Atrasada';
  gateway_ref: string | null;
  copia_cola: string | null;
  qr_expira_em: string | null;
  metodo_pagamento: string | null;
  plano_nome: string;
}

interface PixResponse {
  qr_code: string | null;
  copia_cola: string;
  gateway_ref: string;
  expira_em: string;
  reutilizado?: boolean;
}

export function AdminAssinatura() {
  const token = localStorage.getItem('courtmanager_token');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [dados, setDados] = useState<PlanoDados | null>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);

  // Modal Pix
  const [modalPixOpen, setModalPixOpen] = useState(false);
  const [faturaSelecionada, setFaturaSelecionada] = useState<Fatura | null>(null);
  const [pixData, setPixData] = useState<PixResponse | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [pixPagoComSucesso, setPixPagoComSucesso] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carregar dados de Assinatura e Faturas
  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resPlano, resFaturas] = await Promise.all([
        fetch('http://localhost:3000/api/tenant/assinatura/plano', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3000/api/tenant/assinatura/faturas', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!resPlano.ok) {
        const errJson = await resPlano.json();
        throw new Error(errJson.error || 'Erro ao carregar dados do plano.');
      }
      if (!resFaturas.ok) {
        const errJson = await resFaturas.json();
        throw new Error(errJson.error || 'Erro ao carregar faturas.');
      }

      const dataPlano = await resPlano.json();
      const dataFaturas = await resFaturas.json();

      setDados(dataPlano);
      setFaturas(dataFaturas);
    } catch (e: any) {
      setErro(e.message || 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Polling automático do Pix (a cada 4s quando o modal Pix estiver aberto)
  useEffect(() => {
    if (!modalPixOpen || !pixData || !pixData.gateway_ref || pixPagoComSucesso) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/tenant/assinatura/status-pagamento/${pixData.gateway_ref}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const statusJson = await res.json();
          if (statusJson.pago) {
            setPixPagoComSucesso(true);
            showToast('🎉 Pagamento Pix confirmado com sucesso! Seu acesso foi atualizado.', 'success');
            carregarDados(); // Atualiza a tela
          }
        }
      } catch (err) {
        console.error('Erro no polling do Pix:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [modalPixOpen, pixData, pixPagoComSucesso]);

  // Ação: Abrir modal e gerar Pix
  const handlePagarPix = async (fatura: Fatura) => {
    setFaturaSelecionada(fatura);
    setPixData(null);
    setPixPagoComSucesso(false);
    setPixCopiado(false);
    setModalPixOpen(true);
    setGerandoPix(true);

    try {
      const res = await fetch(`http://localhost:3000/api/tenant/assinatura/faturas/${fatura.id}/gerar-pix`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar Pix.');

      setPixData(json);
    } catch (err: any) {
      showToast(err.message || 'Não foi possível gerar a cobrança Pix.', 'error');
      setModalPixOpen(false);
    } finally {
      setGerandoPix(false);
    }
  };

  // Copiar chave Pix Copia e Cola
  const handleCopiarPix = () => {
    if (!pixData || !pixData.copia_cola) return;
    navigator.clipboard.writeText(pixData.copia_cola);
    setPixCopiado(true);
    showToast('Chave Pix copia e cola copiada!', 'success');
    setTimeout(() => setPixCopiado(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
        <p>Carregando informações da sua assinatura...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#d32f2f' }}>
        <h3>⚠️ Ops! Ocorreu um erro</h3>
        <p>{erro}</p>
        <button
          onClick={carregarDados}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const isBloqueada = dados?.arena_status === 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toast.type === 'success' ? '#2e7d32' : '#c62828',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            fontWeight: 500,
            fontSize: '14px'
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
          💳 Minha Assinatura & Mensalidades
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
          Gerencie seu plano, acompanhe o limite de uso e pague suas mensalidades com liberação automática.
        </p>
      </div>

      {/* Banner de Status Especial (Bloqueio ou Trial) */}
      {isBloqueada && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '24px' }}>🛑</span>
          <div>
            <h4 style={{ margin: 0, color: '#991b1b', fontSize: '15px', fontWeight: 700 }}>
              Sua conta está com o acesso suspenso por pendência financeira
            </h4>
            <p style={{ margin: '2px 0 0 0', color: '#7f1d1d', fontSize: '13px' }}>
              Realize o pagamento de uma das faturas em aberto abaixo clicando em <strong>"Pagar com PIX"</strong>. Assim que confirmado, seu acesso será reativado instantaneamente!
            </p>
          </div>
        </div>
      )}

      {dados?.trial_expira_em && !isBloqueada && (
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '24px' }}>✨</span>
          <div>
            <h4 style={{ margin: 0, color: '#1e40af', fontSize: '15px', fontWeight: 700 }}>
              Período de Testes (Trial) Ativo
            </h4>
            <p style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '13px' }}>
              Aproveite todos os recursos da plataforma gratuitamente até {new Date(dados.trial_expira_em).toLocaleDateString('pt-BR')}.
            </p>
          </div>
        </div>
      )}

      {/* Grid de KPIs do Plano */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}
      >
        {/* KPI 1: Plano Atual */}
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
              Plano Contratado
            </span>
            <span
              style={{
                backgroundColor: isBloqueada ? '#fee2e2' : '#dcfce7',
                color: isBloqueada ? '#991b1b' : '#166534',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {isBloqueada ? 'Suspenso' : 'Ativo'}
            </span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
            {dados?.plano.nome || 'Carregando...'}
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
            R$ {dados?.plano.valor_mensal.toFixed(2)} / mês (Vencimento todo dia {dados?.dia_vencimento})
          </p>
        </div>

        {/* KPI 2: Limite de Quadras */}
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
              Quadras Cadastradas
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              {dados?.uso.quadras_usadas} de {dados?.plano.max_quadras === 999 ? 'Ilimitadas' : dados?.plano.max_quadras}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              backgroundColor: '#e2e8f0',
              height: '8px',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '12px'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, ((dados?.uso.quadras_usadas || 0) / (dados?.plano.max_quadras || 1)) * 100)}%`,
                backgroundColor: '#3b82f6',
                height: '100%',
                borderRadius: '4px'
              }}
            />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', margin: 0 }}>
            Capacidade utilizada do plano
          </p>
        </div>

        {/* KPI 3: Limite de Usuários */}
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
              Usuários da Equipe
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              {dados?.uso.usuarios_usados} de {dados?.plano.max_usuarios === 999 ? 'Ilimitados' : dados?.plano.max_usuarios}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              backgroundColor: '#e2e8f0',
              height: '8px',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '12px'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, ((dados?.uso.usuarios_usados || 0) / (dados?.plano.max_usuarios || 1)) * 100)}%`,
                backgroundColor: '#10b981',
                height: '100%',
                borderRadius: '4px'
              }}
            />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', margin: 0 }}>
            Contas de acesso ativas na arena
          </p>
        </div>
      </div>

      {/* Tabela de Histórico de Faturas */}
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', marginTop: 0 }}>
          📋 Historico de Faturas
        </h3>

        {faturas.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
            Nenhuma fatura gerada até o momento.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textIndent: 0 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fatura #</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Plano</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vencimento</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Valor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Método</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((fat) => {
                  const isPaga = fat.status === 'Paga';
                  const isAtrasada = fat.status === 'Atrasada';

                  return (
                    <tr
                      key={fat.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isAtrasada ? '#fef2f2' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#334155' }}>
                        #{fat.id}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {fat.plano_nome}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {new Date(fat.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                        R$ {fat.valor.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>
                        {fat.metodo_pagamento || '-'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: isPaga ? '#dcfce7' : isAtrasada ? '#fee2e2' : '#fef3c7',
                            color: isPaga ? '#166534' : isAtrasada ? '#991b1b' : '#92400e'
                          }}
                        >
                          {isPaga ? '✓ Paga' : isAtrasada ? '⚠️ Atrasada' : '⏳ Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {!isPaga ? (
                          <button
                            onClick={() => handlePagarPix(fat)}
                            style={{
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                            }}
                          >
                            ⚡ Pagar com PIX
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                            Pago em {fat.data_pagamento ? new Date(fat.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Pagamento via PIX */}
      {modalPixOpen && faturaSelecionada && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              position: 'relative',
              textAlign: 'center'
            }}
          >
            {/* Fechar */}
            <button
              onClick={() => setModalPixOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
              Pagamento via Pix Online
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0' }}>
              Fatura #{faturaSelecionada.id} — Valor: <strong>R$ {faturaSelecionada.valor.toFixed(2)}</strong>
            </p>

            {gerandoPix ? (
              <div style={{ padding: '40px 0', color: '#2563eb', fontWeight: 600 }}>
                <p>🔄 Gerando cobrança Pix no Mercado Pago...</p>
              </div>
            ) : pixPagoComSucesso ? (
              <div style={{ padding: '32px 0' }}>
                <span style={{ fontSize: '56px' }}>🎉</span>
                <h4 style={{ fontSize: '18px', color: '#166534', margin: '12px 0 4px 0' }}>
                  Pagamento Confirmado!
                </h4>
                <p style={{ fontSize: '14px', color: '#475569' }}>
                  Sua mensalidade foi liquidada e o acesso da arena foi atualizado.
                </p>
                <button
                  onClick={() => setModalPixOpen(false)}
                  style={{
                    marginTop: '16px',
                    backgroundColor: '#166534',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Concluir
                </button>
              </div>
            ) : pixData ? (
              <div>
                {/* Exibição do QR Code Base64 */}
                {pixData.qr_code && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'inline-block',
                      marginBottom: '16px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <img
                      src={pixData.qr_code}
                      alt="QR Code Pix"
                      style={{ width: '180px', height: '180px', display: 'block' }}
                    />
                  </div>
                )}

                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                  Abra o aplicativo do seu banco, escolha a opção <strong>Pix Copia e Cola</strong> ou escaneie a imagem acima.
                </p>

                {/* Copia e Cola */}
                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                  <label
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: '#64748b',
                      display: 'block',
                      marginBottom: '6px'
                    }}
                  >
                    Código Pix Copia e Cola:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={pixData.copia_cola}
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f1f5f9',
                        fontFamily: 'monospace',
                        color: '#334155'
                      }}
                    />
                    <button
                      onClick={handleCopiarPix}
                      style={{
                        backgroundColor: pixCopiado ? '#16a34a' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {pixCopiado ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Status Polling Live Indicator */}
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#1d4ed8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ animation: 'pulse 1.5s infinite' }}>🔄</span>
                    Aguardando confirmação do pagamento em tempo real...
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const refToUse = pixData.gateway_ref || faturaSelecionada?.id;
                          const res = await fetch(`http://localhost:3000/api/tenant/assinatura/status-pagamento/${refToUse}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const json = await res.json();
                          if (json.pago) {
                            setPixPagoComSucesso(true);
                            showToast('🎉 Pagamento confirmado com sucesso!', 'success');
                            carregarDados();
                          } else {
                            showToast('Pagamento ainda não foi detectado. Caso já tenha pago, aguarde alguns segundos.', 'info');
                          }
                        } catch {
                          showToast('Erro ao consultar status.', 'error');
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#1e40af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🔍 Verificar Agora
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!faturaSelecionada) return;
                        try {
                          const res = await fetch(`http://localhost:3000/api/tenant/assinatura/faturas/${faturaSelecionada.id}/simular-pagamento`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const json = await res.json();
                          if (res.ok) {
                            setPixPagoComSucesso(true);
                            showToast('🎉 Pagamento de teste simulado e aprovado com sucesso! Arena desbloqueada.', 'success');
                            carregarDados();
                          } else {
                            showToast(json.error || 'Erro ao simular.', 'error');
                          }
                        } catch {
                          showToast('Erro de conexão.', 'error');
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🧪 Simular Aprovação
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAssinatura;
