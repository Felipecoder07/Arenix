import type { SaaSPlan, SaaSInvoice } from '../types/api';
import { MasterPageHeader as PageHeader } from '../components/MasterPageHeader';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { Pencil, Wallet, Clock, CheckCircle, Download, Plus, TrendingUp } from 'lucide-react';
import { Card, Badge, Button, Modal, Field, Input, ConfirmModal } from '../components/ui';
import { exportMasterCsv } from '../utils/masterExport';
import { MasterRevenueChart } from '../components/MasterRevenueChart';
import { formatBRL, formatDate } from '../data/mock';

const BLOCK_AFTER_DAYS = 7;

export function MasterFinanceiro() {
  const [editPlan, setEditPlan] = useState<(Omit<SaaSPlan, 'valor_mensal' | 'valor_anual'> & { valor_mensal: string; valor_anual: string }) | null>(null);
  const [planos, setPlanos] = useState<SaaSPlan[]>([]);
  const [faturas, setFaturas] = useState<SaaSInvoice[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState<SaaSInvoice | null>(null);
  const [metrics, setMetrics] = useState({
    mrr: 0,
    mrrVariacao: 0,
    faturamentoHistorico: [] as Array<{ month: string; total: number }>
  });

  const faturasFiltradas = faturas.filter(f => {
    if (filtroStatus === 'todas') return true;
    if (filtroStatus === 'Pix Online') return f.metodo_pagamento === 'Pix Online';
    if (filtroStatus === 'Manual') return f.metodo_pagamento === 'Manual';
    return f.status === filtroStatus;
  });

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const num = Number.parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatFloatToCurrencyInput = (num: number) => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyToFloat = (value: string) => {
    if (!value) return 0;
    const clean = value.replace(/\./g, '').replace(',', '.');
    return Number.parseFloat(clean) || 0;
  };

  const loadData = async () => {
    try {
      const headers = {};
      
      const [faturasRes, metricsRes, planosRes] = await Promise.all([
        fetch('/api/saas/faturas', { headers }).then(r => r.json()),
        fetch('/api/saas/metrics', { headers }).then(r => r.json()),
        fetch('/api/saas/planos', { headers }).then(r => r.json())
      ]);

      setFaturas(faturasRes);
      setPlanos(planosRes);
      setMetrics({
        mrr: metricsRes.totalReceitaSaaS || 0,
        mrrVariacao: metricsRes.mrrVariacao || 0,
        faturamentoHistorico: metricsRes.faturamentoHistorico || []
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editPlan) return;
    try {
      const res = await fetch(`/api/saas/planos/${editPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: editPlan.nome,
          valor_mensal: parseCurrencyToFloat(editPlan.valor_mensal),
          valor_anual: parseCurrencyToFloat(editPlan.valor_anual),
          max_quadras: editPlan.max_quadras,
          max_usuarios: editPlan.max_usuarios
        })
      });

      if (res.ok) {
        setEditPlan(null);
        loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erro ao atualizar plano.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao salvar plano.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePay = async (faturaId: number) => {
    try {
      const res = await fetch(`/api/saas/faturas/${faturaId}/pagar`, {
        method: 'POST',
        headers: {}
      });
      if (res.ok) {
        setPayTarget(null);
        loadData();
      } else {
        alert('Erro ao pagar fatura.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Paga') return 'success';
    if (status === 'Atrasada') return 'danger';
    return 'warning';
  };

  const calcAtraso = (dataVencimento: string, status: string) => {
    if (status === 'Paga') return 0;
    const v = new Date(dataVencimento);
    const hoje = new Date();
    const diff = hoje.getTime() - v.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / (1000 * 3600 * 24));
  };

  return (
    <div className="master-reference-page master-finance-page">
      <PageHeader
        title="Financeiro & assinaturas"
        description="Planos, faturamento e inadimplência de toda a plataforma" context={false}
        actions={<><Button variant="ghost" onClick={() => exportMasterCsv('faturas.csv', [['Arena', 'Fatura', 'Vencimento', 'Valor', 'Status'], ...faturasFiltradas.map(f => [f.arena_nome, f.id, f.data_vencimento, f.valor, f.status])])}><Download size={13} /> Exportar</Button><Button variant="primary" onClick={() => document.getElementById('master-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Plus size={14} /> Registrar pagamento</Button></>}
      />

      {/* MRR + history */}
      <div className="master-finance-summary">
        <section className="master-finance-mrr"><header><span>MRR DA PLATAFORMA</span><TrendingUp size={18} /></header><strong>{formatBRL(metrics.mrr)}</strong><p><span>{metrics.mrrVariacao >= 0 ? '↗' : '↘'} {metrics.mrrVariacao.toLocaleString('pt-BR')}%</span> vs. mês anterior</p><footer><span>Receita recorrente mensal</span><span>ARR · {formatBRL(metrics.mrr * 12)}</span></footer></section>
        <Card className="master-finance-history master-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Histórico de faturamento</h3>
              <p className="text-xs text-muted">Últimos 6 meses</p>
            </div>
            {metrics.faturamentoHistorico.length >= 2 && (() => {
              const first = metrics.faturamentoHistorico[0].total;
              const last = metrics.faturamentoHistorico[metrics.faturamentoHistorico.length - 1].total;
              const pct = first > 0 ? ((last - first) / first) * 100 : 0;
              return (
                <div className="text-xs font-bold" style={{ color: pct >= 0 ? '#16845B' : '#B93A32' }}>
                  {pct >= 0 ? '↗' : '↘'} {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% no período
                </div>
              );
            })()}
          </div>
          <MasterRevenueChart data={metrics.faturamentoHistorico} />
        </Card>
      </div>

      {/* Auto-block notice */}
      <div className="master-notice flex items-center gap-2.5 px-4 py-3 rounded-xl bg-cream-surface border border-border-passive text-sm">
        <Clock size={15} className="text-muted" />
        <span className="text-charcoal/80">Arenas com faturas vencidas há <strong>{BLOCK_AFTER_DAYS} dias ou mais</strong> são bloqueadas automaticamente pela plataforma.</span>
      </div>

      {/* Plans */}
      <div className="master-plans-section">
        <header><h3>Planos da plataforma</h3><span>Edite preços e limites por plano</span></header>
        <div className="master-plans grid grid-cols-1 md:grid-cols-3 gap-4">
          {planos.map((p) => {
            return (
              <Card key={p.id} className={`p-5 ${p.nome === 'Pro' ? 'master-dark' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-semibold text-charcoal">{p.nome}</div>
                    <div className="text-2xl font-semibold text-charcoal tabular mt-1">
                      {p.valor_mensal > 0 ? (
                        <>
                          {formatBRL(p.valor_mensal)}
                          <span className="text-sm font-normal text-muted">/mês</span>
                        </>
                      ) : (
                        'Sob consulta'
                      )}
                    </div>
                    <div className="text-[11px] text-muted font-medium mt-0.5">
                      {p.valor_mensal > 0 ? (
                        `${formatBRL(p.valor_anual || 0)}/mês no anual`
                      ) : (
                        'múltiplas unidades'
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditPlan({
                    id: p.id,
                    nome: p.nome,
                    valor_mensal: formatFloatToCurrencyInput(p.valor_mensal),
                    valor_anual: formatFloatToCurrencyInput(p.valor_anual || 0),
                    max_quadras: p.max_quadras,
                    max_usuarios: p.max_usuarios
                  })}><Pencil size={13} /> Editar</Button>
                </div>
                <div className="master-plan-limits"><span>{p.max_quadras} quadras</span><span>{p.max_usuarios} usuários</span></div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment status table */}
      <div id="master-invoices"><Card className="master-invoices overflow-hidden">
        <div className="px-5 py-4 border-b border-border-passive flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-muted" />
            <h3 className="text-base font-semibold">Faturas globais</h3>
          </div>
          {/* Filtros de Faturas */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-sm">
            <button
              onClick={() => setFiltroStatus('todas')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${filtroStatus === 'todas' ? 'bg-charcoal text-white' : 'bg-cream/60 text-muted hover:bg-cream'}`}
            >
              Todas ({faturas.length})
            </button>
            <button
              onClick={() => setFiltroStatus('Pendente')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${filtroStatus === 'Pendente' ? 'bg-warning text-white' : 'bg-warning-soft text-warning-dark hover:bg-warning-soft/80'}`}
            >
              Pendentes ({faturas.filter(f => f.status === 'Pendente').length})
            </button>
            <button
              onClick={() => setFiltroStatus('Atrasada')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${filtroStatus === 'Atrasada' ? 'bg-danger text-white' : 'bg-danger-soft text-danger-dark hover:bg-danger-soft/80'}`}
            >
              Atrasadas ({faturas.filter(f => f.status === 'Atrasada').length})
            </button>
            <button
              onClick={() => setFiltroStatus('Pix Online')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${filtroStatus === 'Pix Online' ? 'bg-success text-white' : 'bg-success-soft text-success-dark hover:bg-success-soft/80'}`}
            >
              Pix Online ({faturas.filter(f => f.metodo_pagamento === 'Pix Online').length})
            </button>
            <button
              onClick={() => setFiltroStatus('Manual')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${filtroStatus === 'Manual' ? 'bg-charcoal-04 text-charcoal' : 'bg-cream/60 text-muted hover:bg-cream'}`}
            >
              Manual ({faturas.filter(f => f.metodo_pagamento === 'Manual').length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-charcoal animate-pulse">Carregando faturas...</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Arena</th>
                <th className="px-5 py-3 font-medium">Fatura</th>
                <th className="px-5 py-3 font-medium">Vencimento</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Método</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ação</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {faturasFiltradas.map((f) => {
                  const overdueDays = calcAtraso(f.data_vencimento, f.status);
                  const rowTint = f.status === 'Atrasada' && overdueDays >= BLOCK_AFTER_DAYS
                    ? 'bg-danger-soft/40'
                    : f.status === 'Atrasada' ? 'bg-warning-soft/40' : '';
                  return (
                    <tr key={f.id} className={`hover:bg-cream/50 transition-colors ${rowTint}`}>
                      <td className="px-5 py-3 font-medium text-charcoal">{f.arena_nome}</td>
                      <td className="px-5 py-3 text-muted">#{f.id} - {f.plano_nome}</td>
                      <td className="px-5 py-3 tabular text-muted">
                        {formatDate(f.data_vencimento)}
                        {overdueDays > 0 && <span className="text-danger ml-2 text-xs">({overdueDays} dias)</span>}
                      </td>
                      <td className="px-5 py-3 tabular font-semibold">{formatBRL(f.valor)}</td>
                      <td className="px-5 py-3">
                        {f.metodo_pagamento === 'Pix Online' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-0.5 rounded-full bg-success-soft text-success-dark border border-success/20">
                            ⚡ Pix Online
                          </span>
                        ) : f.metodo_pagamento === 'Manual' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium px-2.5 py-0.5 rounded-full bg-charcoal-04 text-charcoal border border-border-passive">
                            👤 Manual
                          </span>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3"><Badge status={getStatusColor(f.status)}>{f.status}</Badge></td>
                      <td className="px-5 py-3 text-right">
                        {f.status !== 'Paga' ? (
                          <Button size="sm" variant="ghost" onClick={() => setPayTarget(f)}>Registrar pagamento</Button>
                        ) : (
                          <span className="text-success text-sm font-medium flex items-center justify-end gap-1"><CheckCircle size={13}/> Pago em {formatDate(f.data_pagamento)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {faturasFiltradas.length === 0 && (
                  <tr><td colSpan={7} className="p-5 text-center text-muted">Nenhuma fatura encontrada com este filtro.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      </div>

      {/* Edit plan modal */}
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title={`Editar plano ${editPlan?.nome || ''}`}
        footer={<><Button variant="ghost" onClick={() => setEditPlan(null)}>Cancelar</Button><Button variant="primary" onClick={handleSavePlan}>Salvar</Button></>}
      >
        {editPlan && (
          <div className="space-y-4">
            <Field label="Nome do plano">
              <Input 
                value={editPlan.nome} 
                onChange={(e) => setEditPlan({ ...editPlan, nome: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preço mensal (R$)">
                <Input 
                  type="text" 
                  value={editPlan.valor_mensal} 
                  onChange={(e) => setEditPlan({ ...editPlan, valor_mensal: formatCurrencyInput(e.target.value) })}
                />
              </Field>
              <Field label="Preço anual (R$)">
                <Input 
                  type="text" 
                  value={editPlan.valor_anual} 
                  onChange={(e) => setEditPlan({ ...editPlan, valor_anual: formatCurrencyInput(e.target.value) })}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted -mt-2">
              💡 Digite <strong>0,00</strong> em ambos os preços para marcar o plano como <strong>Sob consulta</strong> (múltiplas unidades).
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Limite de quadras">
                <Input 
                  type="number" 
                  value={editPlan.max_quadras} 
                  onChange={(e) => setEditPlan({ ...editPlan, max_quadras: Number.parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
              <Field label="Limite de usuários">
                <Input 
                  type="number" 
                  value={editPlan.max_usuarios} 
                  onChange={(e) => setEditPlan({ ...editPlan, max_usuarios: Number.parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual payment confirm */}
      <ConfirmModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={() => { if (payTarget) void handlePay(payTarget.id); }}
        title="Registrar pagamento manual"
        message={<>Você está confirmando que recebeu manualmente o pagamento da fatura <strong>#{payTarget?.id}</strong> da arena <strong>{payTarget?.arena_nome}</strong> no valor de {formatBRL(payTarget?.valor || 0)}?</>}
        confirmLabel="Confirmar pagamento"
      />
    </div>
  );
}
