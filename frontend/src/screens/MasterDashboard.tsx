import type { SaaSArena, SaaSInvoice } from '../types/api';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { LayoutGrid, Users, Wallet, AlertCircle, ArrowRight, ArrowUpRight, TrendingUp, Bell } from 'lucide-react';
import { formatBRL } from '../data/mock';
import { MasterArenasChart } from '../components/MasterArenasChart';
import '../assets/css/master-dashboard.css';

interface Props { onNavigate: (id: string) => void; }

export function MasterDashboard({ onNavigate }: Readonly<Props>) {
  const [metrics, setMetrics] = useState({
    total: 0,
    newThisMonth: 0,
    active: 0,
    blocked: 0,
    trial: 0,
    courts: 0,
    players: 0,
    mrr: 0,
    churnRate: 0,
    reservasHoje: 0,
    reservasSemana: 0,
    reservasMes: 0,
    reservasVariacao: 0,
    clientesNovos30d: 0,
    mrrVariacao: 0,
    growthChart: [] as Array<{ month: string; count: number }>,
    overdue: [] as SaaSArena[]
  });
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<(SaaSInvoice & { tenant_id: number })[]>([]);

  useEffect(() => {
    const headers = {};

    Promise.all([
      fetch('/api/saas/metrics', { headers }).then(r => r.json()),
      fetch('/api/saas/arenas', { headers }).then(r => r.json())
    ]).then(([metricsData, arenasData]) => {
      const overdue = arenasData.filter((a: SaaSArena) => a.faturas_atrasadas > 0);
      setMetrics({
        total: arenasData.length,
        newThisMonth: arenasData.filter((arena: SaaSArena) => arena.criado_em?.slice(0, 7) === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)).length,
        active: arenasData.filter((arena: SaaSArena) => arena.status === 1 && !arena.em_trial).length,
        blocked: metricsData.arenasBloqueadas || 0,
        trial: arenasData.filter((arena: SaaSArena) => arena.status === 1 && arena.em_trial).length,
        courts: metricsData.totalQuadras || 0,
        players: metricsData.totalClientes || 0,
        mrr: metricsData.totalReceitaSaaS || 0,
        churnRate: metricsData.churnRate || 0,
        reservasHoje: metricsData.reservasHoje || 0,
        reservasSemana: metricsData.reservasSemana || 0,
        reservasMes: metricsData.reservasMes || 0,
        reservasVariacao: metricsData.reservasVariacao || 0,
        clientesNovos30d: metricsData.clientesNovos30d || 0,
        mrrVariacao: metricsData.mrrVariacao || 0,
        growthChart: (() => {
          const real: Record<string, number> = {};
          for (const item of (metricsData.growthChart || [])) {
            real[item.month] = item.count;
          }
          const result: Array<{ month: string; count: number }> = [];
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({ month: key, count: real[key] ?? 0 });
          }
          return result;
        })(),
        overdue
      });
      setLoading(false);
    }).catch(console.error);
    fetch('/api/saas/faturas').then(response => response.ok ? response.json() : []).then(data => setInvoices(Array.isArray(data) ? data : [])).catch(console.error);
  }, []);

  const { 
    total, active, blocked, trial, courts, players, mrr, churnRate,
    reservasHoje, reservasSemana, reservasMes, reservasVariacao, 
    mrrVariacao, growthChart, overdue
  } = metrics;

  const formatMonthLabel = (monthStr: string) => {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    if (parts.length !== 2) return monthStr;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIndex = Number.parseInt(parts[1], 10) - 1;
    return months[monthIndex] || monthStr;
  };

  if (loading) return <div className="p-8 text-center text-charcoal animate-pulse">Carregando painel...</div>;

  const bestMonth = growthChart.reduce<(typeof growthChart)[number] | null>((best, item) => !best || item.count >= best.count ? item : best, null);
  const compactMoney = (value: number) => value >= 1000
    ? `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : formatBRL(value);
  const composition = [
    { label: 'Ativas', value: active, color: '#C9FF3B' },
    { label: 'Em período de teste', value: trial, color: '#F0B84C' },
    { label: 'Bloqueadas', value: blocked, color: '#E56B60' },
  ];

  return (
    <div className="master-dashboard">
      <header className="master-dashboard-header">
        <div><h1>Dashboard Master</h1><p>Visão geral de toda a operação Courtly</p></div>
        <div className="master-dashboard-actions"><button className="master-dashboard-bell" aria-label="Abrir comunicação" onClick={() => onNavigate('comunicacao')}><Bell size={17} /></button><span className="master-context"><i /> Painel Master</span></div>
      </header>
      <div className="master-pulse">
        <section className="master-network" aria-label="Panorama da rede">
          <div className="master-network-summary"><span className="master-network-live"><i /> REDE AO VIVO</span><strong className="master-network-total">{total}</strong><p>arenas conectadas à plataforma</p>
            <span className="master-network-growth"><TrendingUp size={13} /> +{metrics.newThisMonth} novas neste mês</span>
          </div>
          <div className="master-composition"><div className="master-composition-heading"><span>COMPOSIÇÃO DA REDE</span><span>{total ? '100%' : '0%'}</span></div>
            {composition.map(item => <div key={item.label}>
              <div className="master-composition-label"><span>{item.label}</span><strong style={{ color: item.color }}>{item.value} · {total ? Math.round(item.value / total * 100) : 0}%</strong></div>
              <div className="master-progress"><span style={{ width: (total ? item.value / total * 100 : 0) + '%', background: item.color }} /></div>
            </div>)}
            <div className="master-network-base">
              <div><span className="master-base-icon"><LayoutGrid size={14} /></span><div><strong>{courts.toLocaleString('pt-BR')}</strong><small>quadras</small></div></div>
              <div><span className="master-base-icon"><Users size={14} /></span><div><strong>{players.toLocaleString('pt-BR')}</strong><small>jogadores</small></div></div>
            </div>
          </div>
        </section>
        <section className="master-revenue" aria-label="Receita recorrente">
          <div className="master-revenue-heading"><span>RECEITA RECORRENTE</span><span className="master-revenue-icon"><Wallet size={15} /></span></div>
          <strong title={formatBRL(mrr)}>{compactMoney(mrr)}</strong><p>{mrrVariacao >= 0 ? '↗' : '↘'} {mrrVariacao.toLocaleString('pt-BR')}% sobre o mês anterior</p>
          <footer><span>Cancelamento</span><strong>{churnRate.toLocaleString('pt-BR')}%</strong></footer>
        </section>
      </div>
      <div className="master-operations">
        <section className="master-growth">
          <header><div><h2>Novas arenas</h2><p>Ritmo de expansão · últimos 12 meses</p></div>{bestMonth && <button className="master-best-month" onClick={() => onNavigate('arenas')} aria-label="Ver arenas — melhor mês"><i />{formatMonthLabel(bestMonth.month).toUpperCase()} · {bestMonth.count}</button>}</header>
          {growthChart.length ? <MasterArenasChart data={growthChart} /> : <p className="py-16 text-center">Nenhuma arena cadastrada no período.</p>}
        </section>
        <div className="master-operational-aside">
          <section className="master-reservations"><header><h2>Pulso de reservas</h2><span className="master-live-status"><i /> tempo real</span></header>
            <div className="master-reservation-periods">
              <div><span>HOJE</span><strong>{reservasHoje.toLocaleString('pt-BR')}</strong><small className={reservasVariacao < 0 ? 'is-negative' : ''}>{reservasVariacao >= 0 ? '↗ +' : '↘ '}{reservasVariacao.toLocaleString('pt-BR')}%</small></div>
              <div><span>SEMANA</span><strong>{reservasSemana.toLocaleString('pt-BR')}</strong><small className="period-description">últimos 7 dias</small></div>
              <div><span>MÊS</span><strong>{reservasMes.toLocaleString('pt-BR')}</strong><small className="period-description">mês atual</small></div>
            </div>
          </section>
          <section className="master-overdue">
            <header><h2><AlertCircle size={15} />Radar de inadimplência</h2><span className="master-overdue-count">{overdue.length} arenas</span></header>
            {overdue.slice(0, 2).map(arena => {
              const pending = invoices.filter(invoice => invoice.tenant_id === arena.id && invoice.status === 'Atrasada');
              const days = pending.length ? Math.max(...pending.map(invoice => Math.max(0, Math.floor((Date.now() - new Date(`${invoice.data_vencimento.slice(0, 10)}T00:00:00`).getTime()) / 86400000)))) : null;
              const amount = pending.reduce((sum, invoice) => sum + Number(invoice.valor), 0);
              return <button key={arena.id} onClick={() => onNavigate('arena-detalhe?id=' + arena.id)} className="master-overdue-row">
                <span className="master-overdue-days"><strong>{days ?? arena.faturas_atrasadas}</strong><small>{days === null ? 'faturas' : 'dias'}</small></span>
                <span className="master-overdue-name"><strong>{arena.nome}</strong><small>{arena.plano_nome || 'Basic'}{days !== null ? ` · ${days} dias` : ''}</small></span>
                <span className="master-overdue-amount">{pending.length ? formatBRL(amount) : `${arena.faturas_atrasadas} faturas`}</span><ArrowUpRight size={13} />
              </button>;
            })}
            {overdue.length === 0 && <p className="master-overdue-empty">Nenhuma arena inadimplente.</p>}
            <button className="master-finance-link" onClick={() => onNavigate('financeiro')}>Abrir central financeira <ArrowRight size={13} /></button>
          </section>
        </div>
      </div>
    </div>
  );
}
