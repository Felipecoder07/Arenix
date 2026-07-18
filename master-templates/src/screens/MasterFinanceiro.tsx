import { useState, useEffect } from 'react';
import { Plus, Pencil, Wallet, Clock, CheckCircle } from 'lucide-react';
import { Card, Badge, Button, PageHeader, Modal, Field, Input, Select, ConfirmModal } from '../components/ui';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { PLANS, REVENUE_HISTORY, formatBRL, formatDate, type Plan } from '../data/mock';

const BLOCK_AFTER_DAYS = 7;

export function MasterFinanceiro() {
  const [editPlan, setEditPlan] = useState<string | null>(null);
  const [faturas, setFaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState<any | null>(null);

  const fetchFaturas = async () => {
    try {
      const token = localStorage.getItem('courtmanager_token');
      const res = await fetch('http://localhost:3000/api/saas/faturas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setFaturas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaturas();
  }, []);

  const handlePay = async (faturaId: number) => {
    try {
      const token = localStorage.getItem('courtmanager_token');
      const res = await fetch(`http://localhost:3000/api/saas/faturas/${faturaId}/pagar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPayTarget(null);
        fetchFaturas();
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
    <div className="space-y-6">
      <PageHeader
        title="Financeiro & assinaturas"
        description="Gestão de planos, faturamento e inadimplência da plataforma."
      />

      {/* MRR + history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricCard label="MRR total da plataforma" value={formatBRL(REVENUE_HISTORY[REVENUE_HISTORY.length - 1].mrr)} accent="success" sub="Receita recorrente mensal" trend={{ value: '+5,4%', direction: 'up' }} />
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Histórico de faturamento</h3>
              <p className="text-xs text-muted">Últimos 6 meses</p>
            </div>
          </div>
          <LineChart data={REVENUE_HISTORY.map((r) => ({ label: r.month, value: r.mrr }))} formatValue={(v) => `${(v / 1000).toFixed(0)}k`} />
        </Card>
      </div>

      {/* Auto-block notice */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-cream-surface border border-border-passive text-sm">
        <Clock size={15} className="text-muted" />
        <span className="text-charcoal/80">Arenas com faturas vencidas há <strong>{BLOCK_AFTER_DAYS} dias ou mais</strong> são bloqueadas automaticamente pela plataforma.</span>
      </div>

      {/* Plans */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal mb-3">Planos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-charcoal">{p.id}</div>
                  <div className="text-2xl font-semibold text-charcoal tabular mt-1">{formatBRL(p.price)}<span className="text-sm font-normal text-muted">/mês</span></div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditPlan(p.id)}><Pencil size={13} /> Editar</Button>
              </div>
              <p className="text-xs text-muted mt-2">{p.description}</p>
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Limite de quadras</span><span className="font-medium tabular">{p.courtLimit}</span></div>
                <div className="flex justify-between"><span className="text-muted">Limite de usuários</span><span className="font-medium tabular">{p.userLimit}</span></div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment status table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border-passive flex items-center gap-2">
          <Wallet size={15} className="text-muted" />
          <h3 className="text-sm font-semibold">Histórico de Faturas Globais</h3>
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
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ação</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {faturas.map((f) => {
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
                      <td className="px-5 py-3 tabular">{formatBRL(f.valor)}</td>
                      <td className="px-5 py-3"><Badge status={getStatusColor(f.status) as any}>{f.status}</Badge></td>
                      <td className="px-5 py-3 text-right">
                        {f.status !== 'Paga' ? (
                          <Button size="sm" variant="ghost" onClick={() => setPayTarget(f)}>Registrar pagamento</Button>
                        ) : (
                          <span className="text-success text-xs font-medium flex items-center justify-end gap-1"><CheckCircle size={13}/> Pago em {formatDate(f.data_pagamento)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {faturas.length === 0 && (
                  <tr><td colSpan={6} className="p-5 text-center text-muted">Nenhuma fatura encontrada.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Edit plan modal */}
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title={`Editar plano ${editPlan || ''}`}
        footer={<><Button variant="ghost" onClick={() => setEditPlan(null)}>Cancelar</Button><Button variant="primary" onClick={() => setEditPlan(null)}>Salvar</Button></>}
      >
        {editPlan && (() => {
          const p = PLANS.find((x) => x.id === editPlan)!;
          return (
            <div className="space-y-4">
              <Field label="Nome do plano"><Input defaultValue={p.id} /></Field>
              <Field label="Preço mensal (R$)"><Input type="number" defaultValue={p.price} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Limite de quadras"><Input type="number" defaultValue={p.courtLimit} /></Field>
                <Field label="Limite de usuários"><Input type="number" defaultValue={p.userLimit} /></Field>
              </div>
              <Field label="Descrição"><Input defaultValue={p.description} /></Field>
            </div>
          );
        })()}
      </Modal>

      {/* Manual payment confirm */}
      <ConfirmModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={() => handlePay(payTarget?.id)}
        title="Registrar pagamento manual"
        message={<>Você está confirmando que recebeu manualmente o pagamento da fatura <strong>#{payTarget?.id}</strong> da arena <strong>{payTarget?.arena_nome}</strong> no valor de {formatBRL(payTarget?.valor || 0)}?</>}
        confirmLabel="Confirmar pagamento"
      />
    </div>
  );
}
