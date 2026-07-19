import { useEffect, useState } from 'react';
import '../../assets/css/auditoria.css';

interface AuditLog {
  id: number;
  evento: string;
  usuario_nome: string | null;
  detalhes: string;
  ip: string | null;
  criado_em: string;
}

export function AdminAuditoria() {
  const [token] = useState<string>(() => localStorage.getItem('courtmanager_token') || '');

  // Filter States
  const [busca, setBusca] = useState('');
  const [evento, setEvento] = useState('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Table & Pagination States
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [exporting, setExporting] = useState(false);

  const getBadgeClass = (evtName: string) => {
    const ev = evtName.toLowerCase();
    if (ev.includes('login')) return 'log-badge log-login';
    if (ev.includes('reserva')) return 'log-badge log-reserva';
    if (ev.includes('pagamento')) return 'log-badge log-pagamento';
    if (ev.includes('cancelamento') || ev.includes('exclusão')) return 'log-badge log-cancelamento';
    if (ev.includes('bloqueio')) return 'log-badge log-bloqueio';
    return 'log-badge log-permissao';
  };

  const formatDateTime = (isoString: string) => {
    const normalizedString = isoString.includes('T') ? isoString : isoString.replace(' ', 'T') + 'Z';
    const d = new Date(normalizedString);
    if (isNaN(d.getTime())) return isoString;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} · ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const carregarLogs = async (resetPage = false) => {
    if (!token) return;
    setLoading(true);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const url = new URL('http://localhost:3000/api/auditoria');
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', dataFim);
      url.searchParams.append('pagina', String(targetPage));
      if (busca) url.searchParams.append('busca', busca);
      if (evento) url.searchParams.append('evento', evento);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('courtmanager_token');
          window.location.href = '/login';
          return;
        }
        throw new Error('Erro ao buscar logs');
      }

      const payload = await res.json();
      const logsList = Array.isArray(payload) ? payload : (payload.logs || []);
      const totalRegs = payload.totalRegistros || logsList.length;
      const totalPags = payload.totalPaginas || 1;

      setLogs(logsList);
      setTotalRegistros(totalRegs);
      setTotalPaginas(totalPags);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Load logs triggers
  useEffect(() => {
    carregarLogs(true);
  }, [evento, dataInicio, dataFim]);

  // Debounced search text trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      carregarLogs(true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [busca]);

  // Manual page change trigger
  useEffect(() => {
    carregarLogs(false);
  }, [currentPage]);

  const handleExportCSV = async () => {
    if (!token) return;
    setExporting(true);

    try {
      const url = new URL('http://localhost:3000/api/auditoria');
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', dataFim);
      url.searchParams.append('exportar', 'true');
      if (busca) url.searchParams.append('busca', busca);
      if (evento) url.searchParams.append('evento', evento);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro na exportação');

      const logsList: AuditLog[] = await res.json();

      if (logsList.length === 0) {
        alert('Não há dados válidos para exportar neste período.');
        setExporting(false);
        return;
      }

      let csvContent = "Data/Hora,Evento,Usuário,Detalhes,IP\n";

      logsList.forEach(log => {
        const dateStr = formatDateTime(log.criado_em);
        const evName = log.evento;
        const userName = log.usuario_nome || 'Sistema';
        const details = log.detalhes ? log.detalhes.replace(/"/g, '""') : '';
        const ipStr = log.ip || '';
        csvContent += `"${dateStr}","${evName}","${userName}","${details}","${ipStr}"\n`;
      });

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const todayStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `auditoria_voleisystem_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao gerar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-auditoria-page">
      {/* Aviso de acesso restrito */}
      <div 
        style={{
          background: 'var(--partial-bg)',
          border: '1px solid rgba(33,85,168,0.2)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3) var(--s-5)',
          fontSize: '13px',
          color: 'var(--partial)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-3)',
          marginBottom: 'var(--s-5)'
        }}
      >
        <span style={{ fontSize: '16px' }}>🔒</span>
        <span>
          Esta seção é restrita ao perfil <strong>Administrador</strong>. Todos os registros são imutáveis e retidos por 5 anos (RF-LOG-021 / RN-009).
        </span>
      </div>

      {/* Toolbar */}
      <div className="page-toolbar flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="filter-bar flex-wrap">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por usuário ou evento..." 
            style={{ width: '240px' }} 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar nos logs" 
          />
          <select 
            style={{ width: 'auto', minWidth: '180px' }} 
            value={evento}
            onChange={(e) => setEvento(e.target.value)}
            aria-label="Tipo de evento"
          >
            <option value="">Todos os eventos</option>
            <option>Login</option>
            <option>Logout</option>
            <option>Criação de reserva</option>
            <option>Alteração de reserva</option>
            <option>Cancelamento de reserva</option>
            <option>Registro de pagamento</option>
            <option>Aplicação de desconto</option>
            <option>Estorno de pagamento</option>
            <option>Alteração de preço</option>
            <option>Bloqueio de quadra</option>
            <option>Alteração de permissões</option>
            <option>Exclusão de cadastro</option>
            <option>Exportação de relatório</option>
          </select>
          <div>
            <input 
              type="date" 
              style={{ width: 'auto' }} 
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              aria-label="Data inicial" 
            />
          </div>
          <div>
            <input 
              type="date" 
              style={{ width: 'auto' }} 
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              aria-label="Data final" 
            />
          </div>
        </div>
        <button 
          className="btn-ghost" 
          onClick={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? 'Gerando CSV...' : '↓ Exportar CSV'}
        </button>
      </div>

      {/* Tabela de logs */}
      <div className="table-card">
        <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Logs de Auditoria</span>
        </div>
        <div className="table-wrap">
          <table aria-label="Logs de auditoria">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Evento</th>
                <th>Usuário</th>
                <th>Detalhes</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                    Carregando logs de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                    Nenhum log encontrado neste período.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {formatDateTime(log.criado_em)}
                    </td>
                    <td>
                      <span className={getBadgeClass(log.evento)}>{log.evento}</span>
                    </td>
                    <td>{log.usuario_nome || 'Sistema'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{log.detalhes}</td>
                    <td>
                      <span className="ip-tag">{log.ip || '—'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        <div style={{ padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--border-passive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Exibindo {totalRegistros} resultados
          </span>
          <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginRight: '8px' }}>
              Página {currentPage} de {totalPaginas}
            </span>
            <button 
              className="btn-ghost btn-sm" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
            >
              ‹ Anterior
            </button>
            <button 
              className="btn-ghost btn-sm" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPaginas))}
              disabled={currentPage >= totalPaginas}
            >
              Próxima ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
