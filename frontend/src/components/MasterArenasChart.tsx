import { BarChart } from '@mui/x-charts';

interface Props {
  data: Array<{ month: string; count: number }>;
}

export function MasterArenasChart({ data }: Readonly<Props>) {
  const formatMonth = (value: string, full = false) => {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return value;
    return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
      month: full ? 'long' : 'short',
      ...(full ? { year: 'numeric' as const } : {}),
    }).replace('.', '');
  };

  return (
    <div className="master-arenas-chart">
      <BarChart
        dataset={data}
        xAxis={[{
          scaleType: 'band',
          dataKey: 'month',
          tickPlacement: 'middle',
          tickLabelPlacement: 'middle',
          valueFormatter: (value: string, context) => formatMonth(value, context.location === 'tooltip'),
        }]}
        yAxis={[{ label: 'Novas arenas', width: 60, min: 0, tickMinStep: 1 }]}
        series={[{
          dataKey: 'count',
          label: 'Novas arenas',
          color: '#173C32',
          valueFormatter: (value) => value === null ? 'Sem dados' : `${value.toLocaleString('pt-BR')} ${value === 1 ? 'arena' : 'arenas'}`,
        }]}
        height={300}
        margin={{ left: 0, right: 12, top: 20, bottom: 0 }}
        grid={{ horizontal: true }}
        hideLegend
        borderRadius={5}
        sx={{
          fontFamily: 'Inter, system-ui, sans-serif',
          '& .MuiChartsAxis-tickLabel': { fill: '#66706B', fontSize: 11, fontFamily: 'inherit' },
          '& .MuiChartsAxis-label': { fill: '#43504A', fontSize: 12, fontFamily: 'inherit' },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: '#C8C0B4' },
          '& .MuiChartsGrid-line': { stroke: '#D9D0C3', strokeDasharray: '3 3' },
        }}
      />
    </div>
  );
}
