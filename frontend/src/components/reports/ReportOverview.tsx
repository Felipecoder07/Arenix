import { Activity, Banknote, CalendarDays, CalendarCheck, CalendarX, Clock, CreditCard, Grid2X2, Receipt, RotateCcw, TrendingDown, TrendingUp, Trophy, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReportData } from '../../types/reports';

const money = (value = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const bounded = (value: number) => Math.min(100, Math.max(0, value));

interface Metric {
  label: string;
  value: string | number;
  description: string;
  badge?: string;
  tone?: 'green' | 'red' | 'amber' | 'blue';
  icon: LucideIcon;
}

export function ReportOverview({ tab, data }: { tab: string; data: ReportData }) {
  let metrics: Metric[];
  let title = '';
  let description = '';
  let indicator = '';
  let indicatorValue = '';
  let progress: number | undefined;
  let tone = 'green';
  const totals = data.totais || {};

  if (tab === 'faturamento') {
    const bruto = totals.bruto || 0;
    const pago = totals.pago || 0;
    const pendente = totals.pendente || 0;
    const count = data.paginacao?.total ?? data.reservas?.length ?? 0;
    const rate = bruto > 0 ? bounded(pago / bruto * 100) : 0;
    metrics = [
      { label: 'Faturamento bruto', value: money(bruto), description: 'Valor total gerado', badge: 'Total', icon: Banknote },
      { label: 'Recebido', value: money(pago), description: 'Entradas confirmadas', badge: 'Pago', tone: 'green', icon: Wallet },
      { label: 'A receber', value: money(pendente), description: 'Saldo pendente', badge: 'Pendente', tone: 'red', icon: Receipt },
      { label: 'Reservas', value: count, description: 'Reservas no período', badge: 'Volume', tone: 'blue', icon: CalendarDays },
    ];
    title = 'Análise de faturamento';
    description = count === 0 ? 'Nenhuma reserva encontrada para os filtros selecionados.'
      : `O período gerou ${money(bruto)} em faturamento bruto. ${percent(rate)}% já foi recebido, restando ${money(pendente)} a acompanhar nas próximas cobranças.`;
    indicator = 'Recebimento realizado';
    indicatorValue = `${percent(rate)}% recebido`;
    progress = rate;
  } else if (tab === 'ocupacao') {
    const courts = data.quadras || [];
    const rate = bounded(data.taxaGeral || 0);
    const count = courts.reduce((sum, court) => sum + court.totalReservas, 0);
    const sorted = [...courts].sort((a, b) => b.taxa - a.taxa);
    metrics = [
      { label: 'Taxa média', value: `${percent(rate)}%`, description: 'Ocupação geral do período', badge: 'Geral', tone: 'green', icon: Activity },
      { label: 'Quadras monitoradas', value: courts.length, description: 'Áreas acompanhadas', badge: 'Total', icon: Grid2X2 },
      { label: 'Reservas', value: count, description: 'Agendamentos computados', badge: 'Volume', tone: 'blue', icon: CalendarCheck },
      { label: 'Período', value: `${data.periodo?.dias || 0} dias`, description: 'Intervalo analisado', badge: 'Janela', tone: 'amber', icon: Clock },
    ];
    title = 'Análise de ocupação';
    description = courts.length === 0 ? 'Nenhuma quadra monitorada para os filtros selecionados.'
      : `A ocupação média ficou em ${percent(rate)}%, considerando reservas e bloqueios.`;
    if (sorted.length > 1 && sorted[0].taxa > sorted[sorted.length - 1].taxa) {
      description += ` A quadra ${sorted[0].quadra_nome} lidera o uso, enquanto ${sorted[sorted.length - 1].quadra_nome} tem maior disponibilidade.`;
    }
    indicator = 'Potencial disponível';
    indicatorValue = `${percent(100 - rate)}% ainda disponível`;
    progress = courts.length ? 100 - rate : 0;
    if (!courts.length) indicatorValue = 'Sem quadras no período';
  } else if (tab === 'reservas') {
    const count = totals.total || 0;
    const confirmed = totals.confirmadas || 0;
    const cancelled = totals.canceladas || 0;
    const pending = totals.pendentes || 0;
    const rate = count ? confirmed / count * 100 : 0;
    metrics = [
      { label: 'Total', value: count, description: 'Reservas no período', badge: 'Geral', icon: CalendarDays },
      { label: 'Confirmadas', value: confirmed, description: 'Horários garantidos', badge: 'Confirmadas', tone: 'green', icon: CalendarCheck },
      { label: 'Canceladas', value: cancelled, description: 'Reservas canceladas', badge: 'Atenção', tone: 'red', icon: CalendarX },
      { label: 'Pendentes', value: pending, description: 'Aguardando confirmação', badge: 'Pendente', tone: 'amber', icon: Clock },
    ];
    title = 'Análise de reservas';
    description = count === 0 ? 'Nenhuma reserva encontrada para os filtros selecionados.'
      : `Foram registradas ${count} reservas no período: ${confirmed} confirmadas, ${cancelled} canceladas e ${pending} pendentes.`;
    if (cancelled > 0) description += ' Os cancelamentos indicam oportunidades de recuperação de horários vagos.';
    indicator = 'Taxa de confirmação';
    indicatorValue = `${percent(rate)}% confirmadas`;
    progress = rate;
  } else if (tab === 'inadimplencia') {
    const debt = data.totalDevido || 0;
    const count = data.paginacao?.total ?? data.inadimplentes?.length ?? 0;
    const first = data.primeiraReservaPendente;
    const today = new Date();
    const days = first ? Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.parse(`${first}T00:00:00Z`)) / 86400000)) : 0;
    metrics = [
      { label: 'Devedores', value: data.totalDevedores ?? '—', description: 'Clientes com saldo em aberto', badge: 'Alerta', tone: 'red', icon: Users },
      { label: 'Total a receber', value: money(debt), description: 'Valor pendente no período', badge: 'Cobrar', tone: 'red', icon: Wallet },
      { label: 'Maior atraso', value: `${days} dias`, description: 'Desde a reserva pendente mais antiga', badge: 'Prioridade', tone: 'amber', icon: Clock },
    ];
    title = 'Análise de inadimplência';
    description = count === 0 ? 'Nenhuma reserva com saldo devedor para os filtros selecionados.'
      : `Há ${count} reservas com saldo pendente no período, totalizando ${money(debt)}.`;
    if (data.maiorSaldoQuadra) description += ` O maior saldo está na quadra ${data.maiorSaldoQuadra.quadra_nome}: ${money(data.maiorSaldoQuadra.total_devido)}.`;
    indicator = 'Risco financeiro';
    indicatorValue = `${money(debt)} em aberto`;
    tone = debt > 0 ? 'red' : 'green';
  } else if (tab === 'cancelamentos') {
    const count = totals.total || 0;
    const lost = totals.valorPerdido || 0;
    const refunded = totals.estornados || 0;
    const rate = data.totalReservas ? bounded(count / data.totalReservas * 100) : 0;
    metrics = [
      { label: 'Cancelamentos', value: count, description: 'Reservas canceladas no período', badge: count ? 'Atenção' : 'Ok', tone: 'red', icon: CalendarX },
      { label: 'Valor perdido', value: money(lost), description: 'Receita impactada', badge: 'Impacto', tone: 'red', icon: TrendingDown },
      { label: 'Estornados', value: refunded, description: refunded ? 'Reservas com pagamento estornado' : 'Nenhum reembolso registrado', badge: 'Estornos', tone: 'amber', icon: RotateCcw },
    ];
    title = 'Análise de cancelamentos';
    description = count ? `${count} cancelamento${count === 1 ? '' : 's'} no período, com ${money(lost)} em receita impactada e ${refunded} reserva${refunded === 1 ? '' : 's'} com pagamento estornado.`
      : 'Nenhum cancelamento registrado para os filtros selecionados.';
    indicator = 'Taxa de cancelamento';
    indicatorValue = data.totalReservas === undefined ? 'Não disponível' : `${percent(rate)}% das reservas`;
    progress = data.totalReservas === undefined ? undefined : rate;
    tone = count ? 'red' : 'green';
  } else if (tab === 'formas-pagamento') {
    metrics = [
      { label: 'Total recebido', value: money(data.totalGeral), description: 'Período selecionado', tone: 'green', icon: Wallet },
      { label: 'Métodos usados', value: data.porMetodo?.length || 0, description: 'Formas de pagamento', tone: 'blue', icon: CreditCard },
      { label: 'Transações', value: data.paginacao?.total ?? data.transacoes?.length ?? 0, description: 'Registros encontrados', icon: Receipt },
    ];
  } else if (tab === 'horarios-pico') {
    const peak = [...(data.porHora || [])].filter(item => item.total > 0).sort((a, b) => b.total - a.total)[0];
    const day = [...(data.porDiaSemana || [])].filter(item => item.total > 0).sort((a, b) => b.total - a.total)[0];
    metrics = [
      { label: 'Total de reservas', value: data.totalReservas || 0, description: 'No período selecionado', icon: CalendarDays },
      { label: 'Horário de pico', value: peak ? `${String(peak.hora).padStart(2, '0')}:00` : '—', description: peak ? `${peak.total} reservas neste horário` : 'Sem reservas no período', icon: Clock },
      { label: 'Dia mais movimentado', value: day?.dia || '—', description: day ? `${day.total} reservas no dia` : 'Sem reservas no período', icon: Activity },
    ];
  } else if (tab === 'top-clientes') {
    const leader = data.clienteMaisFrequente;
    metrics = [
      { label: 'Clientes ativos', value: data.paginacao?.total ?? data.clientes?.length ?? 0, description: 'Com reservas no período', icon: Users },
      { label: 'Faturamento total', value: money(data.totalFaturado), description: 'Dos clientes ranqueados', tone: 'green', icon: Banknote },
      { label: '#1 em reservas', value: leader?.nome || '—', description: leader ? `${leader.total_reservas} reservas · maior frequência` : 'Sem reservas no período', icon: Trophy },
    ];
  } else return null;

  return <>
    <div className={`report-metrics report-metrics-${metrics.length} report-metrics-${tab}`}>
      {metrics.map(({ label, value, description: detail, badge, tone: metricTone, icon: Icon }) => (
        <article className={`report-metric ${metricTone || 'neutral'}`} key={label}>
          <span className="report-metric-icon"><Icon size={20} aria-hidden="true" /></span>
          <div className="report-metric-copy">
            <div className="report-metric-heading"><h2>{label}</h2>{badge && <span>{badge}</span>}</div>
            <strong>{value}</strong><p>{detail}</p>
          </div>
        </article>
      ))}
    </div>
    {title && <section className={`report-analysis ${tone}`} aria-label={title}>
      {tab === 'cancelamentos' ? <TrendingDown className="report-analysis-icon" size={20} aria-hidden="true" /> : <TrendingUp className="report-analysis-icon" size={20} aria-hidden="true" />}
      <div className="report-analysis-copy"><h2>{title}</h2><p>{description}</p></div>
      <div className="report-indicator">
        <span>{indicator}</span>
        {progress !== undefined && <div className="report-progress" role="progressbar" aria-label={indicator} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${bounded(progress)}%` }} /></div>}
        <strong>{indicatorValue}</strong>
      </div>
    </section>}
  </>;
}
