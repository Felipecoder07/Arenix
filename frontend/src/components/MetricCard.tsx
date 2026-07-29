import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  accent?: 'default' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
}

export function MetricCard({ label, value, sub, trend, accent = 'default', icon }: MetricCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-danger' : 'text-muted';
  const accentBorder = accent === 'warning' ? 'border-l-warning' : accent === 'danger' ? 'border-l-danger' : accent === 'success' ? 'border-l-success' : 'border-l-charcoal/20';

  return (
    <div className={`bg-off-white border border-border-passive border-l-2 ${accentBorder} rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
        {icon && <span className="text-muted/60">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-charcoal tabular tracking-tight">{value}</span>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={13} />
            {trend.value}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
