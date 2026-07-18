import { useState, useEffect } from 'react';
import { Building2, LayoutGrid, CalendarDays, Users, Wallet, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { Card, Badge, Button } from '../components/ui';
import { GROWTH, formatBRL, formatDate } from '../data/mock';

interface Props { onNavigate: (id: string) => void; }

export function MasterDashboard({ onNavigate }: Props) {
  const [metrics, setMetrics] = useState({
    active: 0, blocked: 0, trial: 0, courts: 0, players: 0, mrr: 0, overdue: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('courtmanager_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch('http://localhost:3000/api/saas/metrics', { headers }).then(r => r.json()),
      fetch('http://localhost:3000/api/saas/arenas', { headers }).then(r => r.json())
    ]).then(([metricsData, arenasData]) => {
      const overdue = arenasData.filter((a: any) => a.faturas_atrasadas > 0);
      setMetrics({
        active: metricsData.arenasAtivas || 0,
        blocked: metricsData.arenasBloqueadas || 0,
        trial: 0,
        courts: metricsData.totalQuadras || 0,
        players: metricsData.totalClientes || 0,
        mrr: metricsData.totalReceitaSaaS || 0,
        overdue
      });
      setLoading(false);
    }).catch(console.error);
  }, []);

  const { active, blocked, trial, courts, players, mrr, overdue } = metrics;
  const churn = 3.2; // mock static

  if (loading) return <div className="p-8 text-center text-charcoal animate-pulse">Carregando painel...</div>;

  return (
    <div className="space-y-6">
      {/* Master context banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-charcoal text-off-white text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-warning pulse-dot" />
        <span className="font-medium">Painel Master</span>
        <span className="text-off-white/50">·</span>
        <span className="text-off-white/70">Você está administrando toda a plataforma CourtManager, não uma arena individual.</span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          label="Arenas ativas"
          value={String(active)}
          icon={<Building2 size={16} />}
          sub={<span className="flex gap-3"><Badge status="ativa">{active} ativas</Badge><Badge status="trial">{trial} em trial</Badge><Badge status="bloqueada">{blocked} bloqueadas</Badge></span>}
          accent="default"
        />
        <MetricCard label="Quadras na plataforma" value={String(courts)} icon={<LayoutGrid size={16} />} sub="Soma de todas as arenas" />
        <MetricCard label="Reservas hoje" value="1.284" icon={<CalendarDays size={16} />} trend={{ value: '+8%', direction: 'up' }} sub={<span className="text-muted">Esta semana: 7.912 · Este mês: 31.420</span>} />
        <MetricCard label="Jogadores (total)" value={players.toLocaleString('pt-BR')} icon={<Users size={16} />} trend={{ value: '+412', direction: 'up' }} sub="Clientes em toda a plataforma" />
        <MetricCard label="MRR da plataforma" value={formatBRL(mrr)} icon={<Wallet size={16} />} trend={{ value: '+5,4%', direction: 'up' }} accent="success" sub="Receita recorrente mensal" />
        <MetricCard label="Taxa de churn" value={`${churn}%`} icon={<TrendingDown size={16} />} trend={{ value: '-0,4 p.p.', direction: 'up' }} accent={churn > 4 ? 'warning' : 'default'} sub="Últimos 30 dias" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Growth chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-charcoal">Novas arenas por mês</h3>
              <p className="text-xs text-muted">Últimos 12 meses</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('arenas')}>Ver arenas <ArrowRight size={13} /></Button>
          </div>
          <LineChart data={GROWTH.map((g) => ({ label: g.month, value: g.count }))} formatValue={(v) => String(v)} />
        </Card>

        {/* Overdue arenas */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-danger" />
            <h3 className="text-sm font-semibold text-charcoal">Arenas inadimplentes</h3>
            <Badge status="danger">{overdue.length}</Badge>
          </div>
          <div className="space-y-1 -mx-2">
            {overdue.slice(0, 7).map((a) => (
              <button key={a.id} onClick={() => onNavigate('arena-detalhe')}
                className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-cream-surface transition-colors text-left">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-charcoal truncate">{a.nome}</div>
                  <div className="text-xs text-muted">{a.plano_nome || 'Basic'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-danger">{a.faturas_atrasadas} faturas</div>
                  <div className="text-[11px] text-muted">desde {formatDate(a.created_at || new Date().toISOString())}</div>
                </div>
              </button>
            ))}
            {overdue.length === 0 && <p className="text-sm text-muted px-2 py-4">Nenhuma arena inadimplente.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
