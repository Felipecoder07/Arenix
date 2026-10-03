import { useEventCallback } from '../../hooks/useEventCallback';
import { errorMessage } from '../../utils/errorMessage';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Banknote, CreditCard, Ticket, Download, BarChart3, CalendarDays, Grid2X2, AlertTriangle, CalendarX, Clock, Users, SlidersHorizontal } from 'lucide-react';
import { Pagination } from '../../components/ui';
import { AdminTopbar } from '../../components/AdminTopbar';
import { PeakHoursCharts } from '../../components/reports/PeakHoursCharts';
import { ReportOverview } from '../../components/reports/ReportOverview';
import { safeStorage } from '../../utils/safeStorage';
import type { ReportData } from '../../types/reports';
import '../../assets/css/relatorios.css';

const REPORT_TABS = [
  { id: 'faturamento', label: 'Faturamento', icon: BarChart3 },
  { id: 'ocupacao', label: 'Ocupação', icon: Grid2X2 },
  { id: 'reservas', label: 'Reservas', icon: CalendarDays },
  { id: 'inadimplencia', label: 'Inadimplência', icon: AlertTriangle },
  { id: 'cancelamentos', label: 'Cancelamentos', icon: CalendarX },
  { id: 'formas-pagamento', label: 'Formas de Pag.', icon: CreditCard },
  { id: 'horarios-pico', label: 'Horários', icon: Clock },
  { id: 'top-clientes', label: 'Top Clientes', icon: Users },
];

interface Quadra {
  id: number;
  nome: string;
  tipo: string;
}

export function AdminRelatorios() {
  const outlet = useOutletContext<{ onToggleSidebar: () => void } | undefined>();
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  // Dates initialization
  const getTodayStr = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  };

  const getFirstDayStr = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  };

  // State Variables
  const [relAtivo, setRelAtivo] = useState<string>(() => {
    const tab = new URLSearchParams(window.location.search).get('aba') || safeStorage.getItem('courtmanager_rel_ativo');
    return REPORT_TABS.some(item => item.id === tab) ? tab! : 'faturamento';
  });
  const [dataInicio, setDataInicio] = useState<string>(getFirstDayStr());
  const [dataFim, setDataFim] = useState<string>(getTodayStr());
  const [filterQuadraId, setFilterQuadraId] = useState<string | number>('');
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [dadosAtuais, setDadosAtuais] = useState<ReportData | null>(null);
  const [applied, setApplied] = useState({ inicio: dataInicio, fim: dataFim, quadra: '', tab: relAtivo });
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load Quadras
  useEffect(() => {
    const fetchQuadras = async () => {
      try {
        const res = await fetch('/api/quadras', {
          headers: {}
        });
        if (res.ok) {
          const data = await res.json();
          setQuadras(data);
        }
      } catch (e) {
        console.warn('Erro ao carregar quadras:', e);
      }
    };
    fetchQuadras();
  }, []);

  // Handle Generate Report
  const gerarRelatorio = useEventCallback(async (currentTab: string = relAtivo, targetPage: number = currentPage, filters: { inicio: string; fim: string; quadra: string } = { inicio: dataInicio, fim: dataFim, quadra: String(filterQuadraId) }) => {
    if (!filters.inicio || !filters.fim) {
      showToast('Selecione o período.', 'error');
      return;
    }
    if (filters.inicio > filters.fim) {
      showToast('A data inicial deve ser anterior à data final.', 'error');
      return;
    }

    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setErrorMsg(null);
    setDadosAtuais(null);

    const params = new URLSearchParams({ data_inicio: filters.inicio, data_fim: filters.fim });
    if (filters.quadra) params.append('quadra_id', filters.quadra);
    params.append('pagina', String(targetPage));
    params.append('limite', '50');

    try {
      const res = await fetch(`/api/relatorios/${currentTab}?${params}`, {
        headers: {}, signal: request.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar relatório');

      if (request.signal.aborted) return;
      setDadosAtuais(data);
      setApplied({ ...filters, tab: currentTab });
    } catch (e) {
      if (!request.signal.aborted) setErrorMsg(errorMessage(e) || 'Erro de conexão.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  } );

  // Trigger report automatically when tab changes if dates are set
  useEffect(() => {
    safeStorage.setItem('courtmanager_rel_ativo', relAtivo);
    setCurrentPage(1);
    gerarRelatorio(relAtivo, 1);
    document.getElementById(`report-tab-${relAtivo}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [gerarRelatorio, relAtivo]);

  const changePage = (page: number) => {
    setCurrentPage(page);
    gerarRelatorio(relAtivo, page, applied);
  };

  // Export CSV
  const exportarCSV = async () => {
    if (!dadosAtuais) {
      showToast('Gere um relatório primeiro.', 'error');
      return;
    }

    setExporting(true);
    try {
      let exportData = dadosAtuais;
      if (dadosAtuais.paginacao && dadosAtuais.paginacao.totalPaginas > 1) {
        const all: ReportData[] = [];
        let page = 1;
        let pages = 1;
        do {
          const params = new URLSearchParams({ data_inicio: applied.inicio, data_fim: applied.fim, pagina: String(page), limite: '100' });
          if (applied.quadra) params.set('quadra_id', applied.quadra);
          const response = await fetch('/api/relatorios/' + applied.tab + '?' + params);
          const result: ReportData & { error?: string } = await response.json();
          if (!response.ok) throw new Error(result.error || 'Não foi possível exportar o relatório.');
          all.push(result);
          pages = result.paginacao?.totalPaginas || 1;
          page++;
        } while (page <= pages);
        exportData = {
          ...dadosAtuais,
          reservas: all.flatMap(result => result.reservas || []),
          inadimplentes: all.flatMap(result => result.inadimplentes || []),
          cancelamentos: all.flatMap(result => result.cancelamentos || []),
          transacoes: all.flatMap(result => result.transacoes || []),
          clientes: all.flatMap(result => result.clientes || []),
        };
      }
      const rows: string[][] = [];
      const sep = ';';

      if (relAtivo === 'faturamento') {
        rows.push(['Data', 'ID', 'Cliente', 'Quadra', 'Horário', 'Valor Total', 'Pago', 'Saldo', 'Métodos', 'Pagamento', 'Operador']);
        exportData.reservas?.forEach((r) => {
          const saldo = Math.max(0, r.valor_total - r.total_pago);
          rows.push([
            fmtData(r.data_reserva),
            `#${r.id}`,
            r.cliente_nome,
            r.quadra_nome,
            `${r.hora_inicio}-${r.hora_fim}`,
            r.valor_total.toFixed(2),
            r.total_pago.toFixed(2),
            saldo.toFixed(2),
            r.metodos || '',
            r.status_pagamento,
            r.operador_nome || ''
          ]);
        });
      } else if (relAtivo === 'ocupacao') {
        rows.push(['Quadra', 'Reservas', 'Min. Reservados', 'Min. Bloqueados', 'Min. Disponíveis', 'Taxa %']);
        exportData.quadras?.forEach((q) => {
          rows.push([
            q.quadra_nome,
            q.totalReservas.toString(),
            q.minutosReservados.toString(),
            q.minutosBloqueados.toString(),
            q.totalMinutosDisp.toString(),
            q.taxa.toString()
          ]);
        });
      } else if (relAtivo === 'reservas') {
        rows.push(['Data', 'ID', 'Cliente', 'Quadra', 'Horário', 'Valor', 'Status', 'Pagamento', 'Operador']);
        exportData.reservas?.forEach((r) => {
          rows.push([
            fmtData(r.data_reserva),
            `#${r.id}`,
            r.cliente_nome,
            r.quadra_nome,
            `${r.hora_inicio}-${r.hora_fim}`,
            r.valor_total.toFixed(2),
            r.status,
            r.status_pagamento,
            r.operador_nome || ''
          ]);
        });
      } else if (relAtivo === 'inadimplencia') {
        rows.push(['Data', 'ID', 'Cliente', 'Contato', 'Quadra', 'Horário', 'Valor Total', 'Pago', 'Saldo Devedor']);
        exportData.inadimplentes?.forEach((r) => {
          rows.push([
            fmtData(r.data_reserva),
            `#${r.id}`,
            r.cliente_nome,
            r.cliente_contato || '',
            r.quadra_nome,
            `${r.hora_inicio}-${r.hora_fim}`,
            r.valor_total.toFixed(2),
            r.total_pago.toFixed(2),
            r.saldo_devedor.toFixed(2)
          ]);
        });
      } else if (relAtivo === 'cancelamentos') {
        rows.push(['Data', 'ID', 'Cliente', 'Quadra', 'Horário', 'Motivo', 'Observações', 'Valor', 'Pago Antes', 'Status Pag.', 'Operador']);
        exportData.cancelamentos?.forEach((r) => {
          rows.push([
            fmtData(r.data_reserva),
            `#${r.id}`,
            r.cliente_nome,
            r.quadra_nome,
            `${r.hora_inicio}-${r.hora_fim}`,
            r.motivo_cancelamento || 'Não informado',
            r.observacoes_cancelamento || '',
            r.valor_total.toFixed(2),
            r.total_pago.toFixed(2),
            r.status_pagamento,
            r.operador_nome || ''
          ]);
        });
      } else if (relAtivo === 'formas-pagamento') {
        rows.push(['Data', 'Hora', 'Método', 'Valor', 'Cliente', 'Quadra', 'Operador']);
        exportData.transacoes?.forEach(t => rows.push([
          fmtData(t.data_pagamento), t.hora_pagamento || '', t.metodo, t.valor.toFixed(2),
          t.cliente_nome, t.quadra_nome, t.operador_nome || '',
        ]));
      } else if (relAtivo === 'top-clientes') {
        rows.push(['Posição', 'Cliente', 'Contato', 'Reservas', 'Última reserva', 'Faturamento', 'Ticket médio', 'Saldo devedor']);
        exportData.clientes?.forEach(c => rows.push([
          String(c.posicao), c.nome, c.telefone || '', String(c.total_reservas), fmtData(c.ultima_reserva),
          c.valor_total_gerado.toFixed(2), c.ticket_medio.toFixed(2), c.saldo_devedor.toFixed(2),
        ]));
      } else if (relAtivo === 'horarios-pico') {
        rows.push(['Distribuição', 'Faixa', 'Reservas']);
        exportData.porHora?.forEach(h => rows.push(['Horário', `${String(h.hora).padStart(2, '0')}:00`, String(h.total)]));
        exportData.porDiaSemana?.forEach(d => rows.push(['Dia da semana', d.dia, String(d.total)]));
      } else {
        showToast('Este tipo de relatório não suporta exportação direta para CSV.', 'error');
        return;
      }

      const csvContent = '\uFEFF' + rows.map(row => row.map(val => {
        const value = String(val ?? '');
        const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(sep)).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_${relAtivo}_${applied.inicio}_${applied.fim}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Relatório exportado.', 'success');
    } catch (error) {
      showToast(errorMessage(error) || 'Não foi possível exportar o relatório.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Helper Formats
  const moeda = (val: number | undefined) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtData = (dateStr?: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      'Confirmada': 'badge-green',
      'Cancelada': 'badge-red',
      'Cancelado': 'badge-red',
      'Pendente': 'badge-amber',
      'Pago': 'badge-green',
      'Parcial': 'badge-amber',
      'Estornado': 'badge-gray'
    };
    return map[status] || 'badge-gray';
  };

  // Render Specific Views
  const renderFaturamento = () => {
    if (!dadosAtuais) return null;
    const { reservas = [], totais = { bruto: 0, pago: 0, pendente: 0 }, paginacao } = dadosAtuais;

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />
        <div className="table-card">
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Relatório de Faturamento — {fmtData(applied.inicio)} a {fmtData(applied.fim)}</span>
            <span id="table-count">{reservas.length} de {paginacao?.total ?? reservas.length} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Quadra</th>
                  <th>Horário</th>
                  <th>Valor Total</th>
                  <th>Pago</th>
                  <th>Saldo</th>
                  <th>Método</th>
                  <th>Pagamento</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {reservas.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                      Nenhum registro no período.
                    </td>
                  </tr>
                ) : (
                  reservas.map((r) => {
                    const saldo = Math.max(0, r.valor_total - r.total_pago);
                    return (
                      <tr key={r.id}>
                        <td>{fmtData(r.data_reserva)}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '12px' }}>#{r.id}</td>
                        <td>{r.cliente_nome}</td>
                        <td>{r.quadra_nome}</td>
                        <td>{r.hora_inicio}–{r.hora_fim}</td>
                        <td>{moeda(r.valor_total)}</td>
                        <td style={{ color: '#22c55e', fontWeight: 500 }}>{moeda(r.total_pago)}</td>
                        <td style={{ color: saldo > 0 ? 'var(--danger)' : undefined, fontWeight: saldo > 0 ? 500 : undefined }}>
                          {saldo > 0 ? moeda(saldo) : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>{r.metodos || '—'}</td>
                        <td>
                          <span className={`badge ${getBadgeClass(r.status_pagamento)}`}>{r.status_pagamento}</span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{r.operador_nome || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div id="table-footer" style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)', display: 'flex', gap: 'var(--s-6)', flexWrap: 'wrap' }}>
            <span>Total: {moeda(totais.bruto)}</span>
            <span style={{ color: '#22c55e' }}>Recebido: {moeda(totais.pago)}</span>
            <span style={{ color: 'var(--danger)' }}>A receber: {moeda(totais.pendente)}</span>
          </div>
        </div>
      </>
    );
  };

  const renderOcupacao = () => {
    if (!dadosAtuais) return null;
    const { quadras: qList = [], taxaGeral = 0, periodo = { dias: 1 } } = dadosAtuais;
    const totalReservas = qList.reduce((acc: number, curr) => acc + curr.totalReservas, 0);

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />
        <div className="table-card">
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Relatório de Ocupação — {fmtData(applied.inicio)} a {fmtData(applied.fim)}</span>
            <span id="table-count">{qList.length} quadras · {periodo.dias} dias</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quadra</th>
                  <th>Reservas</th>
                  <th>Min. Reservados</th>
                  <th>Min. Bloqueados</th>
                  <th>Min. Disponíveis</th>
                  <th>Taxa de Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {qList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                      Nenhuma quadra monitorada no período.
                    </td>
                  </tr>
                ) : (
                  qList.map((q) => {
                    const barClass = q.taxa >= 75 ? 'high' : q.taxa >= 40 ? 'medium' : '';
                    return (
                      <tr key={q.quadra_nome}>
                        <td><strong>{q.quadra_nome}</strong></td>
                        <td>{q.totalReservas}</td>
                        <td>{q.minutosReservados} min</td>
                        <td>{q.minutosBloqueados} min</td>
                        <td>{q.totalMinutosDisp} min</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, minWidth: '36px' }}>{q.taxa}%</span>
                            <div className="occ-bar-wrap" style={{ flex: 1 }}>
                              <div className={`occ-bar ${barClass}`} style={{ width: `${q.taxa}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div id="table-footer" style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)' }}>
            <span>Taxa geral de ocupação no período: {taxaGeral}%</span>
            <span>{totalReservas} reservas monitoradas</span>
          </div>
        </div>
      </>
    );
  };

  const renderReservas = () => {
    if (!dadosAtuais) return null;
    const { reservas = [], totais = { total: 0, confirmadas: 0, canceladas: 0, pendentes: 0 } } = dadosAtuais;

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />
        <div className="table-card">
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Relatório de Reservas — {fmtData(applied.inicio)} a {fmtData(applied.fim)}</span>
            <span id="table-count">{totais.total} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Quadra</th>
                  <th>Horário</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {reservas.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                      Nenhum registro encontrado no período.
                    </td>
                  </tr>
                ) : (
                  reservas.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtData(r.data_reserva)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>#{r.id}</td>
                      <td>{r.cliente_nome}</td>
                      <td>{r.quadra_nome}</td>
                      <td>{r.hora_inicio}–{r.hora_fim}</td>
                      <td>{moeda(r.valor_total)}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status_pagamento)}`}>{r.status_pagamento}</span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{r.operador_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div id="table-footer" style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)', display: 'flex', gap: 'var(--s-6)', flexWrap: 'wrap' }}>
            <span>Total: {totais.total}</span>
            <span style={{ color: '#22c55e' }}>Confirmadas: {totais.confirmadas}</span>
            <span style={{ color: 'var(--danger)' }}>Canceladas: {totais.canceladas}</span>
            <span style={{ color: 'var(--pending)' }}>Pendentes: {totais.pendentes}</span>
          </div>
        </div>
      </>
    );
  };

  const renderInadimplencia = () => {
    if (!dadosAtuais) return null;
    const { inadimplentes = [], totalDevido = 0, paginacao } = dadosAtuais;

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />
        <div className="table-card">
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Relatório de Inadimplência — {fmtData(applied.inicio)} a {fmtData(applied.fim)}</span>
            <span id="table-count">{inadimplentes.length} de {paginacao?.total ?? inadimplentes.length} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Quadra</th>
                  <th>Horário</th>
                  <th>Valor Total</th>
                  <th>Pago</th>
                  <th>Saldo Devedor</th>
                  <th>Status Pag.</th>
                </tr>
              </thead>
              <tbody>
                {inadimplentes.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: '#22c55e', padding: '40px', fontWeight: 600 }}>
                      ✓ Nenhuma inadimplência no período!
                    </td>
                  </tr>
                ) : (
                  inadimplentes.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtData(r.data_reserva)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>#{r.id}</td>
                      <td>{r.cliente_nome}</td>
                      <td style={{ fontSize: '12px' }}>{r.cliente_contato || '—'}</td>
                      <td>{r.quadra_nome}</td>
                      <td>{r.hora_inicio}–{r.hora_fim}</td>
                      <td>{moeda(r.valor_total)}</td>
                      <td style={{ color: '#22c55e', fontWeight: 500 }}>{moeda(r.total_pago)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{moeda(r.saldo_devedor)}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status_pagamento)}`}>{r.status_pagamento}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div id="table-footer" style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)' }}>
            <span style={{ color: 'var(--danger)' }}>Total inadimplente: {moeda(totalDevido)}</span>
            <span>Devedores: {dadosAtuais.totalDevedores ?? '—'}</span>
          </div>
        </div>
      </>
    );
  };

  const renderCancelamentos = () => {
    if (!dadosAtuais) return null;
    const { cancelamentos = [], totais = { total: 0, valorPerdido: 0, estornados: 0 } } = dadosAtuais;

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />

        <div className="table-card">
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Relatório de Cancelamentos — {fmtData(applied.inicio)} a {fmtData(applied.fim)}</span>
            <span id="table-count">{cancelamentos.length} de {dadosAtuais.paginacao?.total ?? totais.total ?? cancelamentos.length} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Quadra</th>
                  <th>Horário</th>
                  <th>Motivo</th>
                  <th>Valor</th>
                  <th>Pago antes</th>
                  <th>Status Pag.</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {cancelamentos.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: '#22c55e', padding: '40px', fontWeight: 600 }}>
                      ✓ Nenhum cancelamento no período!
                    </td>
                  </tr>
                ) : (
                  cancelamentos.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtData(r.data_reserva)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>#{r.id}</td>
                      <td>{r.cliente_nome}</td>
                      <td>{r.quadra_nome}</td>
                      <td>{r.hora_inicio}–{r.hora_fim}</td>
                      <td>
                        <span 
                          className="badge badge-gray" 
                          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'inline-block' }}
                          title={r.observacoes_cancelamento || ''}
                        >
                          {r.motivo_cancelamento || 'Não informado'}
                        </span>
                      </td>
                      <td>{moeda(r.valor_total)}</td>
                      <td style={{ color: '#22c55e' }}>{moeda(r.total_pago)}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status_pagamento)}`}>{r.status_pagamento}</span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{r.operador_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div id="table-footer" style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)' }}>
            <span>Total cancelamentos: {totais.total}</span>
            <span style={{ color: 'var(--danger)', marginLeft: '20px' }}>Valor perdido: {moeda(totais.valorPerdido)}</span>
          </div>
        </div>
      </>
    );
  };

  const renderMethodIcon = (method: string) => {
    const lower = method.toLowerCase();
    const iconStyle = { marginRight: '8px', width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle' };
    
    if (lower === 'pix') {
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" style={{ ...iconStyle, fill: 'none', stroke: '#32bcad', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
          <path d="M12 7l-5 5 5 5 5-5-5-5z" />
        </svg>
      );
    }
    if (lower === 'dinheiro') {
      return <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center' }}><Banknote style={iconStyle} /></span>;
    }
    if (lower === 'credito' || lower === 'debito' || lower.includes('cartao') || lower.includes('cartão')) {
      return <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center' }}><CreditCard style={iconStyle} /></span>;
    }
    if (lower === 'voucher') {
      return <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center' }}><Ticket style={iconStyle} /></span>;
    }
    return <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}><CreditCard style={iconStyle} /></span>;
  };

  const renderFormasPagamento = () => {
    if (!dadosAtuais) return null;
    const { porMetodo = [], transacoes = [], paginacao } = dadosAtuais;

    const methodColor = (method: string) => {
      const name = method.toLowerCase();
      if (name === 'pix') return '#00a86b';
      if (name === 'dinheiro' || name === 'voucher') return '#f59e0b';
      if (name.includes('pix')) return '#d92d20';
      return '#2e5bff';
    };

    const getFriendlyMethodName = (m: string) => {
      const lower = m.toLowerCase();
      if (lower === 'pix') return 'Pix';
      if (lower === 'dinheiro') return 'Dinheiro';
      if (lower === 'credito') return 'Cartão de Crédito';
      if (lower === 'debito') return 'Cartão de Débito';
      if (lower === 'voucher') return 'Voucher Interno';
      if (lower === 'pix_online') return 'Pix online';
      if (lower === 'cartao_maquina') return 'Cartão máquina';
      return m.charAt(0).toUpperCase() + m.slice(1);
    };

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />

        {porMetodo.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '20px 0' }}>Nenhum pagamento no período.</p>
        ) : (
          <div className="pag-method-grid">
            {porMetodo.map((m) => (
              <div className="pag-method-card" key={m.metodo}>
                <div className="pag-method-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderMethodIcon(m.metodo)}
                  <span>{getFriendlyMethodName(m.metodo)}</span>
                </div>
                <div className="pag-method-valor">{moeda(m.total_valor)}</div>
                <div className="pag-method-sub">
                  {m.total_transacoes} transações · {m.percentual}% do total
                </div>
                <div 
                  className="pag-percent-bar" 
                  style={{ 
                    width: `${Math.min(100, Math.max(0, m.percentual))}%`,
                    background: methodColor(m.metodo)
                  }} 
                />
              </div>
            ))}
          </div>
        )}

        <div className="table-card" style={{ marginTop: 'var(--s-4)' }}>
          <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="table-title">Histórico de Transações</span>
            <span id="table-count">{transacoes.length} de {paginacao?.total ?? transacoes.length} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th>Cliente</th>
                  <th>Quadra</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px' }}>
                      Nenhuma transação registrada.
                    </td>
                  </tr>
                ) : (
                  transacoes.map((t, idx: number) => (
                    <tr key={idx}>
                      <td>{fmtData(t.data_pagamento)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{t.hora_pagamento || ''}</td>
                      <td>
                        <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                          {getFriendlyMethodName(t.metodo)}
                        </span>
                      </td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{moeda(t.valor)}</td>
                      <td>{t.cliente_nome}</td>
                      <td>{t.quadra_nome}</td>
                      <td style={{ fontSize: '12px' }}>{t.operador_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderHorariosPico = () => {
    if (!dadosAtuais) return null;
    return <>
      <ReportOverview tab={relAtivo} data={dadosAtuais} />
      <PeakHoursCharts data={dadosAtuais} />
    </>;
  };

  const renderTopClientes = () => {
    if (!dadosAtuais) return null;
    const { clientes = [], paginacao } = dadosAtuais;

    const rankIcon = (pos: number) => {
      if (pos === 1) return <span className="client-rank gold">★</span>;
      if (pos === 2) return <span className="client-rank silver">★</span>;
      if (pos === 3) return <span className="client-rank bronze">★</span>;
      return <span className="client-rank">#{pos}</span>;
    };

    return (
      <>
        <ReportOverview tab={relAtivo} data={dadosAtuais} />

        <div className="table-card report-client-ranking">
          <div className="report-ranking-heading">
            <span id="table-title">Ranking de Clientes</span>
            <span id="table-count">Ordenado por faturamento no período · {paginacao?.total ?? clientes.length} clientes</span>
          </div>
          <div className="report-ranking-list">
            {clientes.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '20px', fontSize: '13px' }}>
                Nenhum cliente com reservas no período.
              </p>
            ) : (
              clientes.map((c) => (
                <div className="top-client-row" key={c.posicao}>
                  {rankIcon(c.posicao)}
                  <div className="client-info">
                    <div className="client-name">{c.nome}</div>
                    <div className="client-sub">
                      {c.total_reservas} reserva{c.total_reservas !== 1 ? 's' : ''} · Última: {fmtData(c.ultima_reserva)} · {c.telefone || 'Sem contato'}
                    </div>
                  </div>
                  <div className="client-stats">
                    <div className="client-valor">{moeda(c.valor_total_gerado)}</div>
                    <div className="client-reservas">
                      Ticket médio {moeda(c.ticket_medio)}
                      {c.saldo_devedor > 0 && (
                        <> · <span style={{ color: 'var(--danger)' }}>Deve {moeda(c.saldo_devedor)}</span></>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="p-8 text-center text-muted">
          <div className="spinner" />
          Carregando dados...
        </div>
      );
    }

    if (errorMsg) {
      return (
        <div className="empty-state" role="alert">
          <div className="icon">⚠️</div>
          <p>{errorMsg}</p>
          <button className="report-generate" style={{ marginTop: 16 }} onClick={() => gerarRelatorio(relAtivo, 1)}>Tentar novamente</button>
        </div>
      );
    }

    if (!dadosAtuais) {
      return (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>Selecione o período e clique em <strong>Gerar Relatório</strong></p>
        </div>
      );
    }

    switch (relAtivo) {
      case 'faturamento':
        return renderFaturamento();
      case 'ocupacao':
        return renderOcupacao();
      case 'reservas':
        return renderReservas();
      case 'inadimplencia':
        return renderInadimplencia();
      case 'cancelamentos':
        return renderCancelamentos();
      case 'formas-pagamento':
        return renderFormasPagamento();
      case 'horarios-pico':
        return renderHorariosPico();
      case 'top-clientes':
        return renderTopClientes();
      default:
        return null;
    }
  };

  const showExportBtn = REPORT_TABS.some(tab => tab.id === relAtivo);

  const selectTab = (tab: string) => {
    if (tab === relAtivo) return;
    requestRef.current?.abort();
    setDadosAtuais(null);
    setErrorMsg(null);
    setLoading(false);
    setRelAtivo(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('aba', tab);
    window.history.replaceState({}, '', url);
  };

  return (
    <div className="admin-relatorios-page">
      <AdminTopbar
        onToggleSidebar={() => outlet?.onToggleSidebar()}
        customTitle={<div className="report-heading"><p>Análises / {REPORT_TABS.find(tab => tab.id === relAtivo)?.label}</p><h1>Relatórios</h1></div>}
        actions={showExportBtn && <button className="report-export" onClick={exportarCSV} disabled={loading || exporting || !dadosAtuais} title="Exportar todos os registros do relatório em CSV"><Download size={15} />{exporting ? 'Exportando...' : 'Exportar relatório'}</button>}
      />

      {toast && <div role="status" className={`report-toast ${toast.type}`}>{toast.message}</div>}

      <div className="report-tabs" role="tablist" aria-label="Tipos de relatório">
        {REPORT_TABS.map(({ id, label, icon: Icon }, index) => <button
          key={id} type="button" id={`report-tab-${id}`} role="tab"
          aria-selected={relAtivo === id} aria-controls="report-content"
          tabIndex={relAtivo === id ? 0 : -1}
          className={relAtivo === id ? 'active' : ''}
          onClick={() => selectTab(id)}
          onKeyDown={event => {
            const target = event.key === 'ArrowRight' ? (index + 1) % REPORT_TABS.length
              : event.key === 'ArrowLeft' ? (index + REPORT_TABS.length - 1) % REPORT_TABS.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? REPORT_TABS.length - 1 : -1;
            if (target < 0) return;
            event.preventDefault();
            selectTab(REPORT_TABS[target].id);
            document.getElementById('report-tab-' + REPORT_TABS[target].id)?.focus();
          }}
        ><Icon size={15} aria-hidden="true" />{label}</button>)}
      </div>

      <form className="report-filters" onSubmit={event => { event.preventDefault(); setCurrentPage(1); gerarRelatorio(relAtivo, 1); }}>
        <label htmlFor="rel-inicio">De<input required type="date" id="rel-inicio" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></label>
        <label htmlFor="rel-fim">Até<input required type="date" id="rel-fim" value={dataFim} min={dataInicio} onChange={e => setDataFim(e.target.value)} /></label>
        <label htmlFor="rel-quadra">Quadra<select id="rel-quadra" value={filterQuadraId} onChange={e => setFilterQuadraId(e.target.value)}>
          <option value="">Todas as quadras</option>
          {quadras.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </select></label>
        <button type="submit" className="report-generate" disabled={loading}><SlidersHorizontal size={15} />{loading ? 'Gerando...' : 'Gerar Relatório'}</button>
      </form>

      <section id="report-content" role="tabpanel" aria-labelledby={`report-tab-${relAtivo}`} aria-busy={loading}>
        {renderContent()}
      </section>
      {!loading && dadosAtuais?.paginacao && (
        <Pagination page={dadosAtuais.paginacao.pagina} totalPages={dadosAtuais.paginacao.totalPaginas} onPage={changePage} />
      )}
    </div>
  );
}
