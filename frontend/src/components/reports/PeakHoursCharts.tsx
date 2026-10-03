import type { ReportData } from '../../types/reports';

export function PeakHoursCharts({ data }: { data: ReportData }) {
  const hours = data.porHora || [];
  const days = data.porDiaSemana || [];
  const maxHour = Math.max(0, ...hours.map(item => item.total));
  const maxDay = Math.max(0, ...days.map(item => item.total));
  const peak = hours.find(item => item.total === maxHour && item.total > 0);
  const bestDay = days.find(item => item.total === maxDay && item.total > 0);
  const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

  return <div className="report-peak-charts">
    <section className="report-chart" aria-label="Reservas por Horário">
      <div className="report-chart-heading">
        <div><h2>Reservas por Horário</h2><p>Volume de reservas em cada faixa horária</p></div>
        {peak && <span className="report-chart-badge red">Pico {hourLabel(peak.hora)}</span>}
      </div>
      {maxHour === 0 ? <p className="report-chart-empty">Sem reservas no período.</p> :
        <div className="report-hour-scroll" tabIndex={0} role="region" aria-label="Gráfico por horário; role para ver todos os horários">
          <div className="report-hour-columns">
            {hours.map(hour => {
              const ratio = hour.total / maxHour;
              const tone = ratio >= .8 ? 'red' : ratio >= .5 ? 'amber' : 'green';
              return <div className={`report-hour-column ${tone}`} key={hour.hora} aria-label={`${hourLabel(hour.hora)}: ${hour.total} reservas`}>
                <strong>{hour.total}</strong>
                <div className="report-hour-bar" style={{ height: `${ratio * 210}px` }} />
                <span>{hourLabel(hour.hora)}</span>
              </div>;
            })}
          </div>
        </div>}
    </section>
    <section className="report-chart" aria-label="Reservas por Dia da Semana">
      <div className="report-chart-heading">
        <div><h2>Reservas por Dia da Semana</h2><p>Distribuição de demanda semanal</p></div>
        {bestDay && <span className="report-chart-badge green">{bestDay.dia} em alta</span>}
      </div>
      {maxDay === 0 ? <p className="report-chart-empty">Sem reservas no período.</p> :
        <div className="report-week-bars">
          {days.map(day => <div className="report-week-row" key={day.dia} aria-label={`${day.dia}: ${day.total} reservas`}>
            <span className={`report-day-pill ${day.total === maxDay ? 'active' : ''}`}>{day.dia}</span>
            <div className="report-day-track"><div style={{ width: `${day.total / maxDay * 100}%` }} /></div>
            <strong>{day.total}</strong>
          </div>)}
        </div>}
    </section>
  </div>;
}
