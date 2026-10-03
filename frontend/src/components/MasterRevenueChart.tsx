import { useState } from 'react';
import { formatBRL } from '../data/mock';

function getBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return path;
}

export function MasterRevenueChart({ data }: Readonly<{ data: { month: string; total: number }[] }>) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) return <div className="master-revenue-chart-empty">Nenhum faturamento no período.</div>;

  const values = data.map(item => item.total);
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const points = data.map((item, index) => ({
    ...item,
    x: data.length === 1 ? 360 : 28 + index * 660 / (data.length - 1),
    y: range > 0 ? 100 - (item.total - min) / range * 75 : 60,
  }));

  const activeIndex = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < points.length
    ? hoveredIndex
    : points.length - 1;
  const activePoint = points[activeIndex];

  const month = (value: string) => {
    const [year, number] = value.split('-').map(Number);
    return year && number ? new Date(year, number - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : value;
  };

  const linePath = getBezierPath(points);
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} 115 L ${points[0].x} 115 Z`
    : '';

  const badgeX = Math.min(Math.max(10, activePoint.x - 45), 720 - 95);
  const badgeY = activePoint.y < 45 ? activePoint.y + 12 : activePoint.y - 34;

  return (
    <div className="master-revenue-chart" onMouseLeave={() => setHoveredIndex(null)}>
      <svg
        viewBox="0 0 720 130"
        preserveAspectRatio="none"
        role="img"
        aria-label="Histórico de faturamento mensal"
      >
        <title>{data.map(item => `${month(item.month)}: ${formatBRL(item.total)}`).join('; ')}</title>
        <defs>
          <linearGradient id="master-rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9ff3b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#c9ff3b" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Guia horizontal lines */}
        {[25, 62, 100].map(y => (
          <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#d9d0c3" strokeDasharray="3 3" />
        ))}

        {/* Area fill under curve */}
        {areaPath && <path d={areaPath} fill="url(#master-rev-fill)" />}

        {/* Smooth line */}
        <path d={linePath} fill="none" stroke="#173c32" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive points */}
        {points.map((p, i) => {
          const isActive = i === activeIndex;
          return (
            <g key={p.month} className="master-chart-point">
              {/* Invisible large hover area */}
              <circle
                cx={p.x}
                cy={p.y}
                r="24"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onClick={() => setHoveredIndex(i)}
              />
              {/* Outer halo when active */}
              {isActive && (
                <circle cx={p.x} cy={p.y} r="10" fill="#c9ff3b" opacity="0.35" style={{ pointerEvents: 'none' }} />
              )}
              {/* Main point */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 6 : 4.5}
                fill={isActive ? '#c9ff3b' : '#fffdf8'}
                stroke="#173c32"
                strokeWidth={isActive ? 2.5 : 2}
                style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
              />
            </g>
          );
        })}

        {/* Interactive floating tooltip badge */}
        {activePoint && (
          <g
            transform={`translate(${badgeX}, ${badgeY})`}
            style={{ transition: 'transform 0.12s ease-out', pointerEvents: 'none' }}
          >
            <rect width="90" height="26" rx="8" fill="#071915" />
            <circle cx="12" cy="13" r="3" fill="#c9ff3b" />
            <text x="50" y="17" textAnchor="middle" fill="#fffdf8" fontSize="10" fontWeight="600">
              {activePoint.total >= 1000
                ? `R$ ${(activePoint.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
                : formatBRL(activePoint.total)}
            </text>
          </g>
        )}
      </svg>

      {/* Month buttons below */}
      <div className="master-revenue-months">
        {data.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              type="button"
              key={item.month}
              className={`master-revenue-month-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => setHoveredIndex(index)}
              onMouseEnter={() => setHoveredIndex(index)}
            >
              {month(item.month)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
