import { DatePicker } from '../../components/ui/date-picker';
import { ArenaPortalButton } from '../../components/ArenaPortalButton';
import { useEventCallback } from '../../hooks/useEventCallback';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Bell,
  LockKeyhole,
  ListChecks,
  LogIn,
  BadgeDollarSign,
  Database,
  Search,
  ChevronDown,
  Check,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getStoredUser } from '../../utils/session';
import type { Announcement } from '../../types/api';

interface AuditLog {
  id: number;
  evento: string;
  usuario_nome: string | null;
  detalhes: string;
  ip: string | null;
  criado_em: string;
}

interface AuditStats {
  total: number;
  acessos: number;
  financeiro: number;
  cadastrais: number;
}

const EVENT_CATEGORIES = [
  {
    category: 'Acessos & Segurança',
    items: [
      { label: 'Login & Tentativas', value: 'Login' },
      { label: 'Logout', value: 'Logout' },
    ],
  },
  {
    category: 'Reservas & Bloqueios',
    items: [
      { label: 'Criação de reserva', value: 'Criação de reserva' },
      { label: 'Alteração de reserva', value: 'Alteração de reserva' },
      { label: 'Cancelamento de reserva', value: 'Cancelamento de reserva' },
      { label: 'Bloqueio de quadra', value: 'Bloqueio de quadra' },
    ],
  },
  {
    category: 'Financeiro',
    items: [
      { label: 'Registro de pagamento', value: 'Registro de pagamento' },
      { label: 'Aplicação de desconto', value: 'Aplicação de desconto' },
      { label: 'Estorno de pagamento', value: 'Estorno de pagamento' },
    ],
  },
  {
    category: 'Cadastros & Configurações',
    items: [
      { label: 'Gestão de Quadras', value: 'Gestão de Quadras' },
      { label: 'Gestão de Usuários', value: 'Gestão de Usuários' },
      { label: 'Gestão de Clientes', value: 'Gestão de Clientes' },
      { label: 'Exclusões & Arquivamentos', value: 'Exclusão de cadastro' },
    ],
  },
  {
    category: 'Relatórios',
    items: [
      { label: 'Exportação de relatório', value: 'Exportação de relatório' },
    ],
  },
];

export function AdminAuditoria() {
  // Usuário e Arena
  const user = getStoredUser();
  const userName = user?.nome || 'fefe';
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Estados de Filtro
  const [busca, setBusca] = useState('');
  const [evento, setEvento] = useState('');
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const eventDropdownRef = useRef<HTMLDivElement>(null);

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Tabela, Estatísticas e Paginação
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    acessos: 0,
    financeiro: 0,
    cadastrais: 0,
  });

  // Carregar dados de arena e notificações
  useEffect(() => {


    fetch('/api/auth/comunicados/ativos', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(() => {});
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(e.target as Node)) {
        setEventDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getSelectedEventLabel = () => {
    if (!evento) return 'Todos os eventos';
    for (const cat of EVENT_CATEGORIES) {
      const found = cat.items.find((i) => i.value === evento);
      if (found) return found.label;
    }
    return evento;
  };

  const getBadgeStyle = (evtName: string) => {
    const ev = (evtName || '').toLowerCase();
    if (
      ev.includes('cadastro') ||
      ev.includes('administrador') ||
      ev.includes('permissão') ||
      ev.includes('configura')
    ) {
      return { bg: 'bg-[#FFF3D9]', text: 'text-[#A85B00]' };
    }
    if (
      ev.includes('login') ||
      ev.includes('logout') ||
      ev.includes('cliente') ||
      ev.includes('quadra') ||
      ev.includes('usuário')
    ) {
      return { bg: 'bg-[#EEF3FF]', text: 'text-[#2563EB]' };
    }
    if (
      ev.includes('cancelamento') ||
      ev.includes('exclusão') ||
      ev.includes('estorno') ||
      ev.includes('remover')
    ) {
      return { bg: 'bg-[#EAF8EF]', text: 'text-[#008A5A]' };
    }
    if (ev.includes('reserva') || ev.includes('pagamento') || ev.includes('bloqueio')) {
      return { bg: 'bg-[#EAF8EF]', text: 'text-[#008A5A]' };
    }
    return { bg: 'bg-[#F1EDE6]', text: 'text-[#071915]' };
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '—';
    const normalizedString = isoString.includes('T') ? isoString : isoString.replace(' ', 'T') + 'Z';
    const d = new Date(normalizedString);
    if (isNaN(d.getTime())) return isoString;
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const ano = d.getFullYear();
    const hora = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${ano} · ${hora}:${min}`;
  };

  const carregarLogs = useEventCallback(async (resetPage = false) => {
    setLoading(true);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const url = new URL('/api/auditoria', window.location.origin);
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', dataFim);
      url.searchParams.append('pagina', String(targetPage));
      if (busca) url.searchParams.append('busca', busca);
      if (evento) url.searchParams.append('evento', evento);

      const res = await fetch(url.toString(), {
        headers: {},
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (res.status === 403) {
          throw new Error('Acesso negado para este perfil.');
        }
        throw new Error('Erro ao buscar logs');
      }

      const payload = await res.json();
      const logsList = Array.isArray(payload) ? payload : payload.logs || [];
      const totalRegs = payload.totalRegistros !== undefined ? payload.totalRegistros : logsList.length;
      const totalPags = payload.totalPaginas !== undefined ? payload.totalPaginas : 1;

      setLogs(logsList);
      setTotalRegistros(totalRegs);
      setTotalPaginas(totalPags);
      if (payload.estatisticas) {
        setStats(payload.estatisticas);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  });

  // Disparo dos filtros
  useEffect(() => {
    carregarLogs(true);
  }, [evento, dataInicio, dataFim, carregarLogs]);

  // Debounced search text trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      carregarLogs(true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [busca, carregarLogs]);

  // Mudança de página
  useEffect(() => {
    carregarLogs(false);
  }, [carregarLogs, currentPage]);

  const handleExportCSV = async () => {
    setExporting(true);

    try {
      const url = new URL('/api/auditoria', window.location.origin);
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', dataFim);
      url.searchParams.append('exportar', 'true');
      if (busca) url.searchParams.append('busca', busca);
      if (evento) url.searchParams.append('evento', evento);

      const res = await fetch(url.toString(), {
        headers: {},
      });
      if (!res.ok) throw new Error('Erro na exportação');

      const logsList: AuditLog[] = await res.json();

      if (logsList.length === 0) {
        alert('Não há dados válidos para exportar neste período.');
        setExporting(false);
        return;
      }

      let csvContent = 'Data/Hora,Evento,Usuário,Detalhes,IP\n';

      logsList.forEach((log) => {
        const dateStr = formatDateTime(log.criado_em);
        const evName = log.evento;
        const uName = log.usuario_nome || 'Sistema';
        const details = log.detalhes ? log.detalhes.replace(/"/g, '""') : '';
        const ipStr = log.ip || '';
        csvContent += `"${dateStr}","${evName}","${uName}","${details}","${ipStr}"\n`;
      });

      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const todayStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `auditoria_courtmanager_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Recarrega os logs para refletir o log da própria exportação
      setTimeout(() => carregarLogs(false), 800);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao gerar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      data-pencil-name="Auditoria"
      className="box-border w-full flex flex-col gap-[18px] justify-start items-start font-[Inter,system-ui,sans-serif]"
    >
      {/* Cabeçalho Auditoria */}
      <div
        data-pencil-name="Cabeçalho Auditoria"
        className="box-border w-full h-[70px] shrink-0 flex flex-row gap-0 justify-between items-center"
      >
        <div
          data-pencil-name="Título Auditoria Grupo"
          className="box-border w-fit shrink-0 h-fit flex flex-col gap-[6px] justify-start items-start"
        >
          <div
            data-pencil-name="Breadcrumb Auditoria"
            className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
          >
            Segurança / Auditoria
          </div>
          <div
            data-pencil-name="Título Auditoria"
            className="text-[28px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
          >
            Auditoria
          </div>
        </div>

        <div
          data-pencil-name="Ações Cabeçalho Auditoria"
          className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
        >
          {/* Botão Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting}
            data-pencil-name="Exportar Logs Auditoria"
            className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD6CA] -outline-offset-1 rounded-[10px] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download size={16} className="text-[#071915]" />
            <div
              data-pencil-name="Texto Exportar Auditoria"
              className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </div>
          </button>

          {/* Acesso Usuário Auditoria */}
          <div
            data-pencil-name="Acesso usuário Auditoria"
            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
          >
            {/* Portal do Cliente Pill */}
            <ArenaPortalButton />

            {/* Usuário logado */}
            <div
              data-pencil-name="Usuário logado Auditoria"
              className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[11px] justify-start items-center bg-[#F1EDE6] rounded-[17px]"
            >
              <div
                data-pencil-name="Status online Auditoria"
                className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full"
              />
              <div
                data-pencil-name="Nome usuário Auditoria"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                {userName}
              </div>
            </div>

            {/* Notificações */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                data-pencil-name="Notificações Auditoria"
                className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] relative flex items-center justify-center hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                title="Notificações"
              >
                <Bell size={16} className="text-[#071915]" />
                {notifications.length > 0 && (
                  <div
                    data-pencil-name="Bolinha notificação Auditoria"
                    className="box-border w-[7px] h-[7px] absolute right-[7px] top-[7px] bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] -outline-offset-1 rounded-full"
                  />
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] bg-white outline outline-1 outline-[#DED6CA] rounded-[12px] shadow-[0_12px_28px_-4px_rgba(28,26,24,0.14)] p-3 z-50">
                  <div className="text-[12px] font-bold text-[#071915] mb-2 pb-1 border-b border-[#F0EBE4]">
                    Comunicados da Arena
                  </div>
                  {notifications.length === 0 ? (
                    <div className="text-[11px] text-[#6F766F] py-2 text-center">Nenhum novo aviso no momento.</div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="text-[11px] text-[#071915] bg-[#F8FAF9] p-2 rounded-[6px]">
                          {n.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Aviso Segurança Auditoria */}
      <div
        data-pencil-name="Aviso Segurança Auditoria"
        className="box-border w-full h-[56px] shrink-0 flex flex-row gap-[12px] px-[18px] justify-start items-center bg-[#EEF6FF] outline outline-1 outline-[#BBD8FF] -outline-offset-1 rounded-[14px]"
      >
        <div
          data-pencil-name="Ícone Aviso Auditoria"
          className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#DBEBFF] rounded-[12px]"
        >
          <LockKeyhole size={17} className="text-[#1D4ED8]" />
        </div>
        <div
          data-pencil-name="Texto Aviso Auditoria"
          className="text-[13px]/[normal] box-border text-[#1D4ED8] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
        >
          Seção restrita ao perfil Administrador. Logs são imutáveis e retidos por 5 anos conforme política RF-LOG-021.
        </div>
      </div>

      {/* Resumo Auditoria (4 KPI Cards) */}
      <div
        data-pencil-name="Resumo Auditoria"
        className="box-border w-full h-auto md:h-[108px] shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] justify-start items-start"
      >
        {/* Card Total no período */}
        <div
          data-pencil-name="Card Auditoria Total no período"
          className="box-border flex-1 h-[108px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px]"
        >
          <div
            data-pencil-name="Ícone Auditoria Total no período"
            className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[14px]"
          >
            <ListChecks size={18} className="text-[#071915]" />
          </div>
          <div
            data-pencil-name="Texto Auditoria Total no período"
            className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
          >
            <div
              data-pencil-name="Topo Auditoria Total no período"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
            >
              <div
                data-pencil-name="Label Auditoria Total no período"
                className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
              >
                TOTAL NO PERÍODO
              </div>
              <div
                data-pencil-name="Pill Auditoria Total no período"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
              >
                <div
                  data-pencil-name="Texto Pill Auditoria Total no período"
                  className="text-[9px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Geral
                </div>
              </div>
            </div>
            <div
              data-pencil-name="Valor Auditoria Total no período"
              className="text-[23px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              {stats.total}
            </div>
            <div
              data-pencil-name="Descrição Auditoria Total no período"
              className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              Eventos auditados
            </div>
          </div>
        </div>

        {/* Card Acessos e logins */}
        <div
          data-pencil-name="Card Auditoria Acessos e logins"
          className="box-border flex-1 h-[108px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px]"
        >
          <div
            data-pencil-name="Ícone Auditoria Acessos e logins"
            className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#EEF3FF] rounded-[14px]"
          >
            <LogIn size={18} className="text-[#2563EB]" />
          </div>
          <div
            data-pencil-name="Texto Auditoria Acessos e logins"
            className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
          >
            <div
              data-pencil-name="Topo Auditoria Acessos e logins"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
            >
              <div
                data-pencil-name="Label Auditoria Acessos e logins"
                className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
              >
                ACESSOS E LOGINS
              </div>
              <div
                data-pencil-name="Pill Auditoria Acessos e logins"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
              >
                <div
                  data-pencil-name="Texto Pill Auditoria Acessos e logins"
                  className="text-[9px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Acesso
                </div>
              </div>
            </div>
            <div
              data-pencil-name="Valor Auditoria Acessos e logins"
              className="text-[23px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              {stats.acessos}
            </div>
            <div
              data-pencil-name="Descrição Auditoria Acessos e logins"
              className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              Sessões e tentativas
            </div>
          </div>
        </div>

        {/* Card Operações financeiras */}
        <div
          data-pencil-name="Card Auditoria Operações financeiras"
          className="box-border flex-1 h-[108px] flex flex-row gap-[12px] p-[14px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px]"
        >
          <div
            data-pencil-name="Ícone Auditoria Operações financeiras"
            className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#EAF8EF] rounded-[14px]"
          >
            <BadgeDollarSign size={18} className="text-[#138A4B]" />
          </div>
          <div
            data-pencil-name="Texto Auditoria Operações financeiras"
            className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
          >
            <div
              data-pencil-name="Topo Auditoria Operações financeiras"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-[5px] justify-start items-center"
            >
              <div
                data-pencil-name="Label Auditoria Operações financeiras"
                className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
              >
                OPERAÇÕES FINANCEIRAS
              </div>
            </div>
            <div
              data-pencil-name="Valor Auditoria Operações financeiras"
              className="text-[23px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              {stats.financeiro}
            </div>
            <div
              data-pencil-name="Descrição Auditoria Operações financeiras"
              className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              Pagamentos e estornos
            </div>
          </div>
        </div>

        {/* Card Ações cadastrais */}
        <div
          data-pencil-name="Card Auditoria Ações cadastrais"
          className="box-border flex-1 h-[108px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px]"
        >
          <div
            data-pencil-name="Ícone Auditoria Ações cadastrais"
            className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#FFF3D9] rounded-[14px]"
          >
            <Database size={18} className="text-[#A85B00]" />
          </div>
          <div
            data-pencil-name="Texto Auditoria Ações cadastrais"
            className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
          >
            <div
              data-pencil-name="Topo Auditoria Ações cadastrais"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
            >
              <div
                data-pencil-name="Label Auditoria Ações cadastrais"
                className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
              >
                AÇÕES CADASTRAIS
              </div>
              <div
                data-pencil-name="Pill Auditoria Ações cadastrais"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
              >
                <div
                  data-pencil-name="Texto Pill Auditoria Ações cadastrais"
                  className="text-[9px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Cadastro
                </div>
              </div>
            </div>
            <div
              data-pencil-name="Valor Auditoria Ações cadastrais"
              className="text-[23px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              {stats.cadastrais}
            </div>
            <div
              data-pencil-name="Descrição Auditoria Ações cadastrais"
              className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              Clientes, quadras e usuários
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Auditoria */}
      <div
        data-pencil-name="Filtros Auditoria"
        className="box-border w-full h-auto md:h-[42px] shrink-0 flex flex-wrap gap-[10px] justify-start items-center"
      >
        {/* Busca nos logs */}
        <div
          data-pencil-name="Busca Auditoria"
          className="box-border w-[260px] shrink-0 h-[38px] flex flex-row gap-[8px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px] focus-within:outline-[#071915]"
        >
          <Search size={15} className="text-[#6F766F] shrink-0" />
          <input
            type="text"
            placeholder="Buscar nos logs..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder:text-[#94A3B8] font-[Inter,system-ui,sans-serif]"
          />
        </div>

        {/* Filtro Dropdown Categoria de Evento */}
        <div className="relative" ref={eventDropdownRef}>
          <button
            type="button"
            onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
            data-pencil-name="Filtro Auditoria Todos os eventos"
            className="box-border w-[190px] shrink-0 h-[38px] flex flex-row gap-0 px-[12px] justify-between items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px] cursor-pointer hover:bg-[#FAF7F2] transition-colors"
          >
            <div
              data-pencil-name="Texto Filtro Auditoria Todos os eventos"
              className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-[145px]"
            >
              {getSelectedEventLabel()}
            </div>
            <ChevronDown
              size={15}
              className={`text-[#6F675F] transition-transform duration-150 shrink-0 ${
                eventDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {eventDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-[260px] bg-white outline outline-1 outline-[#DED6CA] rounded-[10px] shadow-[0_12px_28px_-4px_rgba(28,26,24,0.14)] max-h-[280px] overflow-y-auto z-50 p-[4px]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEvento('');
                  setEventDropdownOpen(false);
                }}
                className={`px-[12px] py-[8px] text-[13px] ${
                  !evento ? 'font-bold text-[#2563EB] bg-[#F1F5F9]' : 'font-normal text-[#071915] bg-transparent'
                } hover:bg-[#F8F6F2] rounded-[6px] flex items-center justify-between cursor-pointer`}
              >
                <span>Todos os eventos</span>
                {!evento && <Check size={14} className="text-[#2563EB]" />}
              </div>

              {EVENT_CATEGORIES.map((cat, catIdx) => (
                <div key={cat.category} className={catIdx === 0 ? 'mt-[4px]' : 'mt-[8px]'}>
                  <div className="text-[10px] font-bold text-[#6F766F] uppercase tracking-[0.5px] px-[10px] py-[4px]">
                    {cat.category}
                  </div>
                  {cat.items.map((item) => {
                    const isSelected = evento === item.value;
                    return (
                      <div
                        key={item.value}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setEvento(item.value);
                          setEventDropdownOpen(false);
                        }}
                        className={`px-[12px] py-[7px] text-[13px] ${
                          isSelected
                            ? 'font-bold text-[#2563EB] bg-[#F1F5F9]'
                            : 'font-normal text-[#071915] bg-transparent'
                        } hover:bg-[#F8F6F2] rounded-[6px] flex items-center justify-between cursor-pointer`}
                      >
                        <span className="truncate">{item.label}</span>
                        {isSelected && <Check size={14} className="text-[#2563EB]" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filtro Data Início */}
        <div
          data-pencil-name="Filtro Auditoria 01/09/2026"
          className="box-border w-[145px] shrink-0 h-[38px] flex flex-row gap-[4px] px-[10px] justify-between items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px]"
        >
          <DatePicker
            
            value={dataInicio}
            onValueChange={(value) => setDataInicio(value)}
            className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] cursor-pointer"
            title="Data inicial"
          />
        </div>

        {/* Filtro Data Fim */}
        <div
          data-pencil-name="Filtro Auditoria 27/09/2026"
          className="box-border w-[145px] shrink-0 h-[38px] flex flex-row gap-[4px] px-[10px] justify-between items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px]"
        >
          <DatePicker
            
            value={dataFim}
            onValueChange={(value) => setDataFim(value)}
            className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] cursor-pointer"
            title="Data final"
          />
        </div>
      </div>

      {/* Tabela Logs Auditoria */}
      <div
        data-pencil-name="Tabela Logs Auditoria"
        className="box-border w-full flex-1 flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] overflow-hidden shadow-sm"
      >
        {/* Header Logs Auditoria */}
        <div
          data-pencil-name="Header Logs Auditoria"
          className="box-border w-full h-[55.5px] shrink-0 flex flex-row gap-0 px-[22px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
        >
          <div
            data-pencil-name="Título Logs Auditoria"
            className="text-[16px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
          >
            Logs de auditoria
          </div>
          <div
            data-pencil-name="Dica Logs Auditoria"
            className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
          >
            Clique em uma linha para ver detalhes
          </div>
        </div>

        {/* Table scroll container */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[980px] w-full">
            {/* Colunas Logs Auditoria */}
            <div
              data-pencil-name="Colunas Logs Auditoria"
              className="box-border w-full h-[35.5px] shrink-0 flex flex-row gap-[16px] px-[22px] justify-start items-center border-b border-[#F0EBE4] bg-[#FFFFFF]"
            >
              <div
                data-pencil-name="Coluna Auditoria DATA/HORA"
                className="text-[10px]/[normal] box-border w-[165px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
              >
                DATA/HORA
              </div>
              <div
                data-pencil-name="Coluna Auditoria EVENTO"
                className="text-[10px]/[normal] box-border w-[210px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
              >
                EVENTO
              </div>
              <div
                data-pencil-name="Coluna Auditoria USUÁRIO"
                className="text-[10px]/[normal] box-border w-[120px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
              >
                USUÁRIO
              </div>
              <div
                data-pencil-name="Coluna Auditoria DETALHES"
                className="text-[10px]/[normal] box-border flex-1 min-w-[240px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
              >
                DETALHES
              </div>
              <div
                data-pencil-name="Coluna Auditoria IP"
                className="text-[10px]/[normal] box-border w-[90px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-center"
              >
                IP
              </div>
            </div>

            {/* Linhas da Tabela */}
            <div className="w-full flex flex-col">
              {loading ? (
                <div className="py-14 text-center text-[#6F766F] text-[13px] flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#071915] border-t-transparent animate-spin" />
                  Carregando logs de auditoria...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-14 text-center text-[#6F766F] text-[13px]">
                  Nenhum log encontrado para os filtros selecionados.
                </div>
              ) : (
                logs.map((log) => {
                  const badge = getBadgeStyle(log.evento);
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="box-border w-full min-h-[38px] py-2 shrink-0 flex flex-row gap-[16px] px-[22px] justify-start items-center border-b border-[#F4EFE8] hover:bg-[#FAF7F2] cursor-pointer transition-colors"
                      title="Clique para ver os detalhes"
                    >
                      <div className="text-[12px]/[normal] box-border w-[165px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left">
                        {formatDateTime(log.criado_em)}
                      </div>
                      <div className="w-[210px] shrink-0">
                        <div
                          className={`box-border w-full h-[24px] flex flex-row gap-0 justify-center items-center rounded-[12px] px-2 ${badge.bg}`}
                        >
                          <div
                            className={`text-[10px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate ${badge.text}`}
                          >
                            {log.evento}
                          </div>
                        </div>
                      </div>
                      <div className="text-[12px]/[normal] box-border w-[120px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left truncate font-medium">
                        {log.usuario_nome || 'Sistema'}
                      </div>
                      <div
                        className="text-[12px]/[normal] box-border flex-1 min-w-[240px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left truncate"
                        title={log.detalhes}
                      >
                        {log.detalhes}
                      </div>
                      <div className="w-[90px] shrink-0 flex justify-center">
                        <div className="box-border w-[90px] shrink-0 h-[22px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[11px]">
                          <div className="text-[10px]/[normal] box-border text-[#071915] font-['Roboto_Mono',monospace] font-normal text-center whitespace-nowrap">
                            {log.ip || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Rodapé Logs Auditoria */}
        <div
          data-pencil-name="Rodapé Logs Auditoria"
          className="box-border w-full h-[44px] shrink-0 flex flex-row gap-0 px-[18px] justify-between items-center bg-[#FCFCFA] border-t border-[#F0EBE4]"
        >
          <div
            data-pencil-name="Contagem Logs Auditoria"
            className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
          >
            Exibindo {totalRegistros} {totalRegistros === 1 ? 'resultado' : 'resultados'}
          </div>
          <div
            data-pencil-name="Paginação Auditoria"
            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
          >
            <div
              data-pencil-name="Página Auditoria"
              className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap mr-1"
            >
              Página {currentPage} de {totalPaginas}
            </div>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              data-pencil-name="Botão Anterior Auditoria"
              className="box-border w-fit shrink-0 h-[30px] flex flex-row gap-0 px-[10px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div
                data-pencil-name="Texto Anterior Auditoria"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Anterior
              </div>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPaginas}
              onClick={() => setCurrentPage((p) => Math.min(totalPaginas, p + 1))}
              data-pencil-name="Botão Próxima Auditoria"
              className="box-border w-fit shrink-0 h-[30px] flex flex-row gap-0 px-[10px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div
                data-pencil-name="Texto Próxima Auditoria"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Próxima
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Log de Auditoria */}
      {selectedLog &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-[#071915]/60 backdrop-blur-sm flex items-center justify-center p-4"
            role="presentation"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] rounded-[20px] max-w-[580px] w-full shadow-[0_24px_50px_rgba(7,25,21,0.25)] overflow-hidden animate-scale-in"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-[#F0EBE4] flex items-center justify-between bg-[#FBFAF7]">
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-[12px] bg-[#C9FF3B] flex items-center justify-center text-[#071915]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold text-[#071915]">Detalhes do Registro de Auditoria</h2>
                    <p className="text-[12px] text-[#6F766F] m-0">ID #{selectedLog.id} · Registro Imutável</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#6F766F] hover:bg-[#F1EDE6] transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Evento */}
                  <div className="bg-[#FAF7F2] p-3 rounded-[12px] border border-[#E6DED2]">
                    <div className="text-[10px] text-[#6F766F] font-bold tracking-[0.5px]">EVENTO</div>
                    <div className="mt-1.5">
                      <div
                        className={`box-border w-fit h-[24px] flex flex-row gap-0 justify-center items-center rounded-[12px] px-2.5 ${
                          getBadgeStyle(selectedLog.evento).bg
                        }`}
                      >
                        <span
                          className={`text-[11px] font-bold ${getBadgeStyle(selectedLog.evento).text}`}
                        >
                          {selectedLog.evento}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Data e Hora */}
                  <div className="bg-[#FAF7F2] p-3 rounded-[12px] border border-[#E6DED2]">
                    <div className="text-[10px] text-[#6F766F] font-bold tracking-[0.5px]">DATA E HORA</div>
                    <div className="text-[13px] font-bold text-[#071915] mt-1.5">
                      {formatDateTime(selectedLog.criado_em)}
                    </div>
                  </div>

                  {/* Usuário Responsável */}
                  <div className="bg-[#FAF7F2] p-3 rounded-[12px] border border-[#E6DED2]">
                    <div className="text-[10px] text-[#6F766F] font-bold tracking-[0.5px]">USUÁRIO RESPONSÁVEL</div>
                    <div className="text-[13px] font-bold text-[#071915] mt-1.5">
                      {selectedLog.usuario_nome || 'Sistema (Automático)'}
                    </div>
                  </div>

                  {/* Endereço IP */}
                  <div className="bg-[#FAF7F2] p-3 rounded-[12px] border border-[#E6DED2]">
                    <div className="text-[10px] text-[#6F766F] font-bold tracking-[0.5px]">ENDEREÇO IP</div>
                    <div className="mt-1.5">
                      <span className="inline-block px-2.5 py-0.5 bg-[#F1EDE6] text-[#071915] rounded-[8px] font-['Roboto_Mono',monospace] text-[11px]">
                        {selectedLog.ip || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalhes Completos */}
                <div>
                  <label className="text-[11px] font-bold text-[#6F766F] tracking-[0.5px] uppercase block mb-1.5">
                    Detalhes Completos da Ação
                  </label>
                  <div className="bg-[#FAF7F2] p-4 rounded-[12px] border border-[#E6DED2] text-[13px] text-[#071915] leading-relaxed max-h-[220px] overflow-y-auto break-words">
                    {selectedLog.detalhes || 'Sem detalhes adicionais registrados.'}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#F0EBE4] flex justify-end bg-[#FBFAF7]">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="bg-[#071915] text-[#FFFFFF] hover:bg-[#122822] text-[13px] font-bold px-5 py-2.5 rounded-[10px] cursor-pointer transition-colors"
                >
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
