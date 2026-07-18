interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function LineChart({ data, height = 220, color = '#1c1c1c', formatValue = (v) => String(v) }: LineChartProps) {
  const width = 760;
  const pad = { top: 20, right: 16, bottom: 28, left: 44 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value)) * 1.15 || 1;
  const min = 0;
  const step = w / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: pad.left + i * step,
    y: pad.top + h - ((d.value - min) / (max - min)) * h,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${pad.top + h} L ${points[0].x} ${pad.top + h} Z`;

  const gridLines = 4;
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = (max / gridLines) * i;
    return { y: pad.top + h - (v / max) * h, v };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px]" style={{ height }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} stroke="#eceae4" strokeWidth="1" />
            <text x={pad.left - 8} y={t.y + 3} textAnchor="end" fontSize="10" fill="#5f5f5d" className="tabular">
              {formatValue(Math.round(t.v))}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
        {points.map((p, i) => (
          <g key={i} className="group">
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fcfbf8" stroke={color} strokeWidth="2" />
            <rect x={p.x - step / 2} y={pad.top} width={step} height={h} fill="transparent" />
            <text x={p.x} y={pad.top + h + 18} textAnchor="middle" fontSize="10" fill="#5f5f5d">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
