import { ToastLayer } from "../../components/ToastLayer";
import { DatePicker } from '../../components/ui/date-picker';
import { useArenaPortal } from '../../hooks/useArenaPortal';
import { useRefundQuote } from '../../hooks/useRefundQuote';
import { usePixRecovery } from '../../hooks/usePixRecovery';
import { RefundNotice } from '../../components/RefundNotice';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  CalendarPlus,
  Lock,
  Plus,
  Menu,
  Globe,
  Bell,
  X,
  Copy,
  ExternalLink,
  Share2,
  Check,
  Search,
  MessageCircle,
  MapPin,
  Trophy,
  Clock,
  NotebookPen,
  Info,
  CalendarClock,
  Unlock,
  Trash2,
} from 'lucide-react';
import { blockSlots, timeMinutes, minutesTime } from '../../utils/blockSlots';
import { errorMessage } from '../../utils/errorMessage';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { safeStorage } from '../../utils/safeStorage';
import { getStoredUser } from '../../utils/session';
import type { Announcement } from '../../types/api';
import '../../assets/css/reservas.css';

export interface ModalidadeItem {
  nome: string;
  preco: number;
}

interface Quadra {
  id: number;
  nome: string;
  tipo: string;
  hora_abertura: string;
  hora_fechamento: string;
  preco_base?: number;
  modalidades?: (string | ModalidadeItem)[];
  status?: string;
}

interface Reserva {
  id: number;
  quadra_id: number;
  quadra_nome?: string;
  hora_inicio: string;
  hora_fim: string;
  cliente_nome: string;
  cliente_telefone?: string;
  cliente_email?: string;
  cliente_id?: number;
  status?: string;
  status_pagamento: string;
  valor_total: number;
  valor_pago: number;
  total_pago?: number;
  observacoes?: string;
  data_reserva: string;
  esporte?: string;
}

interface Bloqueio {
  id: number;
  quadra_id: number;
  hora_inicio: string;
  hora_fim: string;
  motivo?: string;
  data_bloqueio: string;
}

interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
}

export interface GradeData {
  quadras: Quadra[];
  reservas: Reserva[];
  bloqueios: Bloqueio[];
}

export interface Coluna {
  id: string;
  label: string;
  subLabel: string;
  quadra_id: number;
  data: string;
  hora_abertura: string;
  hora_fechamento: string;
}

const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = Number.parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatFloatToCurrencyInput = (num: number) => {
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyToFloat = (value: string) => {
  if (!value) return 0;
  const clean = value.replace(/\./g, '').replace(',', '.');
  return Number.parseFloat(clean) || 0;
};

const getWeekRange = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return { startStr, endStr, start, end };
};

interface AdminGradeSlotProps {
  col: Coluna;
  idx: number;
  row: number;
  hourStr: string;
  isPast: boolean;
  res?: Reserva;
  blq?: Bloqueio;
  slotMinutes?: number;
  onCellClick: (quadraId: number, dateStr: string, hourStr: string, reserva?: Reserva, bloqueio?: Bloqueio) => void;
}

export const AdminGradeSlot: React.FC<AdminGradeSlotProps> = ({
  col,
  idx,
  row,
  hourStr,
  isPast,
  res,
  blq,
  slotMinutes = 60,
  onCellClick,
}) => {
  const isOpen = hourStr >= col.hora_abertura && hourStr < col.hora_fechamento;

  if (!isOpen) {
    return (
      <div
        key={col.id}
        className="h-[48px] bg-[#F0ECE5] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] flex items-center justify-center text-[12px] text-[#B1AAA1] font-extrabold select-none"
        style={{ gridColumn: idx + 2, gridRow: row }}
      >
        Fechada
      </div>
    );
  }

  if (blq) {
    return (
      <div
        key={col.id}
        className="h-[48px] bg-[#152238] outline outline-1 outline-[#C8BFB2] -outline-offset-1 rounded-[14px] flex items-center justify-center gap-2 px-2 text-[12px] text-white font-extrabold cursor-pointer shadow-sm hover:brightness-110 transition-all truncate"
        title={`${blq.motivo || 'Bloqueado'} · ${blq.hora_inicio} às ${blq.hora_fim}`}
        style={{ gridColumn: idx + 2, gridRow: row }}
        role="button"
        tabIndex={0}
        onClick={() => onCellClick(col.quadra_id, col.data, hourStr, undefined, blq)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCellClick(col.quadra_id, col.data, hourStr, undefined, blq);
        }}
      >
        <div className="w-[8px] h-[8px] bg-[#C9FF3B] rounded-full shrink-0" />
        <span className="text-[12px] font-extrabold truncate text-center">
          {blq.motivo || 'Bloqueio'}
        </span>
      </div>
    );
  }

  if (res) {
    if (res.hora_inicio === hourStr) {
      const span = Math.max(1, Math.ceil((timeMinutes(res.hora_fim) - timeMinutes(res.hora_inicio)) / slotMinutes));

      let bgClasses = 'bg-[#FFF3DD] outline outline-1 outline-[#C8661A] text-[#071915]';
      let dotColor = 'bg-[#C8661A]';
      if (res.status_pagamento === 'Pago') {
        bgClasses = 'bg-[#EAF9C7] outline outline-1 outline-[#138A4B] text-[#071915]';
        dotColor = 'bg-[#138A4B]';
      } else if (res.status_pagamento === 'Parcial') {
        bgClasses = 'bg-[#EAF2FF] outline outline-1 outline-[#2E5BFF] text-[#071915]';
        dotColor = 'bg-[#2E5BFF]';
      }

      const formatVal = 'R$ ' + res.valor_total.toFixed(2).replace('.', ',');

      return (
        <div
          key={col.id}
          className={`min-h-[48px] ${bgClasses} -outline-offset-1 rounded-[14px] flex items-center justify-center gap-2 px-2 cursor-pointer shadow-sm hover:scale-[1.01] transition-transform select-none`}
          style={{ gridColumn: idx + 2, gridRow: `${row} / span ${span}` }}
          role="button"
          tabIndex={0}
          onClick={() => onCellClick(col.quadra_id, col.data, hourStr, res)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onCellClick(col.quadra_id, col.data, hourStr, res);
          }}
          title={`${res.cliente_nome} (${res.status_pagamento}) - ${formatVal}`}
        >
          <div className={`w-[8px] h-[8px] ${dotColor} rounded-full shrink-0`} />
          <div className="flex flex-col items-center justify-center min-w-0 text-center leading-tight">
            <span className="text-[12px] font-extrabold truncate w-full">{res.cliente_nome}</span>
            {span > 1 && (
              <span className="text-[10px] text-[#6F766F] font-normal truncate">
                {res.status_pagamento} · {formatVal}
              </span>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  if (isPast) {
    return (
      <div
        key={col.id}
        className="h-[48px] bg-[#F7F4EF] outline outline-1 outline-[#E5DCD0] -outline-offset-1 rounded-[14px] opacity-60"
        style={{ gridColumn: idx + 2, gridRow: row }}
      />
    );
  }

  return (
    <div
      key={col.id}
      className="h-[48px] bg-[#FBFAF7] outline outline-1 outline-[#CFC5B8] -outline-offset-1 rounded-[14px] flex items-center justify-center text-[12px] text-[#8A8177] font-normal cursor-pointer hover:bg-white hover:border-[#071915] transition-colors shadow-xs"
      style={{ gridColumn: idx + 2, gridRow: row }}
      role="button"
      tabIndex={0}
      onClick={() => onCellClick(col.quadra_id, col.data, hourStr)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onCellClick(col.quadra_id, col.data, hourStr);
      }}
    >
      Livre
    </div>
  );
};

export function AdminReservas() {
  const pixRecovery = usePixRecovery();
  const outletContext = useOutletContext<{ onToggleSidebar?: () => void }>() || {};
  const onToggleSidebar = outletContext.onToggleSidebar;

  const { arenaName, clientPortalUrl } = useArenaPortal();
  const gradeInterval = safeStorage.getItem('grade_interval') === '30' ? 30 : 60;
  const [showPortalMenu, setShowPortalMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [copied, setCopied] = useState(false);

  const user = getStoredUser();
  const userName = user?.nome || 'fefe';

  const handleCopy = () => {
    if (!clientPortalUrl) return;
    navigator.clipboard.writeText(clientPortalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpen = () => {
    if (!clientPortalUrl) return;
    window.open(clientPortalUrl, '_blank');
  };

  const handleWhatsApp = () => {
    if (!clientPortalUrl) return;
    const ball = String.fromCodePoint(0x1f3d0); // 🏐
    const hand = String.fromCodePoint(0x1f449); // 👉
    const messageText = `${ball} Agende sua quadra na ${arenaName} de forma rápida e online. Escolha o melhor horário e reserve agora:\n\n${hand} ${clientPortalUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/auth/comunicados/ativos', { headers: {} });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Ignora erro
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Controle de Visualização e Filtros
  const [scope, setScope] = useState<'diaria' | 'semanal'>('diaria');
  const [filterQuadraId, setFilterQuadraId] = useState<number | ''>('');

  // Data de referência
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayStr = new Date(Date.now() - tzOffset).toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(() => todayStr);

  // Dados da Grade e Auxiliares
  const [grade, setGrade] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeError, setGradeError] = useState('');
  const gradeRequest = useRef(0);
  const [agendaNow, setAgendaNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgendaNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);

  // Modais de Controle
  const [activeModal, setActiveModal] = useState<
    | 'new-reserva'
    | 'detalhe-reserva'
    | 'cancelar-reserva'
    | 'registrar-pagamento'
    | 'estornar-pagamento'
    | 'bloquear-quadra'
    | 'gerenciar-bloqueio'
    | 'pix-gateway'
    | null
  >(null);

  // Estados de Gateway Pix
  const [gatewayRef, setGatewayRef] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [copiaCola, setCopiaCola] = useState('');

  // Estados dos Formulários
  const [nrClienteBusca, setNrClienteBusca] = useState('');
  const [nrClienteId, setNrClienteId] = useState<number | null>(null);
  const [nrQuadraId, setNrQuadraId] = useState<number | null>(null);
  const [nrEsporte, setNrEsporte] = useState('');
  const [nrData, setNrData] = useState(selectedDate);
  const [nrInicio, setNrInicio] = useState('');
  const [nrFim, setNrFim] = useState('');
  const [nrObs, setNrObs] = useState('');
  const [nrValorPrevisto, setNrValorPrevisto] = useState(0);
  const [showNrAutocomplete, setShowNrAutocomplete] = useState(false);
  const [nrHorariosInicio, setNrHorariosInicio] = useState<string[]>([]);
  const [nrHorariosFim, setNrHorariosFim] = useState<string[]>([]);

  // Cadastro Rápido de Cliente
  const [showQuickClientForm, setShowQuickClientForm] = useState(false);
  const [qcNome, setQcNome] = useState('');
  const [qcTelefone, setQcTelefone] = useState('');
  const [qcEmail, setQcEmail] = useState('');
  const [qcLoading, setQcLoading] = useState(false);

  // Pagamento Imediato no Balcão
  const [nrRegistrarPagamento, setNrRegistrarPagamento] = useState(false);
  const [nrPagMetodo, setNrPagMetodo] = useState('Pix (QR Code na Tela)');
  const [nrPagValor, setNrPagValor] = useState('');

  useEffect(() => {
    if (nrRegistrarPagamento) {
      setNrPagValor(nrValorPrevisto.toFixed(2));
    }
  }, [nrValorPrevisto, nrRegistrarPagamento]);

  const quadraSelecionada = quadras.find((q) => q.id === nrQuadraId);
  const modalidadesQuadra = useMemo<ModalidadeItem[]>(() => {
    if (!quadraSelecionada) return [];
    const raw = quadraSelecionada.modalidades;
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      return [{ nome: quadraSelecionada.tipo || 'Beach Tennis', preco: quadraSelecionada.preco_base || 80 }];
    }
    return raw.map((m) =>
      typeof m === 'string'
        ? { nome: m, preco: quadraSelecionada.preco_base || 80 }
        : { nome: m.nome, preco: Number(m.preco != null ? m.preco : quadraSelecionada.preco_base || 80) }
    );
  }, [quadraSelecionada]);

  useEffect(() => {
    if (modalidadesQuadra.length > 0) {
      if (!nrEsporte || !modalidadesQuadra.some((m) => m.nome === nrEsporte)) {
        setNrEsporte(modalidadesQuadra[0].nome);
      }
    } else {
      setNrEsporte('');
    }
  }, [modalidadesQuadra, nrEsporte]);

  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [obsCancelamento, setObsCancelamento] = useState('');
  const [motivosDisponiveis] = useState([
    'Desistência do cliente',
    'Chuva/Mau tempo',
    'Conflito de agenda',
    'Erro de agendamento',
    'Outro',
  ]);

  const [pagValor, setPagValor] = useState('');
  const [pagDesconto, setPagDesconto] = useState('');
  const [pagMetodo, setPagMetodo] = useState('');
  const [pagData, setPagData] = useState('');

  const [estValor, setEstValor] = useState('');
  const [estMotivo, setEstMotivo] = useState('');
  const refund = useRefundQuote(activeModal === 'estornar-pagamento' ? selectedReserva?.id ?? null : null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundResult, setRefundResult] = useState('');

  const [bqQuadraId, setBqQuadraId] = useState<number | null>(null);
  const [bqData, setBqData] = useState(selectedDate);
  const [bqInicio, setBqInicio] = useState('');
  const [bqFim, setBqFim] = useState('');
  const [bqMotivo, setBqMotivo] = useState('');
  const [bqAvailability, setBqAvailability] = useState<{ date: string; grade: GradeData } | null>(null);
  const [bqLoading, setBqLoading] = useState(false);
  const [bqError, setBqError] = useState('');
  const [bqSaving, setBqSaving] = useState(false);
  const [bqReload, setBqReload] = useState(0);
  const [blockBusy, setBlockBusy] = useState(false);

  const [selectedBloqueio, setSelectedBloqueio] = useState<Bloqueio | null>(null);
  const [selectedBloqueioTime, setSelectedBloqueioTime] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [qcErrors, setQcErrors] = useState<{ nome?: string; telefone?: string; email?: string }>({});

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchGrade = useCallback(async () => {
    const requestId = ++gradeRequest.current;
    setLoading(true);
    setGradeError('');
    let start = selectedDate;
    let end = selectedDate;

    if (scope === 'semanal') {
      const range = getWeekRange(selectedDate);
      start = range.startStr;
      end = range.endStr;
    }

    try {
      const res = await fetch(`/api/reservas/grade?data_inicio=${start}&data_fim=${end}`, {
        headers: {},
      });
      if (!res.ok) throw new Error('Falha ao carregar agenda.');
      const json = await res.json();
      if (requestId === gradeRequest.current) setGrade(json);
    } catch (err) {
      console.error('Erro ao buscar grade:', err);
      if (requestId === gradeRequest.current) {
        setGrade(null);
        setGradeError('Não foi possível carregar a agenda. Tente novamente.');
      }
    } finally {
      if (requestId === gradeRequest.current) setLoading(false);
    }
  }, [selectedDate, scope]);

  useEffect(() => {
    if (activeModal !== 'pix-gateway' || !selectedReserva || !gatewayRef) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pagamentos/gateway/status/${selectedReserva.id}`, { headers: {} });
        if (res.ok) {
          const resData = await res.json();
          if (resData.status_pagamento === 'Pago' || resData.status_pagamento === 'Parcial') {
            showToast(`Pagamento Pix de R$ ${resData.total_pago?.toFixed(2)} verificado e confirmado!`, 'success');
            setActiveModal(null);
            setSelectedReserva(null);
            fetchGrade();
          }
        }
      } catch (e) {
        console.error('Erro no polling do Pix:', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeModal, selectedReserva, gatewayRef, fetchGrade]);

  useEffect(() => {
    const fetchGerais = async () => {
      try {
        const resCl = await fetch('/api/clientes', { headers: {} });
        if (resCl.ok) {
          const cl = await resCl.json();
          setClientes(cl);
        }
        const resQd = await fetch('/api/quadras', { headers: {} });
        if (resQd.ok) {
          const qd = await resQd.json();
          setQuadras(qd);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados auxiliares:', err);
      }
    };
    fetchGerais();
  }, []);

  useEffect(() => {
    fetchGrade();
    setNrData(selectedDate);
    setBqData(selectedDate);
  }, [selectedDate, scope, filterQuadraId, fetchGrade]);

  useEffect(() => {
    const ativas = quadras.filter((q) => q.status === 'Ativa');
    if (scope === 'semanal' && filterQuadraId === '' && ativas.length > 0) {
      setFilterQuadraId(ativas[0].id);
    }
  }, [scope, quadras, filterQuadraId]);

  const selectedReservaId = selectedReserva?.id;
  useEffect(() => {
    if (!selectedReservaId) return;

    const fetchPagos = async () => {
      try {
        const res = await fetch(`/api/pagamentos/reserva/${selectedReservaId}`, { headers: {} });
        if (res.ok) {
          const pags = await res.json();
          const totalPago = pags.reduce((acc: number, curr: { valor: number }) => acc + (curr.valor || 0), 0);
          setSelectedReserva((prev) =>
            prev?.id === selectedReservaId && prev.valor_pago !== totalPago
              ? { ...prev, valor_pago: totalPago }
              : prev
          );
        }
      } catch (err) {
        console.warn('Erro ao carregar pagamentos da reserva:', err);
      }
    };
    fetchPagos();
  }, [selectedReservaId]);

  // Recalcular horários disponíveis da reserva
  useEffect(() => {
    if (!nrQuadraId || !nrData || !grade) {
      setNrHorariosInicio([]);
      setNrHorariosFim([]);
      return;
    }

    const q = grade.quadras.find((x) => x.id === nrQuadraId);
    if (!q) return;

    const abertura = q.hora_abertura || '08:00';
    const fechamento = q.hora_fechamento || '22:00';
    const minHour = Number.parseInt(abertura.split(':')[0], 10);
    const maxHour = Number.parseInt(fechamento.split(':')[0], 10);

    const resQuadra = (grade.reservas || []).filter(
      (r) => r.quadra_id === nrQuadraId && r.data_reserva === nrData
    );
    const bqQuadra = (grade.bloqueios || []).filter(
      (b) => b.quadra_id === nrQuadraId && b.data_bloqueio === nrData
    );

    const now = new Date();
    const tzOff = now.getTimezoneOffset() * 60000;
    const curTodayStr = new Date(Date.now() - tzOff).toISOString().split('T')[0];
    const currentHourStr = new Date(Date.now() - tzOff).toISOString().split('T')[1].substring(0, 5);

    const livres: string[] = [];
    for (let h = minHour; h < maxHour; h++) {
      const startSlot = h.toString().padStart(2, '0') + ':00';
      const endSlot = (h + 1).toString().padStart(2, '0') + ':00';

      if (nrData === curTodayStr && endSlot <= currentHourStr) {
        continue;
      }

      const ocupado =
        resQuadra.some((r) => r.hora_inicio <= startSlot && r.hora_fim > startSlot) ||
        bqQuadra.some((b) => b.hora_inicio <= startSlot && b.hora_fim > startSlot);

      if (!ocupado) {
        livres.push(startSlot);
      }
    }

    setNrHorariosInicio(livres);
    if (nrInicio && !livres.includes(nrInicio)) {
      setNrInicio('');
    }
  }, [nrQuadraId, nrData, grade, nrInicio]);

  useEffect(() => {
    if (!nrInicio || !nrQuadraId || !grade) {
      setNrHorariosFim([]);
      return;
    }

    const q = grade.quadras.find((x) => x.id === nrQuadraId);
    const fechamento = q?.hora_fechamento || '22:00';
    const maxH = Number.parseInt(fechamento.split(':')[0], 10);
    const hI = Number.parseInt(nrInicio.split(':')[0], 10);
    const options: string[] = [];

    for (let h = hI + 1; h <= maxH; h++) {
      const prevHourStr = (h - 1).toString().padStart(2, '0') + ':00';
      const blockLivre = nrHorariosInicio.includes(prevHourStr);
      if (!blockLivre) break;
      options.push(h.toString().padStart(2, '0') + ':00');
    }

    setNrHorariosFim(options);
    if (options.length > 0) {
      if (!nrFim || !options.includes(nrFim)) {
        setNrFim(options[0]);
      }
    } else {
      setNrFim('');
    }
  }, [nrInicio, nrHorariosInicio, nrQuadraId, grade, nrFim]);

  useEffect(() => {
    if (!nrQuadraId || !nrInicio || !nrFim) {
      setNrValorPrevisto(0);
      return;
    }

    const q = quadras.find((x) => x.id === nrQuadraId);
    const sportMatch = modalidadesQuadra.find((m) => m.nome === nrEsporte);
    const preco = sportMatch?.preco ?? q?.preco_base ?? 80;

    const [hIni] = nrInicio.split(':').map(Number);
    const [hFim] = nrFim.split(':').map(Number);
    const duracao = hFim - hIni;

    if (duracao > 0) {
      setNrValorPrevisto(preco * duracao);
    } else {
      setNrValorPrevisto(0);
    }
  }, [nrQuadraId, nrInicio, nrFim, nrEsporte, modalidadesQuadra, quadras]);

  const duracaoHoras = useMemo(() => {
    if (!nrInicio || !nrFim) return 0;
    const [hIni] = nrInicio.split(':').map(Number);
    const [hFim] = nrFim.split(':').map(Number);
    return Math.max(0, hFim - hIni);
  }, [nrInicio, nrFim]);

  useEffect(() => {
    if (activeModal !== 'bloquear-quadra' || !bqData) return;
    const controller = new AbortController();
    setBqLoading(true);
    setBqError('');
    setBqAvailability(null);
    fetch('/api/reservas/grade?data=' + encodeURIComponent(bqData), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Não foi possível consultar a disponibilidade.');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setBqAvailability({ date: bqData, grade: data }); })
      .catch(error => { if (!controller.signal.aborted) setBqError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setBqLoading(false); });
    return () => controller.abort();
  }, [activeModal, bqData, bqReload]);

  const bqSlots = useMemo(() => {
    const data = bqAvailability?.date === bqData ? bqAvailability.grade : null;
    const court = data?.quadras.find(q => Number(q.id) === Number(bqQuadraId));
    if (!court || !data || bqData < todayStr) return { starts: [] as string[], ends: () => [] as string[] };
    const occupied = [...data.reservas.filter(r => Number(r.quadra_id) === Number(bqQuadraId) && r.status !== 'Cancelada'),
      ...data.bloqueios.filter(b => Number(b.quadra_id) === Number(bqQuadraId))];
    const now = new Date();
    return blockSlots(court.hora_abertura || '06:00', court.hora_fechamento || '22:00', occupied,
      bqData === todayStr ? now.getHours() * 60 + now.getMinutes() : -1);
  }, [bqAvailability, bqData, bqQuadraId, todayStr]);
  const bqHorariosInicioComputed = bqSlots.starts;
  const bqHorariosFimComputed = useMemo(() => bqSlots.ends(bqInicio), [bqSlots, bqInicio]);
  useEffect(() => {
    if (bqInicio && !bqHorariosInicioComputed.includes(bqInicio)) setBqInicio('');
    if (bqHorariosFimComputed.length > 0) {
      if (!bqFim || !bqHorariosFimComputed.includes(bqFim)) {
        setBqFim(bqHorariosFimComputed[0]);
      }
    } else {
      setBqFim('');
    }
  }, [bqHorariosInicioComputed, bqHorariosFimComputed, bqInicio, bqFim]);
  const bqCanSubmit = !bqLoading && !bqError && !bqSaving && !!bqMotivo.trim() &&
    bqHorariosInicioComputed.includes(bqInicio) && bqHorariosFimComputed.includes(bqFim);
  const releaseStart = selectedBloqueio ? (selectedBloqueioTime > selectedBloqueio.hora_inicio ? selectedBloqueioTime : selectedBloqueio.hora_inicio) : '';
  const releaseEnd = selectedBloqueio ? minutesTime(Math.min(timeMinutes(selectedBloqueioTime || selectedBloqueio.hora_inicio) + 60, timeMinutes(selectedBloqueio.hora_fim))) : '';

  const maskPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleQuickClientCreate = async (): Promise<number | null> => {
    const errors: { nome?: string; telefone?: string; email?: string } = {};

    if (!qcNome.trim()) {
      errors.nome = 'O nome do cliente é obrigatório.';
    } else if (qcNome.trim().split(/\s+/).length < 2) {
      errors.nome = 'Informe pelo menos nome e sobrenome.';
    }

    if (!qcTelefone.trim()) {
      errors.telefone = 'O WhatsApp é obrigatório.';
    } else if (!/^\(\d{2}\)\s\d{5}-\d{4}$/.test(qcTelefone.trim())) {
      errors.telefone = 'Número incompleto. Use (99) 99999-9999.';
    }

    if (qcEmail.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(qcEmail.trim())) {
        errors.email = 'Formato de e-mail inválido.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setQcErrors(errors);
      return null;
    }

    setQcErrors({});
    setQcLoading(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: qcNome.trim(),
          telefone: qcTelefone.trim(),
          email: qcEmail.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.field && resData.error) {
          setQcErrors({ [resData.field]: resData.error });
        } else {
          showToast(resData.error || 'Erro ao cadastrar cliente', 'error');
        }
        return null;
      }

      const novoCliente: Cliente = {
        id: resData.id,
        nome: resData.nome,
        telefone: resData.telefone,
        email: resData.email,
      };

      setClientes((prev) => [...prev, novoCliente].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNrClienteId(novoCliente.id);
      setNrClienteBusca(novoCliente.nome);
      setShowQuickClientForm(false);
      setShowNrAutocomplete(false);
      setQcNome('');
      setQcTelefone('');
      setQcEmail('');
      setQcErrors({});
      showToast(`Cliente ${novoCliente.nome} cadastrado e selecionado!`, 'success');
      return novoCliente.id;
    } catch (err) {
      showToast(errorMessage(err) || 'Erro ao cadastrar cliente', 'error');
      return null;
    } finally {
      setQcLoading(false);
    }
  };

  const handleConfirmarReserva = async () => {
    let finalClienteId = nrClienteId;

    if (!finalClienteId && showQuickClientForm && (qcNome.trim() || qcTelefone.trim())) {
      const createdId = await handleQuickClientCreate();
      if (!createdId) return;
      finalClienteId = createdId;
    }

    if (!finalClienteId || !nrQuadraId || !nrData || !nrInicio || !nrFim) {
      if (!finalClienteId) {
        showToast('Por favor, selecione ou cadastre um cliente.', 'error');
      } else {
        showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      }
      return;
    }

    try {
      const isPixQrCode = nrRegistrarPagamento && nrPagMetodo === 'Pix (QR Code na Tela)';
      const valPago = Number.parseFloat(nrPagValor.replace(',', '.')) || nrValorPrevisto;

      const payload: {
        cliente_id: number;
        quadra_id: number;
        data_reserva: string;
        hora_inicio: string;
        hora_fim: string;
        esporte: string;
        observacoes: string;
        valor_total: number;
        pagamento?: { registrar: boolean; metodo: string; valor: number };
      } = {
        cliente_id: finalClienteId,
        quadra_id: nrQuadraId,
        data_reserva: nrData,
        hora_inicio: nrInicio,
        hora_fim: nrFim,
        esporte: nrEsporte || modalidadesQuadra[0]?.nome || 'Beach Tennis',
        observacoes: nrObs,
        valor_total: nrValorPrevisto,
      };

      if (nrRegistrarPagamento && nrValorPrevisto > 0 && !isPixQrCode) {
        payload.pagamento = {
          registrar: true,
          metodo: nrPagMetodo,
          valor: valPago,
        };
      }

      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || 'Erro ao criar reserva');

      const reservaCriadaId = dataJson.id || dataJson.reserva_id;

      if (isPixQrCode && reservaCriadaId && valPago > 0) {
        try {
          const cobrancaRes = await fetch('/api/pagamentos/gateway/cobranca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reserva_id: reservaCriadaId,
              metodo: 'Pix',
              valor: valPago,
            }),
          });

          const cobrancaJson = await cobrancaRes.json();
          if (!cobrancaRes.ok) {
            pixRecovery.show(cobrancaJson, `/api/pagamentos/gateway/pix/${reservaCriadaId}`);
            throw new Error(cobrancaJson.error || 'Erro ao gerar QR Code do Pix.');
          }

          const novaReservaObj: Reserva = {
            id: reservaCriadaId,
            cliente_id: finalClienteId,
            cliente_nome: nrClienteBusca || 'Cliente',
            cliente_telefone: clientes.find((c) => c.id === finalClienteId)?.telefone || '',
            quadra_id: nrQuadraId,
            quadra_nome: quadras.find((q) => q.id === nrQuadraId)?.nome || '',
            data_reserva: nrData,
            hora_inicio: nrInicio,
            hora_fim: nrFim,
            valor_total: nrValorPrevisto,
            status: 'Confirmada',
            status_pagamento: 'Pendente',
            esporte: nrEsporte || 'Beach Tennis',
            valor_pago: 0,
            total_pago: 0,
          };

          setSelectedReserva(novaReservaObj);
          setPagValor(valPago.toFixed(2));
          setGatewayRef(cobrancaJson.gateway_ref);
          setQrCode(
            cobrancaJson.qr_code ||
              (cobrancaJson.qr_code_base64 ? `data:image/png;base64,${cobrancaJson.qr_code_base64}` : '')
          );
          setCopiaCola(cobrancaJson.copia_cola || '');
          setActiveModal('pix-gateway');
          resetNrForm();
          fetchGrade();
          showToast('Reserva criada! Apresente o QR Code Pix na tela para o cliente.', 'success');
          return;
        } catch (gatewayErr) {
          showToast(`Reserva criada, mas falhou ao gerar QR Code: ${errorMessage(gatewayErr)}`, 'error');
          setActiveModal(null);
          resetNrForm();
          fetchGrade();
          return;
        }
      }

      showToast(
        nrRegistrarPagamento
          ? 'Reserva criada e pagamento registrado no caixa com sucesso.'
          : 'Reserva criada com sucesso.',
        'success'
      );
      setActiveModal(null);
      resetNrForm();
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const handleConfirmarBloqueio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bqCanSubmit) {
      showToast('Preencha os campos obrigatórios do bloqueio.', 'error');
      return;
    }

    try {
      setBqSaving(true);
      const res = await fetch('/api/reservas/bloqueios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadra_id: bqQuadraId,
          data_bloqueio: bqData,
          hora_inicio: bqInicio,
          hora_fim: bqFim,
          motivo: bqMotivo.trim(),
        }),
      });

      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || 'Erro ao criar bloqueio');

      showToast('Quadra bloqueada com sucesso!', 'success');
      setActiveModal(null);
      resetBqForm();
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
      setBqReload(value => value + 1);
    } finally {
      setBqSaving(false);
    }
  };

  const handleConfirmarCancelamento = async () => {
    if (!selectedReserva || !motivoCancelamento) {
      showToast('O motivo do cancelamento é obrigatório.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/reservas/${selectedReserva.id}/cancelar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: motivoCancelamento,
          observacoes: obsCancelamento,
        }),
      });

      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || 'Erro ao cancelar reserva');

      showToast(dataJson.message || 'Reserva cancelada.', dataJson.pending ? 'error' : 'success');
      setActiveModal(null);
      setSelectedReserva(null);
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const handleConfirmarPagamento = async () => {
    if (!selectedReserva || !pagValor || !pagMetodo) {
      showToast('Preencha os campos obrigatórios de pagamento.', 'error');
      return;
    }

    const valorNumerico = parseCurrencyToFloat(pagValor);

    if (pagMetodo === 'Pix Online (Gateway)') {
      try {
        const res = await fetch('/api/pagamentos/gateway/cobranca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reserva_id: selectedReserva.id,
            metodo: 'Pix',
            valor: valorNumerico,
          }),
        });

        const dataJson = await res.json();
        if (!res.ok) {
          pixRecovery.show(dataJson, `/api/pagamentos/gateway/pix/${selectedReserva.id}`);
          throw new Error(dataJson.error || 'Erro ao gerar cobrança Pix.');
        }

        setGatewayRef(dataJson.gateway_ref);
        setQrCode(
          dataJson.qr_code ||
            (dataJson.qr_code_base64 ? `data:image/png;base64,${dataJson.qr_code_base64}` : '')
        );
        setCopiaCola(dataJson.copia_cola || '');
        setActiveModal('pix-gateway');
        showToast('Cobrança Pix Online gerada com sucesso!', 'success');
      } catch (e) {
        showToast(errorMessage(e), 'error');
      }
      return;
    }

    if (pagMetodo === 'Cartão (Maquineta Online)') {
      try {
        const res = await fetch('/api/pagamentos/gateway/cobranca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reserva_id: selectedReserva.id,
            metodo: 'Maquineta',
            valor: valorNumerico,
          }),
        });

        const dataJson = await res.json();
        if (!res.ok) throw new Error(dataJson.error || 'Erro ao comunicar com a Maquineta.');

        showToast(`Cobrança enviada para a maquineta ${dataJson.device_id}!`, 'success');
        setActiveModal(null);
        setSelectedReserva(null);
        fetchGrade();
      } catch (e) {
        showToast(errorMessage(e), 'error');
      }
      return;
    }

    try {
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva_id: selectedReserva.id,
          valor: valorNumerico,
          desconto: pagDesconto ? parseCurrencyToFloat(pagDesconto) : 0,
          metodo: pagMetodo,
        }),
      });

      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || 'Erro ao registrar pagamento');

      showToast('Pagamento registrado com sucesso!', 'success');
      setActiveModal(null);
      setSelectedReserva(null);
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const handleConfirmarEstorno = async () => {
    if (refundBusy || refund.loading || refund.error || !refund.quote) return;
    if (!selectedReserva || (!refund.quote.online && !estValor) || !estMotivo.trim()) {
      showToast('Todos os campos do estorno são obrigatórios.', 'error');
      return;
    }

    setRefundResult('');
    setRefundBusy(true);
    try {
      const res = await fetch('/api/pagamentos/estorno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva_id: selectedReserva.id,
          valor: refund.quote.online ? refund.quote.valor_centavos / 100 : parseCurrencyToFloat(estValor),
          confirmacao: refund.quote.confirmacao,
          motivo: estMotivo,
        }),
      });

      const dataJson = await res.json();
      if (!res.ok) throw new Error(dataJson.error || 'Erro ao realizar estorno');

      if (dataJson.pending) {
        setRefundResult(dataJson.message);
        return;
      }
      showToast(dataJson.message || 'Estorno registrado.', dataJson.pending ? 'error' : 'success');
      setActiveModal(null);
      setSelectedReserva(null);
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setRefundBusy(false);
    }
  };

  const handleDesbloquear = async (tudo: boolean) => {
    if (!selectedBloqueio || blockBusy) return;

    try {
      setBlockBusy(true);
      const horaAlvo = selectedBloqueioTime || selectedBloqueio.hora_inicio;
      const url = tudo
        ? `/api/reservas/bloqueios/${selectedBloqueio.id}`
        : `/api/reservas/bloqueios/${selectedBloqueio.id}/horario?hora=${horaAlvo}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {},
      });

      if (!res.ok) {
        const dataJson = await res.json();
        throw new Error(dataJson.error || 'Erro ao remover bloqueio');
      }

      showToast('Bloqueio removido com sucesso!', 'success');
      setActiveModal(null);
      setSelectedBloqueio(null);
      fetchGrade();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBlockBusy(false);
    }
  };

  const resetNrForm = () => {
    setNrClienteBusca('');
    setNrClienteId(null);
    setNrQuadraId(null);
    setNrEsporte('');
    setNrInicio('');
    setNrFim('');
    setNrObs('');
    setNrValorPrevisto(0);
    setNrRegistrarPagamento(false);
    setNrPagMetodo('Pix (QR Code na Tela)');
    setNrPagValor('');
    setShowQuickClientForm(false);
    setShowNrAutocomplete(false);
    setQcNome('');
    setQcTelefone('');
    setQcEmail('');
  };

  const resetBqForm = () => {
    setBqQuadraId(null);
    setBqInicio('');
    setBqFim('');
    setBqMotivo('');
  };

  const adjustDate = (stepDays: number) => {
    const step = scope === 'diaria' ? stepDays : stepDays * 7;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + step);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleGridCellClick = (
    quadraId: number,
    dateStr: string,
    hourStr: string,
    reserva?: Reserva,
    bloqueio?: Bloqueio
  ) => {
    if (bloqueio) {
      setSelectedBloqueio(bloqueio);
      setSelectedBloqueioTime(hourStr);
      setActiveModal('gerenciar-bloqueio');
    } else if (reserva) {
      const valPago =
        reserva.valor_pago !== undefined
          ? reserva.valor_pago
          : reserva.status_pagamento === 'Pago'
          ? reserva.valor_total
          : 0;
      setSelectedReserva({ ...reserva, valor_pago: valPago });
      setActiveModal('detalhe-reserva');
    } else {
      resetNrForm();
      setNrQuadraId(quadraId);
      setNrData(dateStr);
      setNrInicio(hourStr);
      setActiveModal('new-reserva');
    }
  };

  const formatCurrency = (val: number | undefined) => {
    const num = Number(val || 0);
    return 'R$ ' + num.toFixed(2).replace('.', ',');
  };

  const formatarDataBR = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Cálculos do Resumo Operacional
  const reservasDoDia = useMemo(() => {
    return (grade?.reservas || []).filter((r) => r.data_reserva === selectedDate && r.status !== 'Cancelada');
  }, [grade, selectedDate]);

  const reservasHojeCount = reservasDoDia.length;

  const receitaPrevista = useMemo(() => {
    return reservasDoDia.reduce((sum, r) => sum + (r.valor_total || 0), 0);
  }, [reservasDoDia]);

  const totalPagoHoje = useMemo(() => {
    return reservasDoDia.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
  }, [reservasDoDia]);

  const percentConfirmado = receitaPrevista > 0 ? Math.round((totalPagoHoje / receitaPrevista) * 100) : 0;

  const pendenciasCount = useMemo(() => {
    return reservasDoDia.filter((r) => r.status_pagamento !== 'Pago').length;
  }, [reservasDoDia]);

  const { taxaOcupacao, horariosLivresCount } = useMemo(() => {
    if (!grade?.quadras || grade.quadras.length === 0) return { taxaOcupacao: 0, horariosLivresCount: 0 };
    let totalSlots = 0;
    let occupiedSlots = 0;

    grade.quadras.forEach((q) => {
      const opening = timeMinutes(q.hora_abertura);
      const closing = timeMinutes(q.hora_fechamento);
      totalSlots += Math.max(0, closing - opening);
      const intervals = [
        ...reservasDoDia.filter((r) => r.quadra_id === q.id),
        ...(grade.bloqueios || []).filter((b) => b.quadra_id === q.id && b.data_bloqueio === selectedDate),
      ].map((item) => ({
        start: Math.max(opening, timeMinutes(item.hora_inicio)),
        end: Math.min(closing, timeMinutes(item.hora_fim)),
      })).filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);

      let lastEnd = opening;
      intervals.forEach(({ start, end }) => {
        occupiedSlots += Math.max(0, end - Math.max(start, lastEnd));
        lastEnd = Math.max(lastEnd, end);
      });
    });

    const taxa = totalSlots > 0 ? Math.min(100, Math.round((occupiedSlots / totalSlots) * 100)) : 0;
    const livres = Math.floor(Math.max(0, totalSlots - occupiedSlots) / gradeInterval);
    return { taxaOcupacao: taxa, horariosLivresCount: livres };
  }, [grade, reservasDoDia, selectedDate, gradeInterval]);

  const summaryValue = (value: string | number) => loading ? '…' : gradeError ? '—' : value;
  const summaryDetail = (value: string) => loading ? 'Carregando...' : gradeError ? 'Dados indisponíveis' : value;

  const reservasPainel = useMemo(() => reservasDoDia
    .filter(r => r.status !== 'Cancelada' && (!filterQuadraId || r.quadra_id === filterQuadraId))
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || a.id - b.id), [reservasDoDia, filterQuadraId]);

  // Próxima reserva da data selecionada, sem reutilizar horários já passados.
  const proximaReserva = useMemo(() => {
    if (loading || gradeError) return null;
    const localNow = new Date(agendaNow.getTime() - agendaNow.getTimezoneOffset() * 60000).toISOString();
    const today = localNow.slice(0, 10);
    if (selectedDate < today) return null;
    return reservasPainel.find(r => r.status !== 'Cancelamento pendente' &&
      (selectedDate > today || r.hora_inicio >= localNow.slice(11, 16))) || null;
  }, [reservasPainel, selectedDate, agendaNow, loading, gradeError]);

  // Render da Grade
  const renderGrade = () => {
    if (loading) {
      return <div className="p-8 text-center text-[#4F5550] text-sm">Carregando grade de quadras...</div>;
    }
    if (gradeError) return <div role="alert" className="p-8 text-center text-sm">{gradeError} <button type="button" onClick={fetchGrade}>Recarregar agenda</button></div>;
    if (!grade || !grade.quadras || grade.quadras.length === 0) {
      return <div className="p-8 text-center text-[#4F5550] text-sm">Nenhuma quadra cadastrada ou ativa.</div>;
    }

    const { quadras: todasQuadras, reservas, bloqueios } = grade;

    let quadrasParaExibir = todasQuadras;
    if (scope === 'semanal') {
      const activeQid = filterQuadraId || todasQuadras[0].id;
      quadrasParaExibir = todasQuadras.filter((q) => q.id === activeQid);
    } else if (filterQuadraId) {
      quadrasParaExibir = todasQuadras.filter((q) => q.id === filterQuadraId);
    }

    if (quadrasParaExibir.length === 0) {
      return (
        <div className="p-8 text-center text-[#4F5550] text-sm">
          Nenhuma quadra selecionada para exibição.
        </div>
      );
    }

    let earliest = '23:59';
    let latest = '00:00';
    quadrasParaExibir.forEach((q) => {
      if (q.hora_abertura && q.hora_abertura < earliest) earliest = q.hora_abertura;
      if (q.hora_fechamento && q.hora_fechamento > latest) latest = q.hora_fechamento;
    });
    const minHour = earliest !== '23:59' ? Number.parseInt(earliest.split(':')[0], 10) : 8;
    const maxHour = latest !== '00:00' ? Number.parseInt(latest.split(':')[0], 10) : 22;

    const timeSlots: string[] = [];
    for (let minutes = minHour * 60; minutes <= maxHour * 60; minutes += gradeInterval) {
      timeSlots.push(minutesTime(minutes));
    }

    const colunas: Coluna[] = [];
    if (scope === 'diaria') {
      quadrasParaExibir.forEach((q) => {
        colunas.push({
          id: `q-${q.id}`,
          label: q.nome,
          subLabel: q.tipo,
          quadra_id: q.id,
          data: selectedDate,
          hora_abertura: q.hora_abertura || '08:00',
          hora_fechamento: q.hora_fechamento || '22:00',
        });
      });
    } else {
      const q = quadrasParaExibir[0];
      const { start } = getWeekRange(selectedDate);
      const curr = new Date(start.getTime());
      const format = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      for (let i = 0; i < 7; i++) {
        const diaStr = curr.toISOString().split('T')[0];
        colunas.push({
          id: `d-${diaStr}`,
          label: format.format(curr),
          subLabel: `${q.nome} — ${q.tipo}`,
          quadra_id: q.id,
          data: diaStr,
          hora_abertura: q.hora_abertura || '08:00',
          hora_fechamento: q.hora_fechamento || '22:00',
        });
        curr.setDate(curr.getDate() + 1);
      }
    }

    const now = new Date();
    const tzOff = now.getTimezoneOffset() * 60000;
    const curTodayStr = new Date(Date.now() - tzOff).toISOString().split('T')[0];
    const currentHourStr = new Date(Date.now() - tzOff).toISOString().split('T')[1].substring(0, 5);

    const rows = [];
    for (let hIndex = 0; hIndex < timeSlots.length; hIndex++) {
      const hourStr = timeSlots[hIndex];
      const row = hIndex + 2;

      const cells = colunas.map((col, idx) => {
        const isPast = col.data < curTodayStr || (col.data === curTodayStr && hourStr < currentHourStr);
        const res = (reservas || []).find(
          (r) =>
            r.quadra_id === col.quadra_id &&
            r.data_reserva === col.data &&
            r.hora_inicio <= hourStr &&
            r.hora_fim > hourStr
        );
        const blq = (bloqueios || []).find(
          (b) =>
            b.quadra_id === col.quadra_id &&
            b.data_bloqueio === col.data &&
            b.hora_inicio < minutesTime(timeMinutes(hourStr) + gradeInterval) &&
            b.hora_fim > hourStr
        );

        return (
          <AdminGradeSlot
            key={col.id}
            col={col}
            idx={idx}
            row={row}
            hourStr={hourStr}
            isPast={isPast}
            res={res}
            blq={blq}
            slotMinutes={gradeInterval}
            onCellClick={handleGridCellClick}
          />
        );
      });

      rows.push(
        <div key={hourStr} style={{ display: 'contents' }}>
          <div
            className="w-[58px] text-[13px] text-[#59615A] font-[Inter,system-ui,sans-serif] font-bold flex items-center justify-center select-none"
            style={{ gridColumn: 1, gridRow: row }}
          >
            {hourStr}
          </div>
          {cells}
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto custom-scrollbar">
        <div
          className="w-full min-w-[500px]"
          style={{
            display: 'grid',
            gridTemplateColumns: `58px repeat(${colunas.length}, minmax(130px, 1fr))`,
            gap: '8px',
          }}
        >
          {/* Canto superior vazio */}
          <div className="w-[58px] h-[58px]" style={{ gridColumn: 1, gridRow: 1 }} />
          {colunas.map((col, idx) => (
            <div
              key={col.id}
              className="h-[58px] bg-[#F7F2EA] rounded-[16px] flex flex-col justify-center items-center p-1 select-none"
              style={{ gridColumn: idx + 2, gridRow: 1 }}
            >
              <div className="text-[13px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold truncate w-full text-center">
                {col.label}
              </div>
              <div className="text-[11px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold truncate w-full text-center opacity-85">
                {col.subLabel}
              </div>
            </div>
          ))}
          {rows}
        </div>
      </div>
    );
  };

  const filteredClientes =
    nrClienteBusca.trim() === ''
      ? []
      : clientes.filter(
          (c) =>
            c.nome.toLowerCase().includes(nrClienteBusca.toLowerCase()) ||
            (c.telefone && c.telefone.includes(nrClienteBusca))
        );

  return (
    <div className="w-full flex flex-col gap-[18px]">
      {pixRecovery.notice}
      {/* Toast Alert */}
      {toast && (
        <ToastLayer><div
          style={{ zIndex: 999999 }}
          className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slideUp border ${
            toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-rose-600 border-rose-500 text-white'
          }`}
        >
          <span>{toast.message}</span>
        </div></ToastLayer>
      )}

      {/* Cabeçalho Reserva Unificado (Conforme a imagem) */}
      <div className="box-border w-full min-h-[64px] shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 select-none">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-xl text-[#071915] hover:bg-[#F1EDE6] transition-colors cursor-pointer border-none"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="box-border flex flex-col gap-[6px] justify-start items-start">
            <div className="text-[12px] leading-none text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
              Reservas / Agenda diária
            </div>
            <h1 className="text-[28px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap m-0">
              Reserva de quadras
            </h1>
          </div>
        </div>

        {/* Ações Cabeçalho: Bloquear + Nova Reserva + Portal do Cliente + Usuário + Notificações */}
        <div className="flex flex-wrap gap-[10px] items-center">
          <button
            type="button"
            onClick={() => {
              setBqData(selectedDate < todayStr ? todayStr : selectedDate);
              setBqAvailability(null);
              const ativas = quadras.filter((q) => q.status === 'Ativa');
              setBqQuadraId(Number(filterQuadraId) || ativas[0]?.id || null);
              setBqInicio('');
              setBqFim('');
              setBqMotivo('Manutenção');
              setActiveModal('bloquear-quadra');
            }}
            className="box-border h-[44px] flex flex-row gap-[8px] px-[18px] items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD6CA] -outline-offset-1 rounded-[14px] text-[14px] text-[#071915] font-bold hover:bg-[#F9F7F3] transition-colors cursor-pointer border-none shadow-xs"
          >
            <Lock size={16} className="text-[#071915]" />
            <span>Bloquear quadra</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetNrForm();
              setNrData(selectedDate);
              setActiveModal('new-reserva');
            }}
            className="box-border h-[44px] shadow-[0px_10px_20px_#07191533] flex flex-row gap-[8px] px-[20px] items-center bg-[#071915] hover:bg-[#1E2522] rounded-[14px] text-[14px] text-[#FFFFFF] font-extrabold transition-colors cursor-pointer border-none"
          >
            <Plus size={17} className="text-[#C9FF3B]" />
            <span>Nova reserva</span>
          </button>

          {/* Portal do Cliente Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPortalMenu(!showPortalMenu)}
              className="box-border h-[34px] flex flex-row gap-[7px] px-[12px] items-center bg-[#ECFFF4] hover:bg-[#DCFCE7] transition-colors rounded-[17px] border-none cursor-pointer shadow-xs active:scale-95"
              title="Portal do Cliente"
            >
              <Globe size={14} className="text-[#008A5A] shrink-0" />
              <span className="text-[12px] text-[#007A50] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap">
                Portal do Cliente
              </span>
            </button>

            {showPortalMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  role="presentation"
                  onClick={() => setShowPortalMenu(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' || e.key === 'Enter') setShowPortalMenu(false);
                  }}
                />
                <div className="absolute right-0 mt-2 w-80 bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-[16px] shadow-xl p-4 z-50 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
                    <span className="text-xs font-bold text-[#071915] flex items-center gap-1.5">
                      <Globe size={14} className="text-[#008A5A]" />
                      Link da Sua Arena
                    </span>
                    <button
                      onClick={() => setShowPortalMenu(false)}
                      className="text-[#6F766F] hover:text-[#071915] p-1 rounded-md"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#4F5550] mb-2 leading-relaxed">
                    Divulgue este link no Instagram, WhatsApp e redes da arena para seus clientes agendarem online:
                  </p>

                  <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-2.5 py-2 rounded-lg border border-[#E6DED2] mb-3">
                    <input
                      type="text"
                      readOnly
                      value={clientPortalUrl}
                      className="flex-1 bg-transparent text-xs text-[#071915] font-mono outline-none truncate select-all"
                    />
                    <button
                      onClick={handleCopy}
                      className="px-2 py-1 rounded bg-[#F7F2EA] hover:bg-[#EFEAE2] border border-[#E6DED2] text-[#071915] text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      {copied ? <Check size={12} className="text-[#008A5A]" /> : <Copy size={12} />}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleOpen}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#071915] text-[#F7F2EA] text-xs font-semibold hover:bg-black transition-colors"
                    >
                      <ExternalLink size={13} />
                      Abrir Portal
                    </button>
                    <button
                      onClick={handleWhatsApp}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#138A4B] text-white text-xs font-semibold hover:bg-[#0E6C3A] transition-colors"
                    >
                      <Share2 size={13} />
                      WhatsApp
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Usuário Logado Pill */}
          <div className="box-border h-[34px] flex flex-row gap-[7px] px-[11px] items-center bg-[#F1EDE6] rounded-[17px] shadow-xs">
            <div className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full" />
            <span className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap">
              {userName}
            </span>
          </div>

          {/* Notificações Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] relative flex items-center justify-center cursor-pointer hover:bg-[#F9F7F3] transition-colors shadow-xs border-none"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell size={16} className="text-[#071915]" />
              {notifications.length > 0 && (
                <div className="box-border w-[7px] h-[7px] absolute right-[6px] top-[6px] bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] -outline-offset-1 rounded-full animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  role="presentation"
                  onClick={() => setShowNotifications(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' || e.key === 'Enter') setShowNotifications(false);
                  }}
                />
                <div className="absolute right-0 mt-2 w-80 bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-[16px] shadow-xl p-4 z-50 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
                    <span className="text-xs font-bold text-[#071915] flex items-center gap-1.5">
                      Notificações
                      {notifications.length > 0 && (
                        <span className="bg-[#D11F2A]/10 text-[#D11F2A] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {notifications.length}
                        </span>
                      )}
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[10px] text-[#6F766F] hover:text-[#071915] transition-colors font-medium bg-transparent border-none cursor-pointer"
                      >
                        Limpar tudo
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#6F766F]">
                        Nenhuma notificação no momento.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-lg bg-white/70 border border-[#E6DED2] text-xs"
                        >
                          <p className="font-semibold text-[#071915] mb-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filtros de Agenda */}
      <div className="box-border w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-1 select-none">
        {/* Controle Data */}
        <div className="flex flex-row gap-[10px] items-center">
          <button
            type="button"
            onClick={() => adjustDate(-1)}
            className="w-[42px] h-[42px] flex items-center justify-center bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
            title="Dia anterior"
          >
            <ChevronLeft size={18} className="text-[#071915]" />
          </button>
          <button
            type="button"
            onClick={() => adjustDate(1)}
            className="w-[42px] h-[42px] flex items-center justify-center bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
            title="Próximo dia"
          >
            <ChevronRight size={18} className="text-[#071915]" />
          </button>
          <div
            className="box-border h-[42px] flex flex-row gap-[10px] px-[16px] items-center bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] shadow-xs cursor-pointer hover:bg-[#F9F7F3] transition-colors relative"
            
          >
            <DatePicker
              id="main-date-picker"
              aria-label="Data da agenda"
              required
              value={selectedDate}
              
              onValueChange={(value) => value && setSelectedDate(value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <CalendarDays size={17} className="text-[#071915] pointer-events-none shrink-0" />
            <span className="text-[15px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold whitespace-nowrap pointer-events-none">
              {formatarDataBR(selectedDate)}
            </span>
          </div>
        </div>

        {/* Diária, Semanal e Todas as quadras estritamente lado a lado */}
        <div className="flex flex-row items-center gap-[10px] shrink-0 flex-nowrap">
          {/* Alternador Diária / Semanal */}
          <div className="bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] p-[2px] flex flex-row items-center shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setScope('diaria');
                setFilterQuadraId('');
              }}
              className={`h-[38px] px-[18px] rounded-[12px] text-[14px] font-extrabold cursor-pointer border-none transition-all flex items-center justify-center ${
                scope === 'diaria'
                  ? 'bg-[#071915] text-white shadow-xs'
                  : 'bg-transparent text-[#071915] hover:bg-[#F9F7F3]'
              }`}
            >
              Diária
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('semanal');
                const ativas = quadras.filter((q) => q.status === 'Ativa');
                if (filterQuadraId === '' && ativas.length > 0) {
                  setFilterQuadraId(ativas[0].id);
                }
              }}
              className={`h-[38px] px-[18px] rounded-[12px] text-[14px] font-extrabold cursor-pointer border-none transition-all flex items-center justify-center ${
                scope === 'semanal'
                  ? 'bg-[#071915] text-white shadow-xs'
                  : 'bg-transparent text-[#071915] hover:bg-[#F9F7F3]'
              }`}
            >
              Semanal
            </button>
          </div>

          {/* Select Todas as quadras com seta */}
          <div className="relative shrink-0">
            <select
              value={filterQuadraId}
              onChange={(e) => setFilterQuadraId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ backgroundImage: 'none' }}
              className="h-[42px] pl-[18px] pr-[38px] bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[14px] text-[14px] text-[#071915] font-extrabold cursor-pointer border-none shadow-xs appearance-none [background-image:none] focus:outline-none"
            >
              {scope === 'diaria' && <option value="">Todas as quadras</option>}
              {quadras
                .filter((q) => q.status === 'Ativa')
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome} — {q.tipo}
                  </option>
                ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[#071915]"
            />
          </div>
        </div>
      </div>

      {/* Resumo Operacional */}
      <section aria-label="Resumo operacional" aria-busy={loading} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] w-full select-none">
        {/* Card 1: Reservas hoje */}
        <div className="p-[18px_20px] bg-[#FFFFFF] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[20px] flex flex-col gap-[6px] shadow-xs">
          <div className="text-[12px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold">
            {selectedDate === todayStr ? 'Reservas hoje' : 'Reservas do dia'}
          </div>
          <div className="text-[30px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold leading-tight">
            {summaryValue(reservasHojeCount)}
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[7px] h-[7px] bg-[#C9FF3B] rounded-full" />
            <span className="text-[12px] text-[#6F766F] font-normal">
              {summaryDetail(`${reservasHojeCount} na agenda`)}
            </span>
          </div>
        </div>

        {/* Card 2: Receita prevista */}
        <div className="p-[18px_20px] bg-[#FFFFFF] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[20px] flex flex-col gap-[6px] shadow-xs">
          <div className="text-[12px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold">
            Receita prevista
          </div>
          <div className="text-[30px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold leading-tight">
            {summaryValue(formatCurrency(receitaPrevista))}
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[7px] h-[7px] bg-[#43B7FF] rounded-full" />
            <span className="text-[12px] text-[#6F766F] font-normal">
              {summaryDetail(`${percentConfirmado}% confirmado`)}
            </span>
          </div>
        </div>

        {/* Card 3: Ocupação */}
        <div className="p-[18px_20px] bg-[#FFFFFF] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[20px] flex flex-col gap-[6px] shadow-xs">
          <div className="text-[12px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold">
            Ocupação
          </div>
          <div className="text-[30px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold leading-tight">
            {summaryValue(`${taxaOcupacao}%`)}
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[7px] h-[7px] bg-[#FFB545] rounded-full" />
            <span className="text-[12px] text-[#6F766F] font-normal">
              {summaryDetail(`${horariosLivresCount} horários livres`)}
            </span>
          </div>
        </div>

        {/* Card 4: Pendências */}
        <div className="p-[18px_20px] bg-[#FFFFFF] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[20px] flex flex-col gap-[6px] shadow-xs">
          <div className="text-[12px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold">
            Pendências
          </div>
          <div className="text-[30px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold leading-tight">
            {summaryValue(pendenciasCount)}
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[7px] h-[7px] bg-[#C8661A] rounded-full" />
            <span className="text-[12px] text-[#6F766F] font-normal">
              {summaryDetail(pendenciasCount > 0 ? 'pagamentos pendentes' : 'Nenhum pagamento pendente')}
            </span>
          </div>
        </div>
      </section>

      {/* Conteúdo Agenda e Detalhes */}
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-[18px] w-full items-start">
        {/* Agenda Todas as Quadras */}
        <div className="bg-[#FFFFFF] [box-shadow:0px_16px_40px_#07191510] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[26px] p-[20px] flex flex-col gap-[16px] shadow-sm">
          {/* Cabeçalho Grade */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full select-none">
            <div className="flex flex-col gap-[4px]">
              <h2 className="text-[20px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold m-0">
                {scope === 'diaria'
                  ? filterQuadraId
                    ? quadras.find((q) => q.id === filterQuadraId)?.nome
                    : 'Todas as quadras'
                  : quadras.find((q) => q.id === filterQuadraId)?.nome || 'Todas as quadras'}
              </h2>
              <div className="text-[13px] text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal">
                Clique em um horário livre para reservar
              </div>
            </div>

            {/* Legenda Status */}
            <div className="flex flex-wrap gap-[10px] items-center">
              <div className="flex items-center gap-[5px]">
                <div className="w-[8px] h-[8px] bg-[#138A4B] rounded-full" />
                <span className="text-[12px] text-[#59615A] font-[Inter,system-ui,sans-serif]">Pago</span>
              </div>
              <div className="flex items-center gap-[5px]">
                <div className="w-[8px] h-[8px] bg-[#C8661A] rounded-full" />
                <span className="text-[12px] text-[#59615A] font-[Inter,system-ui,sans-serif]">Pendente</span>
              </div>
              <div className="flex items-center gap-[5px]">
                <div className="w-[8px] h-[8px] bg-[#2E5BFF] rounded-full" />
                <span className="text-[12px] text-[#59615A] font-[Inter,system-ui,sans-serif]">Parcial</span>
              </div>
              <div className="flex items-center gap-[5px]">
                <div className="w-[8px] h-[8px] bg-[#152238] rounded-full" />
                <span className="text-[12px] text-[#59615A] font-[Inter,system-ui,sans-serif]">Bloqueado</span>
              </div>
            </div>
          </div>

          {/* Grade de Horários */}
          {renderGrade()}
        </div>

        {/* Painel Lateral de Reservas */}
        <div className="flex flex-col gap-[14px] w-full">
          {/* Próxima Reserva (Dark Pill Card) */}
          <div role="region" aria-label="Próxima reserva" className="box-border w-full min-h-[164px] shrink-0 [box-shadow:0px_14px_30px_#07191525] flex flex-col gap-[8px] p-[20px] justify-between bg-[#071915] rounded-[24px] text-white">
            <div className="flex flex-col gap-[4px]">
              <div className="text-[13px] text-[#A7B6AE] font-[Inter,system-ui,sans-serif] font-normal">
                Próxima reserva
              </div>
              <div className="text-[28px] text-[#C9FF3B] font-[Inter,system-ui,sans-serif] font-extrabold leading-tight">
                {proximaReserva
                  ? `${proximaReserva.hora_inicio} · ${
                      grade?.quadras.find((q) => q.id === proximaReserva.quadra_id)?.nome || `Quadra #${proximaReserva.quadra_id}`
                    }`
                  : loading ? 'Carregando...' : gradeError ? 'Agenda indisponível' : 'Nenhuma reserva a seguir'}
              </div>
              <div className="text-[12px] text-[#A7B6AE] font-[Inter,system-ui,sans-serif] font-normal">
                {proximaReserva
                  ? `${proximaReserva.cliente_nome} · ${proximaReserva.status_pagamento.toLowerCase()}`
                  : loading ? 'Consultando reservas da arena.' : gradeError ? 'Recarregue a agenda para consultar as reservas.' : 'Não há próximos horários na data e quadra selecionadas.'}
              </div>
            </div>

            {proximaReserva && <div className="flex flex-row gap-[10px] items-center pt-2">
              {proximaReserva.valor_pago < proximaReserva.valor_total && <button
                type="button"
                onClick={() => {
                  if (proximaReserva) {
                    setSelectedReserva(proximaReserva);
                    setPagValor(
                      formatFloatToCurrencyInput(
                        Math.max(0, proximaReserva.valor_total - proximaReserva.valor_pago)
                      )
                    );
                    setPagDesconto('');
                    setPagMetodo('');
                    setPagData(new Date().toISOString().split('T')[0]);
                    setActiveModal('registrar-pagamento');
                  }
                }}
                className="h-[38px] px-[16px] flex items-center justify-center bg-[#C9FF3B] hover:bg-[#BCEE30] text-[#071915] rounded-[12px] font-[Inter,system-ui,sans-serif] font-extrabold text-[12px] cursor-pointer border-none transition-colors"
              >
                Registrar pagamento
              </button>}
              <button
                type="button"
                onClick={() => {
                  if (proximaReserva) {
                    setSelectedReserva(proximaReserva);
                    setActiveModal('detalhe-reserva');
                  }
                }}
                className="h-[38px] px-[16px] flex items-center justify-center bg-[#17332B] hover:bg-[#20443A] text-[#FFFFFF] rounded-[12px] font-[Inter,system-ui,sans-serif] font-extrabold text-[12px] cursor-pointer border-none transition-colors"
              >
                Detalhes
              </button>
            </div>}
          </div>

          {/* Alertas Operacionais (Atenção) */}
          <div className="box-border w-full min-h-[90px] shrink-0 flex flex-col gap-[6px] p-[18px] justify-start bg-[#FFFDF5] outline outline-1 outline-[#FFB545]/60 -outline-offset-1 rounded-[20px] shadow-xs">
            <div className="text-[14px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold">
              Atenção
            </div>
            <div className="text-[12px] leading-[18px] text-[#7A5A1A] font-[Inter,system-ui,sans-serif] font-normal">
              {loading ? 'Consultando pendências...' : gradeError ? 'Pendências indisponíveis.' : pendenciasCount > 0
                ? `${pendenciasCount} reserva(s) com pendência de pagamento na data selecionada.`
                : 'Nenhuma pendência de pagamento na data selecionada.'}
            </div>
          </div>

          {/* Fila de hoje */}
          <div className="box-border w-full flex flex-col gap-[6px] p-[16px] justify-start bg-[#FFFFFF] outline outline-1 outline-[#E9E0D4] -outline-offset-1 rounded-[20px] shadow-xs">
            <div className="text-[14px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold mb-1 px-1">
              Reservas da data selecionada
            </div>

            <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scrollbar pr-0.5">
              {loading ? <p>Carregando reservas...</p> : gradeError ? <p>Reservas indisponíveis.</p> : reservasPainel.length === 0 ? <p>Nenhuma reserva na data e quadra selecionadas.</p> : reservasPainel.map((r) => {
                let dotBg = 'bg-[#C8661A]';
                if (r.status_pagamento === 'Pago') dotBg = 'bg-[#138A4B]';
                if (r.status_pagamento === 'Parcial') dotBg = 'bg-[#2E5BFF]';
                if (r.status_pagamento === 'Bloqueado') dotBg = 'bg-[#152238]';

                const quadraNome =
                  grade?.quadras.find((q) => q.id === r.quadra_id)?.nome || `Quadra #${r.quadra_id}`;

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedReserva(r);
                      setActiveModal('detalhe-reserva');
                    }}
                    className="w-full min-h-[38px] flex items-center justify-between p-2 rounded-xl hover:bg-[#F9F7F3] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <div className={`w-[8px] h-[8px] ${dotBg} rounded-full shrink-0`} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold truncate">
                          {r.cliente_nome}
                        </span>
                        <span className="text-[11px] text-[#6F766F] font-[Inter,system-ui,sans-serif] truncate">
                          {r.hora_inicio} · {quadraNome} · {r.status_pagamento.toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[#A7B6AE] shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* MODAL 1: NOVA RESERVA (Conforme mockup Pen.dev) */}
      {activeModal === 'new-reserva' && (
        <div
          data-pencil-name="Overlay Escuro Modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#071915]/60 backdrop-blur-[4px] animate-fadeIn overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-nova-reserva-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => setActiveModal(null)}
            aria-hidden="true"
          />
          <div
            data-pencil-name="Modal Nova Reserva"
            className="box-border w-full max-w-[560px] max-h-[92vh] overflow-y-auto custom-scrollbar shadow-[0px_30px_70px_#07191555] flex flex-col gap-[12px] p-[20px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] relative z-10 my-auto"
          >
            {/* Cabeçalho Modal Reserva */}
            <div
              data-pencil-name="Cabeçalho Modal Reserva"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Título Modal Grupo"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[12px] justify-start items-center"
              >
                <div
                  data-pencil-name="Ícone Calendário Modal"
                  className="box-border w-[40px] shrink-0 h-[40px] flex flex-row gap-0 justify-center items-center bg-[#EAF9C7] rounded-[12px]"
                >
                  <CalendarPlus size={20} className="text-[#071915]" />
                </div>
                <div
                  data-pencil-name="Texto Cabeçalho Modal"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                >
                  <div
                    id="modal-nova-reserva-title"
                    data-pencil-name="Título Nova Reserva"
                    className="text-[22px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Nova Reserva
                  </div>
                  <div
                    data-pencil-name="Subtítulo Nova Reserva"
                    className="text-[12px] leading-tight text-[#7A7269] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Agendamento manual de quadra e controle de balcão
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-pencil-name="Fechar Modal"
                onClick={() => setActiveModal(null)}
                className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] hover:bg-[#EAE4DC] transition-colors rounded-[12px] cursor-pointer border-none text-[#6F675F] hover:text-[#071915]"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bloco Cliente */}
            <div
              data-pencil-name="Bloco Cliente"
              className="box-border w-full flex flex-col gap-[10px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
            >
              <div
                data-pencil-name="Topo Cliente"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
              >
                <div
                  data-pencil-name="Label Cliente"
                  className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                >
                  Atleta / Cliente *
                </div>
                {!showQuickClientForm && !nrClienteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickClientForm(true);
                      setQcNome(nrClienteBusca);
                    }}
                    data-pencil-name="Cadastrar Novo Atleta"
                    className="text-[12px] text-[#138A4B] hover:underline font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap bg-transparent border-none cursor-pointer p-0"
                  >
                    + Cadastrar Novo Atleta
                  </button>
                )}
              </div>

              {/* Se o cliente já foi selecionado */}
              {nrClienteId && !showQuickClientForm ? (
                <div
                  data-pencil-name="Cliente Selecionado"
                  className="box-border w-full h-[58px] shrink-0 flex flex-row gap-[12px] p-[10px] justify-start items-center bg-[#F5F1EA] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[12px]"
                >
                  <div
                    data-pencil-name="Avatar Cliente"
                    className="box-border w-[38px] shrink-0 h-[38px] bg-[#071915] rounded-full flex items-center justify-center text-[13px] font-bold text-[#C9FF3B]"
                  >
                    {nrClienteBusca ? nrClienteBusca.substring(0, 2).toUpperCase() : 'AT'}
                  </div>
                  <div
                    data-pencil-name="Dados Cliente Selecionado"
                    className="box-border flex-1 h-fit flex flex-col gap-[4px] justify-start items-start min-w-0"
                  >
                    <div
                      data-pencil-name="Nome Cliente Selecionado"
                      className="text-[14px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left truncate w-full"
                    >
                      {nrClienteBusca}
                    </div>
                    <div
                      data-pencil-name="Telefone Cliente"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[5px] justify-start items-center"
                    >
                      <MessageCircle size={13} className="text-[#138A4B] shrink-0" />
                      <div
                        data-pencil-name="Número Cliente"
                        className="text-[12px] text-[#6F675F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                      >
                        {clientes.find((c) => c.id === nrClienteId)?.telefone || 'Telefone não informado'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNrClienteId(null);
                      setNrClienteBusca('');
                    }}
                    data-pencil-name="Botão Trocar Cliente"
                    className="box-border w-fit shrink-0 h-[32px] flex flex-row gap-0 px-[12px] justify-start items-center bg-[#FFFFFF] hover:bg-[#F9F7F3] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[9px] text-[12px] text-[#071915] font-extrabold cursor-pointer border-none transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : showQuickClientForm ? (
                /* Formulário Inline de Cadastro Rápido */
                <div
                  data-pencil-name="Cadastro Rápido Inline"
                  className="box-border w-full h-fit shrink-0 flex flex-col gap-[8px] p-[12px] justify-start items-start bg-[#FFF9ED] outline outline-1 outline-[#F0D39C] -outline-offset-1 rounded-[12px]"
                >
                  <div className="flex justify-between items-center w-full mb-0.5">
                    <span className="text-[11px] font-bold text-[#6F4E18] uppercase tracking-wider">
                      Novo Atleta
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickClientForm(false)}
                      className="text-[11px] text-[#8A6D3B] hover:text-[#071915] font-semibold bg-transparent border-none cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div
                    data-pencil-name="Linha Cadastro Rápido 1"
                    className="box-border w-full h-fit shrink-0 flex flex-col sm:flex-row gap-[8px] justify-start items-start"
                  >
                    <input
                      type="text"
                      placeholder="Nome completo *"
                      value={qcNome}
                      onChange={(e) => {
                        setQcNome(e.target.value);
                        if (qcErrors.nome) setQcErrors((prev) => ({ ...prev, nome: undefined }));
                      }}
                      className={`box-border w-full sm:flex-1 h-[34px] px-[10px] bg-[#FFFFFF] outline outline-1 ${
                        qcErrors.nome ? 'outline-red-500 bg-red-50/40 text-red-900' : 'outline-[#E7D9C2]'
                      } -outline-offset-1 rounded-[8px] text-[12px] text-[#071915] placeholder-[#9C9389]`}
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp *"
                      value={qcTelefone}
                      onChange={(e) => {
                        setQcTelefone(maskPhone(e.target.value));
                        if (qcErrors.telefone) setQcErrors((prev) => ({ ...prev, telefone: undefined }));
                      }}
                      className={`box-border w-full sm:flex-1 h-[34px] px-[10px] bg-[#FFFFFF] outline outline-1 ${
                        qcErrors.telefone ? 'outline-red-500 bg-red-50/40 text-red-900' : 'outline-[#E7D9C2]'
                      } -outline-offset-1 rounded-[8px] text-[12px] text-[#071915] placeholder-[#9C9389]`}
                    />
                  </div>
                  <div
                    data-pencil-name="Linha Cadastro Rápido 2"
                    className="box-border w-full h-fit shrink-0 flex flex-col sm:flex-row gap-[8px] justify-start items-start"
                  >
                    <input
                      type="email"
                      placeholder="E-mail opcional"
                      value={qcEmail}
                      onChange={(e) => {
                        setQcEmail(e.target.value);
                        if (qcErrors.email) setQcErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={`box-border w-full sm:flex-1 h-[34px] px-[10px] bg-[#FFFFFF] outline outline-1 ${
                        qcErrors.email ? 'outline-red-500 bg-red-50/40 text-red-900' : 'outline-[#E7D9C2]'
                      } -outline-offset-1 rounded-[8px] text-[12px] text-[#071915] placeholder-[#9C9389]`}
                    />
                    <button
                      type="button"
                      onClick={handleQuickClientCreate}
                      disabled={qcLoading}
                      data-pencil-name="Salvar e Selecionar"
                      className="box-border w-full sm:w-fit shrink-0 h-[34px] px-[12px] flex items-center justify-center bg-[#071915] hover:bg-[#1E2522] rounded-[8px] text-[12px] text-[#FFFFFF] font-extrabold cursor-pointer border-none disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {qcLoading ? 'Salvando...' : 'Salvar e Selecionar'}
                    </button>
                  </div>
                  {(qcErrors.nome || qcErrors.telefone || qcErrors.email) && (
                    <span className="text-[11px] text-red-600 font-medium">
                      {qcErrors.nome || qcErrors.telefone || qcErrors.email}
                    </span>
                  )}
                </div>
              ) : (
                /* Campo de Busca de Atleta */
                <div className="relative w-full">
                  <div
                    data-pencil-name="Busca Atleta"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px]"
                  >
                    <Search size={16} className="text-[#9C9389] shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar atleta por nome ou WhatsApp..."
                      value={nrClienteBusca}
                      onChange={(e) => {
                        setNrClienteBusca(e.target.value);
                        setShowNrAutocomplete(true);
                        setNrClienteId(null);
                      }}
                      onBlur={() => setTimeout(() => setShowNrAutocomplete(false), 200)}
                      className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder-[#9C9389] font-[Inter,system-ui,sans-serif]"
                      autoComplete="off"
                    />
                  </div>
                  {showNrAutocomplete && filteredClientes.length > 0 && (
                    <ul className="absolute top-full left-0 w-full bg-white border border-[#E6DED2] rounded-xl max-h-48 overflow-y-auto z-50 list-none p-1 m-0 shadow-xl mt-1">
                      {filteredClientes.map((c) => (
                        <li
                          key={c.id}
                          className="px-3 py-2 cursor-pointer hover:bg-[#F5F1EA] text-[13px] rounded-lg text-[#071915] flex justify-between items-center"
                          onMouseDown={() => {
                            setNrClienteBusca(c.nome);
                            setNrClienteId(c.id);
                            setShowNrAutocomplete(false);
                          }}
                        >
                          <div>
                            <strong>{c.nome}</strong>
                            <span className="text-[11px] text-[#6F766F] ml-2">
                              {c.telefone || ''}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#4F5550] font-semibold bg-[#F1EDE6] px-2 py-0.5 rounded-full">
                            Selecionar
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Bloco Local Modalidade */}
            <div
              data-pencil-name="Bloco Local Modalidade"
              className="box-border w-full flex flex-col gap-[10px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
            >
              <div
                data-pencil-name="Linha Local Modalidade"
                className="box-border w-full h-fit shrink-0 flex flex-col sm:flex-row gap-[12px] justify-start items-start"
              >
                {/* Grupo Quadra */}
                <div
                  data-pencil-name="Grupo Quadra"
                  className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                >
                  <label
                    data-pencil-name="Label Quadra"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Quadra *
                  </label>
                  <div
                    data-pencil-name="Select Quadra"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                  >
                    <MapPin size={15} className="text-[#6F675F] shrink-0" />
                    <select
                      value={nrQuadraId || ''}
                      onChange={(e) => setNrQuadraId(Number(e.target.value) || null)}
                      style={{ backgroundImage: 'none' }}
                      className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer appearance-none [background-image:none] pr-5 truncate"
                      required
                    >
                      <option value="">Selecione a quadra</option>
                      {quadras
                        .filter((q) => q.status === 'Ativa')
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.nome} ({q.tipo})
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                  </div>
                </div>

                {/* Grupo Modalidade */}
                <div
                  data-pencil-name="Grupo Modalidade"
                  className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                >
                  <label
                    data-pencil-name="Label Modalidade"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Esporte / Modalidade *
                  </label>
                  <div
                    data-pencil-name="Select Modalidade"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                  >
                    <Trophy size={15} className="text-[#6F675F] shrink-0" />
                    <select
                      value={nrEsporte}
                      onChange={(e) => setNrEsporte(e.target.value)}
                      disabled={!nrQuadraId}
                      style={{ backgroundImage: 'none' }}
                      className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer appearance-none [background-image:none] pr-5 truncate disabled:opacity-60"
                      required
                    >
                      <option value="">{nrQuadraId ? 'Selecione a modalidade' : 'Selecione a quadra primeiro'}</option>
                      {modalidadesQuadra.map((m) => (
                        <option key={m.nome} value={m.nome}>
                          {m.nome} — {formatCurrency(m.preco)}/h
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Data Duração */}
            <div
              data-pencil-name="Bloco Data Duração"
              className="box-border w-full flex flex-col gap-[10px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
            >
              <div
                data-pencil-name="Linha Data Horários"
                className="box-border w-full h-fit shrink-0 flex flex-col sm:flex-row gap-[10px] justify-start items-start"
              >
                {/* Grupo Data */}
                <div
                  data-pencil-name="Grupo Data"
                  className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                >
                  <label
                    data-pencil-name="Label Data"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Data *
                  </label>
                  <div
                    data-pencil-name="Select Data"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] cursor-pointer"
                    
                  >
                    <CalendarDays size={15} className="text-[#6F675F] shrink-0 pointer-events-none" />
                    <DatePicker
                      
                      id="nr-data"
                      value={nrData}
                      min={todayStr}
                      
                      onValueChange={(value) => {
                        const val = value;
                        if (val < todayStr) {
                          showToast('Não é possível selecionar datas passadas para agendamento.', 'error');
                          setNrData(todayStr);
                          return;
                        }
                        setNrData(val);
                      }}
                      className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer hide-native-picker"
                      required
                    />
                  </div>
                </div>

                {/* Grupo Início */}
                <div
                  data-pencil-name="Grupo Inicio"
                  className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                >
                  <label
                    data-pencil-name="Label Inicio"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Início *
                  </label>
                  <div
                    data-pencil-name="Select Inicio"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                  >
                    <Clock size={15} className="text-[#6F675F] shrink-0" />
                    <select
                      value={nrInicio}
                      onChange={(e) => {
                        setNrInicio(e.target.value);
                        setNrFim('');
                      }}
                      disabled={!nrQuadraId}
                      style={{ backgroundImage: 'none' }}
                      className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer appearance-none [background-image:none] pr-5 disabled:opacity-60"
                      required
                    >
                      <option value="">{nrQuadraId ? 'Início' : 'Quadra'}</option>
                      {nrHorariosInicio.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                  </div>
                </div>

                {/* Grupo Fim */}
                <div
                  data-pencil-name="Grupo Fim"
                  className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                >
                  <label
                    data-pencil-name="Label Fim"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Fim *
                  </label>
                  <div
                    data-pencil-name="Select Fim"
                    className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                  >
                    <Clock size={15} className="text-[#6F675F] shrink-0" />
                    <select
                      value={nrFim}
                      onChange={(e) => setNrFim(e.target.value)}
                      disabled={!nrInicio}
                      style={{ backgroundImage: 'none' }}
                      className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer appearance-none [background-image:none] pr-5 disabled:opacity-60"
                      required
                    >
                      <option value="">{nrInicio ? 'Fim' : 'Início'}</option>
                      {nrHorariosFim.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div
                data-pencil-name="Observações Reserva"
                className="box-border w-full h-[38px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px]"
              >
                <NotebookPen size={15} className="text-[#9C9389] shrink-0" />
                <input
                  type="text"
                  placeholder="Observações: precisa de empréstimo de 4 raquetes, etc."
                  maxLength={100}
                  value={nrObs}
                  onChange={(e) => setNrObs(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] placeholder-[#9C9389] font-[Inter,system-ui,sans-serif]"
                />
              </div>
            </div>

            {/* Resumo de Preço */}
            <div
              data-pencil-name="Resumo de Preço"
              className="box-border w-full h-[78px] shrink-0 flex flex-row gap-0 p-[16px] justify-between items-center bg-[#F5F1EA] outline outline-1 outline-[#E0D6CA] -outline-offset-1 rounded-[14px]"
            >
              <div
                data-pencil-name="Texto Resumo Preço"
                className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
              >
                <div
                  data-pencil-name="Label Resumo Preço"
                  className="text-[12px] leading-tight text-[#6F675F] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                >
                  Resumo de preço
                </div>
                <div
                  data-pencil-name="Cálculo Preço"
                  className="text-[14px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  {nrEsporte ? `${nrEsporte} • ` : ''}{duracaoHoras > 0 ? `${duracaoHoras} hora(s)` : 'Horário a definir'}
                </div>
              </div>
              <div
                data-pencil-name="Valor Total Reserva"
                className="text-[28px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {formatCurrency(nrValorPrevisto)}
              </div>
            </div>

            {/* Pagamento Balcão */}
            <div
              data-pencil-name="Pagamento Balcão"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] p-[14px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[14px]"
            >
              <div
                data-pencil-name="Toggle Pagamento"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[10px] justify-start items-center cursor-pointer select-none"
                onClick={() => {
                  const nextVal = !nrRegistrarPagamento;
                  setNrRegistrarPagamento(nextVal);
                  if (nextVal && !nrPagValor) {
                    setNrPagValor(nrValorPrevisto.toFixed(2));
                  }
                }}
              >
                <div
                  data-pencil-name="Switch Pagamento Ativo"
                  className={`box-border w-[42px] shrink-0 h-[24px] rounded-[12px] relative transition-colors ${
                    nrRegistrarPagamento ? 'bg-[#138A4B]' : 'bg-[#DDD4C8]'
                  }`}
                >
                  <div
                    data-pencil-name="Knob Switch Pagamento"
                    className={`box-border w-[18px] h-[18px] absolute top-[3px] bg-[#FFFFFF] rounded-full shadow-xs transition-all ${
                      nrRegistrarPagamento ? 'left-[21px]' : 'left-[3px]'
                    }`}
                  />
                </div>
                <div
                  data-pencil-name="Texto Toggle Pagamento"
                  className="text-[13px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                >
                  Registrar pagamento agora no balcão
                </div>
              </div>

              {nrRegistrarPagamento && (
                <div
                  data-pencil-name="Campos Pagamento"
                  className="box-border w-full h-fit shrink-0 flex flex-col sm:flex-row gap-[10px] justify-start items-start pt-1"
                >
                  <div
                    data-pencil-name="Grupo Forma Pagamento"
                    className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                  >
                    <label
                      data-pencil-name="Label Forma Pagamento"
                      className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Forma de pagamento *
                    </label>
                    <div
                      data-pencil-name="Select Forma Pagamento"
                      className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                    >
                      <CreditCard size={15} className="text-[#6F675F] shrink-0" />
                      <select
                        value={nrPagMetodo}
                        onChange={(e) => setNrPagMetodo(e.target.value)}
                        style={{ backgroundImage: 'none' }}
                        className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal cursor-pointer appearance-none [background-image:none] pr-5 truncate"
                      >
                        <option value="Pix (QR Code na Tela)">Pix (QR Code na tela)</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Pix (Manual)">Pix (Manual)</option>
                      </select>
                      <ChevronDown size={14} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                    </div>
                  </div>

                  <div
                    data-pencil-name="Grupo Valor Pago"
                    className="box-border w-full sm:flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
                  >
                    <label
                      data-pencil-name="Label Valor Pago"
                      className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Valor Pago (R$) *
                    </label>
                    <div
                      data-pencil-name="Input Valor Pago"
                      className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px]"
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={nrPagValor}
                        onChange={(e) => setNrPagValor(e.target.value)}
                        placeholder={nrValorPrevisto.toFixed(2)}
                        className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Modal Reserva */}
            <div
              data-pencil-name="Rodapé Modal Reserva"
              className="box-border w-full h-[44px] shrink-0 flex flex-row gap-[12px] justify-end items-center pt-2"
            >
              <button
                type="button"
                data-pencil-name="Botão Cancelar Modal"
                onClick={() => setActiveModal(null)}
                className="box-border w-fit shrink-0 h-[42px] px-[18px] flex items-center justify-center bg-transparent hover:bg-[#F1EDE6] rounded-[10px] text-[14px] text-[#6F675F] hover:text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold cursor-pointer border-none transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-pencil-name="Botão Confirmar Reserva Modal"
                onClick={handleConfirmarReserva}
                className="box-border w-fit shrink-0 h-[44px] shadow-[0px_12px_24px_#07191522] flex flex-row gap-[8px] px-[20px] justify-start items-center bg-[#071915] hover:bg-[#1E2522] rounded-[12px] cursor-pointer border-none transition-all active:scale-95"
              >
                <Check size={16} className="text-[#C9FF3B]" />
                <span
                  data-pencil-name="Texto Confirmar Reserva"
                  className="text-[14px] text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap"
                >
                  {nrRegistrarPagamento ? 'Confirmar e Baixar Pagamento' : 'Confirmar Reserva'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES DA RESERVA */}
      <div className={`modal-overlay ${activeModal === 'detalhe-reserva' ? 'open' : ''}`}>
        {selectedReserva && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Reserva #{selectedReserva.id}</h2>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Status</span>
                <span
                  className={`badge ${
                    selectedReserva.status_pagamento === 'Pago'
                      ? 'badge--paid'
                      : selectedReserva.status_pagamento === 'Parcial'
                      ? 'badge--partial'
                      : 'badge--pending'
                  }`}
                >
                  {selectedReserva.status_pagamento}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Cliente</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--charcoal)' }}>
                  {selectedReserva.cliente_nome}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Quadra</span>
                <span style={{ fontSize: '13px', color: 'var(--charcoal)' }}>
                  {grade?.quadras.find((q) => q.id === selectedReserva.quadra_id)?.nome || 'Quadra'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Horário</span>
                <span style={{ fontSize: '13px', color: 'var(--charcoal)' }}>
                  {formatarDataBR(selectedReserva.data_reserva)} às {selectedReserva.hora_inicio.substring(0, 5)} -{' '}
                  {selectedReserva.hora_fim.substring(0, 5)}
                </span>
              </div>
              {selectedReserva.esporte && selectedReserva.esporte !== 'Geral' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Esporte / Modalidade</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent, #2563eb)' }}>
                    {selectedReserva.esporte}
                  </span>
                </div>
              )}
              {selectedReserva.observacoes && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Notas</span>
                  <span style={{ fontSize: '13px', color: 'var(--charcoal)', fontStyle: 'italic' }}>
                    {selectedReserva.observacoes}
                  </span>
                </div>
              )}
              <div style={{ height: '1px', background: 'var(--border-passive)', margin: 'var(--s-1) 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Valor Total</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--charcoal)' }}>
                  {formatCurrency(selectedReserva.valor_total)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Valor Pago</span>
                <span style={{ fontSize: '13px', color: 'var(--paid)', fontWeight: 500 }}>
                  {formatCurrency(selectedReserva.valor_pago)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Saldo Devedor</span>
                <span style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 600 }}>
                  {formatCurrency(Math.max(0, selectedReserva.valor_total - selectedReserva.valor_pago))}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              {selectedReserva.valor_pago > 0 && (
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(155, 34, 38, 0.3)' }}
                  onClick={() => {
                    setEstValor(formatFloatToCurrencyInput(selectedReserva.valor_pago));
                    setEstMotivo('');
                    setRefundResult('');
                    setActiveModal('estornar-pagamento');
                  }}
                >
                  Estornar
                </button>
              )}
              <button
                className="btn-ghost"
                style={{ color: 'var(--danger)', borderColor: 'rgba(155, 34, 38, 0.3)' }}
                onClick={() => {
                  setMotivoCancelamento('');
                  setObsCancelamento('');
                  setActiveModal('cancelar-reserva');
                }}
              >
                Cancelar
              </button>
              {selectedReserva.valor_pago < selectedReserva.valor_total && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setPagValor(
                      formatFloatToCurrencyInput(
                        Math.max(0, selectedReserva.valor_total - selectedReserva.valor_pago)
                      )
                    );
                    setPagDesconto('');
                    setPagMetodo('');
                    setPagData(new Date().toISOString().split('T')[0]);
                    setActiveModal('registrar-pagamento');
                  }}
                >
                  Registrar Pagamento
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 3: CANCELAR RESERVA */}
      <div className={`modal-overlay ${activeModal === 'cancelar-reserva' ? 'open' : ''}`}>
        {selectedReserva && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Cancelar Reserva</h2>
              <button className="modal-close" onClick={() => setActiveModal('detalhe-reserva')}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="text-xs text-muted mb-4">
                Você está cancelando a reserva de <strong>{selectedReserva.cliente_nome}</strong> de{' '}
                {selectedReserva.hora_inicio} às {selectedReserva.hora_fim}. Esta ação não pode ser desfeita.
              </p>
              <div className="form-group">
                <label htmlFor="motivo-cancelamento">Motivo do cancelamento *</label>
                <select
                  id="motivo-cancelamento"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  required
                >
                  <option value="">Selecione o motivo</option>
                  {motivosDisponiveis.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="obs-cancelamento">Observações</label>
                <textarea
                  id="obs-cancelamento"
                  rows={2}
                  placeholder="Detalhe adicional (opcional)"
                  maxLength={100}
                  value={obsCancelamento}
                  onChange={(e) => setObsCancelamento(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setActiveModal('detalhe-reserva')}>
                Voltar
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={handleConfirmarCancelamento}
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 4: REGISTRAR PAGAMENTO */}
      <div className={`modal-overlay ${activeModal === 'registrar-pagamento' ? 'open' : ''}`}>
        {selectedReserva && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Registrar Pagamento</h2>
              <button className="modal-close" onClick={() => setActiveModal('detalhe-reserva')}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div
                id="modal-pag-info"
                style={{
                  background: 'var(--cream-surface)',
                  border: '1px solid var(--border-passive)',
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--s-3) var(--s-4)',
                  marginBottom: 'var(--s-5)',
                  fontSize: '13px',
                  color: 'var(--charcoal-82)',
                }}
              >
                Reserva #{selectedReserva.id} &middot; {selectedReserva.cliente_nome} &middot; Saldo devedor:{' '}
                <strong style={{ color: 'var(--danger)' }}>
                  {formatCurrency(selectedReserva.valor_total - selectedReserva.valor_pago)}
                </strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
                <div className="form-group">
                  <label htmlFor="pag-valor">Valor a pagar *</label>
                  <input
                    type="text"
                    id="pag-valor"
                    placeholder="0,00"
                    value={pagValor}
                    onChange={(e) => setPagValor(formatCurrencyInput(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pag-desconto">Desconto (R$)</label>
                  <input
                    type="text"
                    id="pag-desconto"
                    placeholder="Opcional"
                    value={pagDesconto}
                    onChange={(e) => setPagDesconto(formatCurrencyInput(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pag-metodo">Método de pagamento *</label>
                <select id="pag-metodo" value={pagMetodo} onChange={(e) => setPagMetodo(e.target.value)} required>
                  <option value="">Selecione</option>
                  <option value="Pix">Pix (Manual)</option>
                  <option value="Pix Online (Gateway)">Pix Online (Gateway)</option>
                  <option value="Cartão (Maquineta Online)">Cartão (Maquineta Online)</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Voucher Interno">Voucher Interno</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pag-data">Data do pagamento *</label>
                <DatePicker
                  
                  id="pag-data"
                  value={pagData}
                  onValueChange={(value) => setPagData(value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setActiveModal('detalhe-reserva')}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleConfirmarPagamento}>
                Confirmar Pagamento
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: PIX GATEWAY */}
      <div className={`modal-overlay ${activeModal === 'pix-gateway' ? 'open' : ''}`}>
        {selectedReserva && (
          <div className="modal" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title">Pagamento via Pix</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedReserva(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  background: 'var(--cream-surface)',
                  border: '1px solid var(--border-passive)',
                  borderRadius: 'var(--r-md)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                Reserva #{selectedReserva.id} &middot; <strong>{selectedReserva.cliente_nome}</strong> <br />
                Valor da Cobrança:{' '}
                <strong style={{ color: 'var(--paid)' }}>
                  {pagValor ? `R$ ${pagValor}` : formatCurrency(selectedReserva.valor_total)}
                </strong>
              </div>

              {qrCode ? (
                <div
                  style={{
                    width: '180px',
                    height: '180px',
                    background: 'white',
                    border: '1px solid var(--border-passive)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <img
                    src={qrCode}
                    alt="QR Code Pix"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div style={{ padding: '24px', color: 'var(--muted)', fontSize: '13px' }}>
                  Gerando QR Code...
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
                Apresente o QR Code acima para o cliente escanear no app do banco dele.
              </p>

              {copiaCola && (
                <div style={{ width: '100%', textAlign: 'left', marginBottom: '16px' }}>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--charcoal)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Pix Copia e Cola
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={copiaCola}
                      style={{
                        flex: 1,
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        border: '1px solid var(--border-passive)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        background: 'white',
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(copiaCola);
                        showToast('Chave Pix copiada para a área de transferência!', 'success');
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                className="btn-ghost"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedReserva(null);
                }}
              >
                Fechar
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!selectedReserva) return;
                  try {
                    const valNum = parseCurrencyToFloat(pagValor) || selectedReserva.valor_total;
                    const res = await fetch('/api/pagamentos', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reserva_id: selectedReserva.id, valor: valNum, metodo: 'Pix' }),
                    });
                    if (res.ok) {
                      showToast('Pagamento confirmado manualmente com sucesso!', 'success');
                      setActiveModal(null);
                      setSelectedReserva(null);
                      fetchGrade();
                    }
                  } catch (err) {
                    showToast(errorMessage(err), 'error');
                  }
                }}
              >
                Confirmar no Caixa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 5: ESTORNAR PAGAMENTO */}
      <div className={`modal-overlay ${activeModal === 'estornar-pagamento' ? 'open' : ''}`}>
        {selectedReserva && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Estornar Pagamento</h2>
              <button className="modal-close" onClick={() => setActiveModal('detalhe-reserva')}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <RefundNotice {...refund} />
              {refundResult && <p role="status">{refundResult}</p>}
              <div className="form-group">
                <label htmlFor="est-valor">Valor a estornar *</label>
                <input
                  type="text"
                  id="est-valor"
                  placeholder="Ex: 80,00"
                  readOnly={Boolean(refund.quote?.online)}
                  value={refund.quote?.online ? formatFloatToCurrencyInput(refund.quote.valor_centavos / 100) : estValor}
                  onChange={(e) => setEstValor(formatCurrencyInput(e.target.value))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="est-motivo">Justificativa do Estorno *</label>
                <textarea
                  id="est-motivo"
                  rows={2}
                  placeholder="Obrigatório para auditoria"
                  maxLength={100}
                  value={estMotivo}
                  onChange={(e) => setEstMotivo(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setActiveModal('detalhe-reserva')}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                style={{ background: 'var(--danger)' }}
                disabled={refundBusy || refund.loading || Boolean(refund.error) || !refund.quote || (refund.quote.online && refund.quote.valor_centavos <= 0)}
                onClick={handleConfirmarEstorno}
              >
                {refundBusy ? 'Processando...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 6: BLOQUEAR QUADRA (Conforme mockup Pen.dev) */}
      {activeModal === 'bloquear-quadra' && (
        <div
          data-pencil-name="Overlay Bloqueio"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#071915]/60 backdrop-blur-[4px] animate-fadeIn overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-bloquear-quadra-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => setActiveModal(null)}
            aria-hidden="true"
          />
          <div
            data-pencil-name="Modal Bloquear Quadra"
            className="box-border w-full max-w-[500px] max-h-[92vh] overflow-y-auto custom-scrollbar shadow-[0px_30px_70px_#07191555] flex flex-col gap-[18px] p-[24px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] relative z-10 my-auto"
          >
            {/* Cabeçalho Bloquear Quadra */}
            <div
              data-pencil-name="Cabeçalho Bloquear Quadra"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Título Bloqueio Grupo"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[12px] justify-start items-center"
              >
                <div
                  data-pencil-name="Ícone Bloqueio Âmbar"
                  className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#FFF3DD] outline outline-1 outline-[#F1C36D] -outline-offset-1 rounded-[13px]"
                >
                  <Lock size={20} className="text-[#9A5B00]" />
                </div>
                <div
                  data-pencil-name="Textos Header Bloqueio"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <div
                    id="modal-bloquear-quadra-title"
                    data-pencil-name="Título Bloquear Quadra"
                    className="text-[22px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Bloquear Quadra
                  </div>
                  <div
                    data-pencil-name="Subtítulo Bloqueio"
                    className="text-[12px] leading-[15px] max-w-[340px] text-[#7A7269] font-[Inter,system-ui,sans-serif] font-normal text-left"
                  >
                    Impedir agendamentos para manutenção, torneios ou aulas
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-pencil-name="Fechar Bloqueio"
                onClick={() => setActiveModal(null)}
                className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] hover:bg-[#EAE4DC] transition-colors rounded-[12px] cursor-pointer border-none text-[#6F675F] hover:text-[#071915]"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmarBloqueio} className="w-full flex flex-col gap-[14px]">
              {/* Seleção Quadra Bloqueio */}
              <div
                data-pencil-name="Seleção Quadra Bloqueio"
                className="box-border w-full flex flex-col gap-[8px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
              >
                <div
                  data-pencil-name="Label Row Quadra Bloqueio"
                  className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
                >
                  <div
                    data-pencil-name="Label Quadra Bloqueio"
                    className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Quadra *
                  </div>
                  {bqQuadraId && quadras.find((q) => q.id === bqQuadraId)?.status === 'Ativa' && (
                    <div
                      data-pencil-name="Badge Quadra Ativa"
                      className="box-border w-fit shrink-0 h-[24px] flex flex-row gap-[6px] px-[10px] justify-start items-center bg-[#EAF9C7] rounded-[12px]"
                    >
                      <div
                        data-pencil-name="Ponto Ativa"
                        className="box-border w-[7px] shrink-0 h-[7px] bg-[#138A4B] rounded-full"
                      />
                      <div
                        data-pencil-name="Texto Ativa"
                        className="text-[11px] text-[#138A4B] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Ativa
                      </div>
                    </div>
                  )}
                </div>

                <div
                  data-pencil-name="Select Quadra Bloqueio"
                  className="box-border w-full h-[42px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                >
                  <MapPin size={16} className="text-[#6F675F] shrink-0 pointer-events-none" />
                  <select
                    id="bq-quadra"
                    value={bqQuadraId || ''}
                    onChange={(e) => setBqQuadraId(Number(e.target.value) || null)}
                    style={{ backgroundImage: 'none' }}
                    className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[13px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold cursor-pointer appearance-none [background-image:none] pr-6 truncate"
                    required
                  >
                    <option value="">Selecione a quadra</option>
                    {quadras
                      .filter((q) => q.status === 'Ativa')
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.nome} — {q.tipo}
                        </option>
                      ))}
                  </select>
                  <ChevronDown size={15} className="text-[#9C9389] absolute right-[12px] pointer-events-none" />
                </div>
              </div>

              {/* Data Intervalo Bloqueio */}
              <div
                data-pencil-name="Data Intervalo Bloqueio"
                className="box-border w-full flex flex-col gap-[8px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
              >
                <div
                  data-pencil-name="Linha Data Horário Bloqueio"
                  className="box-border w-full h-fit shrink-0 grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr] gap-[10px] justify-start items-start"
                >
                  {/* Grupo Data */}
                  <div
                    data-pencil-name="Grupo Data Bloqueio"
                    className="col-span-2 sm:col-span-1 box-border w-full h-fit flex flex-col gap-[6px] justify-start items-start"
                  >
                    <label
                      htmlFor="bq-data"
                      data-pencil-name="Label Data Bloqueio"
                      className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Data *
                    </label>
                    <div
                      data-pencil-name="Campo Data Bloqueio"
                      className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[8px] px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] cursor-pointer"
                      
                    >
                      <CalendarDays size={14} className="text-[#6F675F] shrink-0 pointer-events-none" />
                      <DatePicker
                        
                        id="bq-data"
                        value={bqData}
                        min={todayStr}
                        
                        onValueChange={(value) => {
                          const val = value;
                          if (val < todayStr) {
                            showToast('Não é possível selecionar datas passadas para bloqueio.', 'error');
                            setBqData(todayStr);
                            return;
                          }
                          setBqData(val);
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold cursor-pointer min-w-0 hide-native-picker"
                        required
                      />
                    </div>
                  </div>

                  {/* Grupo Início */}
                  <div
                    data-pencil-name="Grupo Inicio Bloqueio"
                    className="box-border w-full h-fit flex flex-col gap-[6px] justify-start items-start"
                  >
                    <label
                      htmlFor="bq-inicio"
                      data-pencil-name="Label Inicio Bloqueio"
                      className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Início *
                    </label>
                    <div
                      data-pencil-name="Campo Inicio Bloqueio"
                      className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[8px] px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                    >
                      <Clock size={14} className="text-[#6F675F] shrink-0 pointer-events-none" />
                      <select
                        id="bq-inicio"
                        disabled={bqLoading || !bqHorariosInicioComputed.length}
                        value={bqInicio}
                        onChange={(e) => { setBqInicio(e.target.value); setBqFim(''); }}
                        style={{ backgroundImage: 'none' }}
                        className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold cursor-pointer appearance-none pr-5"
                        required
                      >
                        <option value="">Início</option>
                        {bqHorariosInicioComputed.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="text-[#9C9389] absolute right-[10px] pointer-events-none" />
                    </div>
                  </div>

                  {/* Grupo Fim */}
                  <div
                    data-pencil-name="Grupo Fim Bloqueio"
                    className="box-border w-full h-fit flex flex-col gap-[6px] justify-start items-start"
                  >
                    <label
                      htmlFor="bq-fim"
                      data-pencil-name="Label Fim Bloqueio"
                      className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Fim *
                    </label>
                    <div
                      data-pencil-name="Campo Fim Bloqueio"
                      className="box-border w-full h-[40px] shrink-0 flex flex-row gap-[8px] px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px] relative"
                    >
                      <Clock size={14} className="text-[#6F675F] shrink-0 pointer-events-none" />
                      <select
                        id="bq-fim"
                        disabled={bqLoading || !bqHorariosFimComputed.length}
                        value={bqFim}
                        onChange={(e) => setBqFim(e.target.value)}
                        style={{ backgroundImage: 'none' }}
                        className="w-full bg-transparent border-none outline-none text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold cursor-pointer appearance-none pr-5"
                        required
                      >
                        <option value="">Fim</option>
                        {bqHorariosFimComputed.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="text-[#9C9389] absolute right-[10px] pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Availability feedback */}
                <div className="text-sm text-[#6F675F] w-full" role="status">
                  {bqLoading ? 'Consultando horários…' : bqError ? <><span>{bqError}</span><button type="button" className="ml-2 underline" onClick={() => setBqReload(v => v + 1)}>Tentar novamente</button></> : !bqQuadraId ? 'Selecione uma quadra.' : !bqHorariosInicioComputed.length ? 'Nenhum horário disponível nesta data.' : !bqInicio ? 'Selecione o início e o fim do bloqueio.' : bqFim ? ('Período selecionado: ' + bqInicio + ' às ' + bqFim) : 'Selecione o fim do bloqueio.'}
                </div>
              </div>

              {/* Motivo Bloqueio */}
              <div
                data-pencil-name="Motivo Bloqueio"
                className="box-border w-full flex flex-col gap-[10px] pt-[14px] justify-start items-start border-t border-[#E6DED2]"
              >
                <label
                  htmlFor="bq-motivo"
                  data-pencil-name="Label Motivo Bloqueio"
                  className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                >
                  Motivo do bloqueio *
                </label>
                <div
                  data-pencil-name="Input Motivo Bloqueio"
                  className="box-border w-full h-[42px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD4C8] -outline-offset-1 rounded-[10px]"
                >
                  <NotebookPen size={16} className="text-[#9C9389] shrink-0" />
                  <input
                    type="text"
                    id="bq-motivo"
                    maxLength={500}
                    placeholder="Ex: Torneio Interno, Manutenção da Rede, Aulão..."
                    value={bqMotivo}
                    onChange={(e) => setBqMotivo(e.target.value)}
                    className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[12px] text-[#071915] placeholder-[#9C9389] font-[Inter,system-ui,sans-serif]"
                    required
                  />
                </div>
                {/* Chips Motivo Bloqueio */}
                <div
                  data-pencil-name="Chips Motivo Bloqueio"
                  className="box-border w-full h-fit shrink-0 flex flex-wrap gap-[7px] justify-start items-start"
                >
                  {[
                    { name: 'Manutenção', display: '🛠️ Manutenção' },
                    { name: 'Torneio', display: '🏆 Torneio' },
                    { name: 'Chuva', display: '🌧️ Chuva' },
                    { name: 'Evento', display: '🎾 Evento' },
                    { name: 'Aula', display: '🎓 Aula' },
                  ].map((chip) => {
                    const isSelected = bqMotivo.toLowerCase().includes(chip.name.toLowerCase());
                    return (
                      <button
                        key={chip.name}
                        type="button"
                        data-pencil-name={`Chip ${chip.display}`}
                        onClick={() => setBqMotivo(chip.name)}
                        className={`box-border w-fit shrink-0 h-[30px] flex flex-row px-[10px] justify-start items-center rounded-[15px] cursor-pointer text-[11px] font-[Inter,system-ui,sans-serif] transition-all border-none ${
                          isSelected
                            ? 'bg-[#FFF3DD] outline outline-1 outline-[#F1C36D] -outline-offset-1 text-[#4F463D] font-bold shadow-xs'
                            : 'bg-[#F1EDE6] hover:bg-[#EAE4DC] outline outline-1 outline-[#E2D9CC] -outline-offset-1 text-[#4F463D] font-normal'
                        }`}
                      >
                        {chip.display}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aviso Impacto Bloqueio */}
              <div
                data-pencil-name="Aviso Impacto Bloqueio"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[10px] p-[14px] justify-start items-start bg-[#FFF7E9] outline outline-1 outline-[#F1C36D] -outline-offset-1 rounded-[14px]"
              >
                <Info size={17} className="text-[#9A5B00] shrink-0 mt-0.5" />
                <div
                  data-pencil-name="Texto Aviso Bloqueio"
                  className="text-[12px] leading-[16px] flex-1 text-[#6F4E18] font-[Inter,system-ui,sans-serif] font-normal text-left"
                >
                  Os horários bloqueados serão imediatamente ocultados do aplicativo do atleta e não
                  poderão receber reservas online.
                </div>
              </div>

              {/* Rodapé Bloqueio */}
              <div
                data-pencil-name="Rodapé Bloqueio"
                className="box-border w-full h-auto flex flex-wrap gap-[12px] justify-end items-center pt-2"
              >
                <button
                  type="button"
                  data-pencil-name="Botão Cancelar Bloqueio"
                  onClick={() => setActiveModal(null)}
                  className="box-border w-fit shrink-0 h-[42px] px-[18px] flex items-center justify-center bg-transparent hover:bg-[#F1EDE6] rounded-[10px] text-[14px] text-[#6F675F] hover:text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold cursor-pointer border-none transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-pencil-name="Botão Confirmar Bloqueio"
                  disabled={!bqCanSubmit}
                  className={`box-border w-fit shrink-0 h-[44px] shadow-[0px_12px_24px_#3A2A1633] flex flex-row gap-[8px] px-[20px] justify-start items-center bg-[#3A2A16] hover:bg-[#4E391F] rounded-[12px] cursor-pointer border-none transition-all active:scale-95 ${
                    !bqCanSubmit ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Lock size={16} className="text-[#F6C453]" />
                  <span
                    data-pencil-name="Texto Confirmar Bloqueio"
                    className="text-[14px] text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap"
                  >
                    {bqSaving ? 'Salvando…' : 'Confirmar bloqueio'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: GERENCIAR BLOQUEIO (Conforme mockup Pen.dev) */}
      {activeModal === 'gerenciar-bloqueio' && selectedBloqueio && (
        <div
          data-pencil-name="Overlay Bloqueio"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#071915]/60 backdrop-blur-[4px] animate-fadeIn overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-gerenciar-bloqueio-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => setActiveModal(null)}
            aria-hidden="true"
          />
          <div
            data-pencil-name="Modal Gerenciar Bloqueio"
            className="box-border w-full max-w-[500px] max-h-[92vh] overflow-y-auto shadow-[0px_30px_70px_#07191555] flex flex-col gap-[18px] p-[24px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] relative z-10 my-auto"
          >
            {/* Cabeçalho Gerenciar Bloqueio */}
            <div
              data-pencil-name="Cabeçalho Gerenciar Bloqueio"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
            >
              <div
                data-pencil-name="Texto Gerenciar Header"
                className="box-border min-w-0 flex-1 h-fit flex flex-col gap-[8px] justify-start items-start"
              >
                <div
                  id="modal-gerenciar-bloqueio-title"
                  data-pencil-name="Título Gerenciar Bloqueio"
                  className="text-[22px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-normal break-words"
                >
                  Gerenciar Bloqueio
                </div>
                <div
                  data-pencil-name="Badge Bloqueado Motivo"
                  className="box-border max-w-full min-h-[28px] py-1 shrink-0 flex flex-row gap-[7px] px-[10px] justify-start items-center bg-[#FFF3DD] outline outline-1 outline-[#F1C36D] -outline-offset-1 rounded-[14px]"
                >
                  <Lock size={13} className="text-[#9A5B00] shrink-0" />
                  <div
                    data-pencil-name="Texto Badge Bloqueado"
                    className="text-[12px] text-[#6F4E18] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-normal break-words"
                  >
                    Bloqueado: {selectedBloqueio.motivo || 'Manutenção das redes'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-pencil-name="Fechar Gerenciar Bloqueio"
                onClick={() => setActiveModal(null)}
                className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] hover:bg-[#EAE4DC] transition-colors rounded-[12px] cursor-pointer border-none text-[#6F675F] hover:text-[#071915]"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumo Bloqueio Ativo */}
            <div
              data-pencil-name="Resumo Bloqueio Ativo"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#F5F1EA] outline outline-1 outline-[#E0D6CA] -outline-offset-1 rounded-[14px]"
            >
              <div
                data-pencil-name="Ícone Resumo Bloqueio"
                className="box-border w-[40px] shrink-0 h-[40px] flex flex-row gap-0 justify-center items-center bg-[#071915] rounded-[12px]"
              >
                <CalendarClock size={19} className="text-[#C9FF3B]" />
              </div>
              <div
                data-pencil-name="Texto Resumo Bloqueio"
                className="box-border flex-1 h-fit flex flex-col gap-[4px] justify-start items-start"
              >
                <div
                  data-pencil-name="Quadra Resumo Bloqueio"
                  className="text-[14px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-normal break-words"
                >
                  {quadras.find((q) => q.id === selectedBloqueio.quadra_id)?.nome || 'Quadra'} • {formatarDataBR(selectedBloqueio.data_bloqueio)}
                </div>
                <div
                  data-pencil-name="Hora Resumo Bloqueio"
                  className="text-[13px] leading-tight text-[#6F675F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-normal break-words"
                >
                  {selectedBloqueio.hora_inicio} às {selectedBloqueio.hora_fim}
                </div>
              </div>
            </div>

            {/* Ações Gerenciar Bloqueio */}
            <div
              data-pencil-name="Ações Gerenciar Bloqueio"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] justify-start items-start pt-1"
            >
              <button
                type="button"
                data-pencil-name="Liberar Apenas Este Horário"
                disabled={blockBusy}
                onClick={() => handleDesbloquear(false)}
                className="box-border w-full min-h-[50px] py-3 shrink-0 flex flex-row gap-[10px] px-[16px] justify-start items-center bg-[#FFFFFF] hover:bg-[#F9F7F3] outline outline-1 outline-[#D8CFC3] -outline-offset-1 rounded-[12px] cursor-pointer border-none transition-all active:scale-[0.99]"
              >
                <Unlock size={17} className="text-[#071915] shrink-0" />
                <span
                  data-pencil-name="Texto Liberar Horário"
                  className="text-[14px] text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-normal break-words"
                >
                  Liberar das {releaseStart} às {releaseEnd}
                </span>
              </button>

              <button
                type="button"
                data-pencil-name="Desbloquear Todo Período"
                disabled={blockBusy}
                onClick={() => handleDesbloquear(true)}
                className="box-border w-full min-h-[50px] py-3 shrink-0 flex flex-row gap-[10px] px-[16px] justify-start items-center bg-[#FFF1F0] hover:bg-[#FFEAE7] outline outline-1 outline-[#E29A91] -outline-offset-1 rounded-[12px] cursor-pointer border-none transition-all active:scale-[0.99]"
              >
                <Trash2 size={17} className="text-[#B32323] shrink-0" />
                <span
                  data-pencil-name="Texto Desbloquear Período"
                  className="text-[14px] text-[#B32323] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-normal break-words"
                >
                  Desbloquear todo o período ({selectedBloqueio.hora_inicio} às {selectedBloqueio.hora_fim})
                </span>
              </button>

              <button
                type="button"
                data-pencil-name="Voltar Fechar Gerenciar"
                onClick={() => setActiveModal(null)}
                className="box-border w-full h-[48px] shrink-0 flex flex-row gap-0 justify-center items-center bg-[#071915] hover:bg-[#1E2522] rounded-[12px] cursor-pointer border-none transition-all active:scale-[0.99]"
              >
                <span
                  data-pencil-name="Texto Voltar Fechar"
                  className="text-[14px] text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-normal break-words"
                >
                  Voltar / Fechar
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
