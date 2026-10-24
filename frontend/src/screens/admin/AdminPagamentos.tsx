import { ToastLayer } from "../../components/ToastLayer";
import { DatePicker } from '../../components/ui/date-picker';
import { useArenaPortal } from '../../hooks/useArenaPortal';
import { useRefundQuote } from '../../hooks/useRefundQuote';
import { usePixRecovery } from '../../hooks/usePixRecovery';
import { RefundNotice } from '../../components/RefundNotice';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useCallback, useState, useEffect } from 'react';
import { errorMessage } from '../../utils/errorMessage';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { getStoredUser } from '../../utils/session';
import type { Announcement } from '../../types/api';
import '../../assets/css/pagamentos.css';
import { useOutletContext } from 'react-router-dom';
import {
  Download,
  Plus,
  Search,
  ArrowDownToLine,
  Clock3,
  CalendarCheck,
  AlertTriangle,
  Globe,
  Bell,
  X,
  Copy,
  ExternalLink,
  Share2,
  Check,
  Menu,
} from 'lucide-react';

interface Pagamento {
  id: number;
  reserva_id: number;
  valor: number;
  metodo: string;
  registrado_em: string;
  motivo_estorno?: string;
  status?: string;
}

interface ReservaPagamento {
  id: number;
  cliente_nome: string;
  quadra_nome: string;
  data_reserva: string;
  hora_inicio: string;
  hora_fim: string;
  valor_total: number;
  total_pago: number;
  saldo_devedor: number;
  metodos: string;
  status_pagamento: string;
}

interface KPIResumo {
  recebidoHoje: number;
  qtdPagamentosHoje: number;
  pendenteHoje: number;
  qtdPendenteHoje: number;
  recebidoMes: number;
  totalInadimplencia: number;
  qtdInadimplentes: number;
  dataFiltro?: string | null;
  resumoFiltrado?: {
    data: string;
    recebido: number;
    qtdPagamentos: number;
    pendente: number;
    qtdPendente: number;
    faturamentoTotal: number;
    totalReservas: number;
    qtdInadimplentes: number;
  } | null;
  counts?: {
    pendentes: number;
    pagos: number;
    inadimplentes: number;
    todos: number;
  };
  countsGlobais: {
    pendentes: number;
    pagos: number;
    inadimplentes: number;
    todos: number;
  };
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

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPaymentDate = (timestamp: string) => {
  const utc = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp) ? timestamp : timestamp.replace(' ', 'T') + 'Z';
  return new Date(utc).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatData = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function AdminPagamentos() {
  const pixRecovery = usePixRecovery();
  const outletContext = useOutletContext<{ onToggleSidebar?: () => void }>() || {};
  const onToggleSidebar = outletContext.onToggleSidebar;

  const { arenaName, clientPortalUrl } = useArenaPortal();
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
    const messageText = `${ball} Agende sua quadra na ${arenaName} de forma rápida e online. Escolha o melhor horário e reserve agora:

${hand} ${clientPortalUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  useEffect(() => {
    fetch('/api/auth/comunicados/ativos', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, []);

  // KPIs
  const [kpis, setKpis] = useState<KPIResumo | null>(null);

  // Filtros e listagem
  const [reservas, setReservas] = useState<ReservaPagamento[]>([]);
  const [tabAtiva, setTabAtiva] = useState<'Pendente' | 'Pago' | 'inadimplentes' | 'todos'>('Pendente');
  const [busca, setBusca] = useState('');
  const [dataFiltro, setDataFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  // Modais
  const [activeModal, setActiveModal] = useState<'registrar-pagamento' | 'estornar-pagamento' | null>(null);

  // Registro de pagamento
  const [reservaAtual, setReservaAtual] = useState<ReservaPagamento | null>(null);
  const [pagamentosReserva, setPagamentosReserva] = useState<Pagamento[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [rpValor, setRpValor] = useState('');
  const [rpMetodo, setRpMetodo] = useState('');

  // Estorno
  const [pagamentoEstornoId, setPagamentoEstornoId] = useState<number | null>(null);
  const [estpValor, setEstpValor] = useState('');
  const [estpMotivo, setEstpMotivo] = useState('');
  const refund = useRefundQuote(activeModal === 'estornar-pagamento' ? reservaAtual?.id ?? null : null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundResult, setRefundResult] = useState('');

  // Toast / Status messages
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Gateway de Pagamentos em Lote Admin
  const [gatewayRef, setGatewayRef] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [copiaCola, setCopiaCola] = useState('');
  const [loadingGateway, setLoadingGateway] = useState(false);
  const [showPixCobranca, setShowPixCobranca] = useState(false);
  const [pixManual, setPixManual] = useState(false);
  const [posDeviceId, setPosDeviceId] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Carregar KPIs
  const carregarKPIs = useCallback(async (overrideData?: string) => {
    const dt = overrideData !== undefined ? overrideData : dataFiltro;
    try {
      const url = dt ? `/api/pagamentos/resumo?data=${encodeURIComponent(dt)}` : '/api/pagamentos/resumo';
      const res = await fetch(url, {
        headers: {}
      });
      if (res.ok) {
        const data = await res.json();
        setKpis({
          ...data,
          recebidoHoje: data.recebidoHoje / 100,
          pendenteHoje: data.pendenteHoje / 100,
          recebidoMes: data.recebidoMes / 100,
          totalInadimplencia: data.totalInadimplencia / 100,
          resumoFiltrado: data.resumoFiltrado ? {
            ...data.resumoFiltrado,
            recebido: data.resumoFiltrado.recebido / 100,
            pendente: data.resumoFiltrado.pendente / 100,
            faturamentoTotal: data.resumoFiltrado.faturamentoTotal / 100,
          } : null,
        });
      }
    } catch (err) {
      console.warn('Erro ao carregar KPIs de pagamento:', err);
    }
  }, [dataFiltro] );

  // Carregar reservas de faturamento
  const carregarReservas = useEventCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tabAtiva !== 'todos') {
        params.append('status', tabAtiva);
      }
      if (busca) {
        params.append('busca', busca);
      }
      if (dataFiltro) {
        params.append('data', dataFiltro);
      }

      const res = await fetch(`/api/pagamentos/reservas?${params.toString()}`, {
        headers: {}
      });
      if (res.ok) {
        const data = await res.json();
        setReservas(data.map((row: ReservaPagamento) => ({
          ...row,
          valor_total: row.valor_total / 100,
          total_pago: row.total_pago / 100,
          saldo_devedor: row.saldo_devedor / 100,
        })));
      } else {
        setReservas([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar faturamentos.', 'error');
    } finally {
      setLoading(false);
    }
  } );

  useEffect(() => {
    carregarKPIs(dataFiltro);
  }, [tabAtiva, dataFiltro, carregarKPIs]);

  useEffect(() => {
    carregarReservas();
  }, [tabAtiva, dataFiltro, carregarReservas]);

  // Debounce para busca textual
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarReservas();
    }, 350);
    return () => clearTimeout(timer);
  }, [busca, carregarReservas]);

  // Buscar histórico de pagamentos individuais ao abrir modal de pagamento ou estorno
  const carregarHistoricoPagamentos = async (reservaId: number) => {
    setLoadingHistorico(true);
    try {
      const res = await fetch(`/api/pagamentos/reserva/${reservaId}`, {
        headers: {}
      });
      if (res.ok) {
        const rows: Pagamento[] = await res.json();
        const data = rows.map(payment => ({ ...payment, valor: payment.valor / 100 }));
        setPagamentosReserva(data);
        
        // O valor devolvível considera todos os pagamentos e estornos já registrados.
        const positivos = data.filter((p: Pagamento) => p.valor > 0);
        if (positivos.length > 0) {
          setPagamentoEstornoId(positivos[positivos.length - 1].id);
          setEstpValor(formatFloatToCurrencyInput(Math.max(0, data.reduce((total, payment) => total + payment.valor, 0))));
        } else {
          setPagamentoEstornoId(null);
          setEstpValor('');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Polling para o Pix Online no painel Admin
  useEffect(() => {
    if (!showPixCobranca || !reservaAtual || !gatewayRef || pixManual) return;
    let cancelled = false;
    let checking = false;

    const checkStatus = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        const res = await fetch(`/api/pagamentos/gateway/status/${reservaAtual.id}?gateway_ref=${encodeURIComponent(gatewayRef)}`, {
          headers: {}
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.transacao_status === 'Pago') {
            cancelled = true;
            showToast(data.status_pagamento === 'Pago' ? 'Pagamento confirmado (Quitado) no caixa!' : 'Pagamento parcial registrado no caixa!', 'success');
            
            // Limpa estados e fecha modal
            setShowPixCobranca(false);
            setGatewayRef('');
            setQrCode('');
            setCopiaCola('');
            setActiveModal(null);
            setReservaAtual(null);
            
            // Recarrega dados
            carregarKPIs();
            carregarReservas();
          }
        }
      } catch (err) {
        console.warn(err);
      } finally {
        checking = false;
      }
    };

    void checkStatus();
    const intervalId = setInterval(checkStatus, 3000);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [showPixCobranca, reservaAtual, gatewayRef, pixManual, carregarKPIs, carregarReservas]);

  const handleSimularPagamentoPix = async () => {
    if (!gatewayRef) return;
    try {
      const payload: { gateway_ref: string; device_id?: string; valor_pago?: number } = { gateway_ref: gatewayRef };
      if (rpMetodo === 'Cartão (Maquineta Online)') {
        payload.device_id = posDeviceId;
        payload.valor_pago = parseCurrencyToFloat(rpValor);
      }

      const res = await fetch('/api/pagamentos/gateway/simular-pagamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao simular.');
      
      showToast('Pagamento simulação concluída!', 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const fecharModalPagamento = () => {
    setActiveModal(null);
    setReservaAtual(null);
    setShowPixCobranca(false);
    setPixManual(false);
    setGatewayRef('');
    setQrCode('');
    setCopiaCola('');
    setPosDeviceId('');
  };

  // Abrir Modal de Pagamento
  const abrirPagamento = (reserva: ReservaPagamento) => {
    setReservaAtual(reserva);
    setRpValor(formatFloatToCurrencyInput(reserva.saldo_devedor));
    setRpMetodo('');
    setPagamentosReserva([]);
    setActiveModal('registrar-pagamento');
    carregarHistoricoPagamentos(reserva.id);
  };

  // Abrir Modal de Estorno
  const abrirEstorno = (reserva: ReservaPagamento) => {
    setReservaAtual(reserva);
    setEstpMotivo('');
    setPagamentosReserva([]);
    setPagamentoEstornoId(null);
    setRefundResult('');
    setActiveModal('estornar-pagamento');
    carregarHistoricoPagamentos(reserva.id);
  };

  // Salvar Pagamento
  const handleSalvarPagamento = async () => {
    if (!reservaAtual || !rpValor || !rpMetodo) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const valorNumerico = parseCurrencyToFloat(rpValor);

    if (rpMetodo === 'Pix Online (Gateway)' || rpMetodo === 'Cartão (Maquineta Online)') {
      setLoadingGateway(true);
      setGatewayRef('');
      setPixManual(false);
      setShowPixCobranca(true);
      try {
        const metodo = rpMetodo === 'Pix Online (Gateway)' ? 'Pix' : 'Maquineta';
        const res = await fetch('/api/pagamentos/gateway/cobranca', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',},
          body: JSON.stringify({
            reserva_id: reservaAtual.id,
            metodo,
            valor: valorNumerico
          })
        });
        const data = await res.json();
        if (!res.ok) {
          if (metodo === 'Pix') pixRecovery.show(data, `/api/pagamentos/gateway/pix/${reservaAtual.id}`);
          throw new Error(data.error || `Erro ao gerar cobrança ${metodo}.`);
        }

        setGatewayRef(data.gateway_ref);
        setPixManual(Boolean(data.manual_confirmation || data.is_estatico));
        if (metodo === 'Pix') {
          setQrCode(data.qr_code);
          setCopiaCola(data.copia_cola);
        } else {
          setPosDeviceId(data.device_id);
        }
      } catch (err) {
        showToast(errorMessage(err), 'error');
        setShowPixCobranca(false);
      } finally {
        setLoadingGateway(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',},
        body: JSON.stringify({
          reserva_id: reservaAtual.id,
          valor: valorNumerico,
          metodo: rpMetodo
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao registrar pagamento');

      showToast('Pagamento registrado com sucesso!', 'success');
      setActiveModal(null);
      setReservaAtual(null);
      carregarKPIs();
      carregarReservas();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const confirmarPixManual = async () => {
    if (!pixManual || !reservaAtual || loadingGateway) return;
    setLoadingGateway(true);
    try {
      const response = await fetch('/api/pagamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserva_id: reservaAtual.id, valor: parseCurrencyToFloat(rpValor), metodo: 'Pix' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao registrar recebimento Pix.');
      fecharModalPagamento();
      showToast('Recebimento Pix registrado após conferência.', 'success');
      void carregarKPIs();
      void carregarReservas();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setLoadingGateway(false);
    }
  };

  // Confirmar Estorno
  const handleConfirmarEstorno = async () => {
    if (refundBusy || refund.loading || refund.error || !refund.quote) return;
    if ((!refund.quote.online && (!pagamentoEstornoId || !estpValor)) || !estpMotivo.trim()) {
      showToast('A justificativa e o valor são obrigatórios.', 'error');
      return;
    }

    setRefundResult('');
    setRefundBusy(true);
    try {
      const res = await fetch('/api/pagamentos/estorno', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',},
        body: JSON.stringify({
          pagamento_id: refund.quote.online ? undefined : pagamentoEstornoId,
          reserva_id: reservaAtual?.id,
          valor: refund.quote.online ? refund.quote.valor_centavos / 100 : parseCurrencyToFloat(estpValor),
          confirmacao: refund.quote.confirmacao,
          motivo: estpMotivo.trim()
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro ao estornar pagamento');

      if (d.pending) {
        setRefundResult(d.message);
        return;
      }
      showToast(d.message || 'Estorno registrado.', d.pending ? 'error' : 'success');
      setActiveModal(null);
      setReservaAtual(null);
      setPagamentoEstornoId(null);
      setEstpValor('');
      carregarKPIs();
      carregarReservas();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setRefundBusy(false);
    }
  };

  const definirData = (tipo: 'hoje' | 'ontem' | 'amanha' | 'limpar') => {
    if (tipo === 'limpar') {
      setDataFiltro('');
      return;
    }
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const base = new Date(Date.now() - tzOffset);
    if (tipo === 'ontem') {
      base.setDate(base.getDate() - 1);
    } else if (tipo === 'amanha') {
      base.setDate(base.getDate() + 1);
    }
    const str = base.toISOString().split('T')[0];
    setDataFiltro(str);
  };

  // Limpar Filtros
  const limparFiltros = () => {
    setBusca('');
    setDataFiltro('');
  };

  // Exportar para CSV
  const exportarCSV = () => {
    if (!reservas.length) {
      showToast('Nenhum dado para exportar.', 'error');
      return;
    }
    const headers = ['ID', 'Cliente', 'Quadra', 'Data', 'Horário', 'Valor Total', 'Pago', 'Saldo', 'Método', 'Status'];
    const rows = [headers];
    
    reservas.forEach(r => {
      rows.push([
        r.id.toString(),
        r.cliente_nome,
        r.quadra_nome,
        r.data_reserva,
        `${r.hora_inicio}-${r.hora_fim}`,
        r.valor_total.toFixed(2).replace('.', ','),
        r.total_pago.toFixed(2).replace('.', ','),
        r.saldo_devedor.toFixed(2).replace('.', ','),
        r.metodos || '',
        r.status_pagamento
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pagamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Totais da listagem atual
  const totalValor = reservas.reduce((acc, r) => acc + (r.valor_total || 0), 0);
  const totalPago = reservas.reduce((acc, r) => acc + (r.total_pago || 0), 0);
  const totalSaldo = reservas.reduce((acc, r) => acc + (r.saldo_devedor || 0), 0);

  // Contagens sincronizadas com o filtro ativo
  const countPendentes = kpis?.counts?.pendentes ?? kpis?.countsGlobais?.pendentes ?? 0;
  const countPagos = kpis?.counts?.pagos ?? kpis?.countsGlobais?.pagos ?? 0;
  const countInadimplentes = kpis?.counts?.inadimplentes ?? kpis?.countsGlobais?.inadimplentes ?? 0;
  const countTodos = kpis?.counts?.todos ?? kpis?.countsGlobais?.todos ?? 0;
  return (
    <div className="admin-pagamentos-page w-full flex flex-col min-w-0">
      {pixRecovery.notice}
      {/* Toast Alert */}
      {toast && (
        <ToastLayer><div
          style={{ zIndex: 999999 }}
          className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slideUp border ${
            toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500'
              : 'bg-rose-600 border-rose-500'
          }`}
        >
          <span>{toast.message}</span>
        </div></ToastLayer>
      )}

      {/* Área Principal Pagamentos (Fiel ao mockup do Penpot) */}
      <div
        data-pencil-name="Área Principal Pagamentos"
        className="box-border w-full flex flex-col gap-[18px] justify-start items-start"
      >
        {/* Cabeçalho Pagamentos Melhorado */}
        <div
          data-pencil-name="Cabeçalho Pagamentos Melhorado"
          className="box-border w-full min-h-[70px] shrink-0 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center select-none"
        >
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-xl text-[#071915] hover:bg-[#F1EDE6] transition-colors cursor-pointer border-none"
                aria-label="Abrir menu"
              >
                <Menu size={20} />
              </button>
            )}
            <div
              data-pencil-name="Título Pagamentos Melhorado"
              className="box-border w-fit shrink-0 h-fit flex flex-col gap-[6px] justify-start items-start"
            >
              <div
                data-pencil-name="Breadcrumb Pagamentos Melhorado"
                className="text-[13px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Financeiro / Controle de pagamentos
              </div>
              <div
                data-pencil-name="Título Pagamentos Melhorado Texto"
                className="text-[34px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal tracking-[-1px] text-left whitespace-nowrap leading-tight"
              >
                Pagamentos
              </div>
            </div>
          </div>

          <div
            data-pencil-name="Ações Pagamentos Melhorado"
            className="box-border w-fit shrink-0 h-fit flex flex-wrap gap-[12px] justify-start items-center"
          >
            {/* Exportar CSV */}
            <button
              type="button"
              onClick={exportarCSV}
              data-pencil-name="Exportar CSV Melhorado"
              className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DDD6CA] -outline-offset-1 rounded-[12px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
            >
              <Download size={16} className="text-[#071915] shrink-0" />
              <div
                data-pencil-name="Texto Exportar Melhorado"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Exportar CSV
              </div>
            </button>

            {/* Registrar pagamento */}
            <button
              type="button"
              onClick={() => {
                const pendente = reservas.find((r) => r.status_pagamento !== 'Pago');
                if (pendente) {
                  abrirPagamento(pendente);
                } else if (reservas.length > 0) {
                  showToast('Todas as reservas da listagem já estão quitadas.', 'error');
                } else {
                  showToast('Nenhuma reserva encontrada.', 'error');
                }
              }}
              data-pencil-name="Registrar Pagamento Melhorado"
              className="box-border w-fit shrink-0 h-[42px] shadow-[0px_10px_20px_#07191533] flex flex-row gap-[8px] px-[18px] justify-start items-center bg-[#071915] hover:bg-[#1E2522] rounded-[12px] cursor-pointer transition-colors border-none active:scale-[0.99]"
            >
              <Plus size={16} className="text-[#C9FF3B] shrink-0" />
              <div
                data-pencil-name="Texto Registrar Melhorado"
                className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Registrar pagamento
              </div>
            </button>

            {/* Acesso usuário Pagamentos */}
            <div
              data-pencil-name="Acesso usuário Pagamentos"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
            >
              {/* Portal do Cliente Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPortalMenu(!showPortalMenu)}
                  data-pencil-name="Portal do Cliente Pagamentos"
                  className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[12px] justify-start items-center bg-[#ECFFF4] hover:bg-[#DCFCE7] rounded-[17px] cursor-pointer transition-colors border-none"
                >
                  <Globe size={14} className="text-[#008A5A] shrink-0" />
                  <div
                    data-pencil-name="Texto Portal Pagamentos"
                    className="text-[12px]/[normal] box-border text-[#007A50] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Portal do Cliente
                  </div>
                </button>

                {showPortalMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowPortalMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-[16px] shadow-xl p-4 z-50 animate-scale-in">
                      <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
                        <span className="text-xs font-bold text-[#071915] flex items-center gap-1.5">
                          <Globe size={14} className="text-[#008A5A]" />
                          Link da Sua Arena
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPortalMenu(false)}
                          className="text-[#6F766F] hover:text-[#071915] p-1 rounded-md border-none bg-transparent cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <p className="text-[11px] text-[#6F766F] mb-3 leading-relaxed">
                        Compartilhe o link direto para que seus clientes possam visualizar a grade e solicitar agendamentos online:
                      </p>

                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl outline outline-1 outline-[#DDD6CA] mb-3">
                        <input
                          type="text"
                          readOnly
                          value={clientPortalUrl}
                          className="text-xs text-[#071915] font-medium bg-transparent border-none outline-none w-full truncate select-all cursor-text"
                        />
                        <button
                          type="button"
                          onClick={handleCopy}
                          className={`p-1.5 rounded-lg border-none cursor-pointer flex items-center gap-1 transition-all ${
                            copied
                              ? 'bg-[#EAF9F0] text-[#138A4B]'
                              : 'bg-[#F7F2EA] text-[#071915] hover:bg-[#E6DED2]'
                          }`}
                          title="Copiar link"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleOpen}
                          className="flex-1 py-2 px-3 bg-white outline outline-1 outline-[#DDD6CA] rounded-xl text-xs font-semibold text-[#071915] hover:bg-[#F9F7F3] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
                        >
                          <ExternalLink size={13} />
                          Abrir Portal
                        </button>
                        <button
                          type="button"
                          onClick={handleWhatsApp}
                          className="flex-1 py-2 px-3 bg-[#071915] text-white rounded-xl text-xs font-semibold hover:bg-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
                        >
                          <Share2 size={13} className="text-[#C9FF3B]" />
                          Enviar WhatsApp
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Usuário logado */}
              <div
                data-pencil-name="Usuário logado Pagamentos"
                className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[11px] justify-start items-center bg-[#F1EDE6] rounded-[17px]"
              >
                <div
                  data-pencil-name="Status online Pagamentos"
                  className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full"
                />
                <div
                  data-pencil-name="Nome usuário Pagamentos"
                  className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {userName}
                </div>
              </div>

              {/* Notificações */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  data-pencil-name="Notificações Pagamentos"
                  className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] relative flex items-center justify-center cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
                  title="Notificações"
                >
                  <Bell size={16} className="text-[#071915]" />
                  {notifications.length > 0 && (
                    <div
                      data-pencil-name="Bolinha notificação Pagamentos"
                      className="box-border w-[7px] h-[7px] absolute right-[6px] top-[6px] bg-[#D11F2A] outline outline-1.5 outline-[#FFFFFF] -outline-offset-0.75 rounded-full"
                    />
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-[16px] shadow-xl p-4 z-50 animate-scale-in">
                      <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
                        <span className="text-xs font-bold text-[#071915] flex items-center gap-1.5">
                          <Bell size={14} className="text-[#071915]" />
                          Avisos e Comunicados
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="text-[#6F766F] hover:text-[#071915] p-1 rounded-md border-none bg-transparent cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {notifications.length === 0 ? (
                        <p className="text-xs text-[#6F766F] py-2 text-center">
                          Nenhum comunicado ativo no momento.
                        </p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              className="bg-white p-3 rounded-xl outline outline-1 outline-[#DDD6CA] text-xs"
                            >
                              <div className="font-semibold text-[#071915] leading-relaxed">{n.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Financeiro Melhorado */}
        <div
          data-pencil-name="Resumo Financeiro Melhorado"
          className="box-border w-full h-auto min-h-[128px] shrink-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[16px] justify-start items-start"
        >
          {/* Card 1: Recebido hoje */}
          <div
            data-pencil-name="Resumo Recebido hoje"
            className="box-border w-full h-full min-h-[128px] shadow-[0px_14px_28px_#0719150D] flex flex-col gap-[10px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px]"
          >
            <div
              data-pencil-name="Topo Recebido hoje"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Label Recebido hoje"
                className="text-[11px]/[normal] box-border text-[#59615A] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] text-left whitespace-nowrap"
              >
                {dataFiltro ? `RECEBIDO (${formatData(dataFiltro)})` : 'RECEBIDO HOJE'}
              </div>
              <div
                data-pencil-name="Ícone Recebido hoje"
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#EAF9F0] rounded-[12px]"
              >
                <ArrowDownToLine size={17} className="text-[#138A4B]" />
              </div>
            </div>
            <div
              data-pencil-name="Valor Recebido hoje"
              className="text-[30px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal tracking-[-0.5px] text-left whitespace-nowrap"
            >
              {formatCurrency(dataFiltro && kpis?.resumoFiltrado ? kpis.resumoFiltrado.recebido : (kpis?.recebidoHoje || 0))}
            </div>
            <div
              data-pencil-name="Rodapé Recebido hoje"
              className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center"
            >
              <div
                data-pencil-name="Ponto Recebido hoje"
                className="box-border w-[7px] shrink-0 h-[7px] bg-[#138A4B] rounded-full"
              />
              <div
                data-pencil-name="Nota Recebido hoje"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {dataFiltro && kpis?.resumoFiltrado ? kpis.resumoFiltrado.qtdPagamentos : (kpis?.qtdPagamentosHoje || 0)} pagamento(s)
              </div>
            </div>
          </div>

          {/* Card 2: Pendente hoje */}
          <div
            data-pencil-name="Resumo Pendente hoje"
            className="box-border w-full h-full min-h-[128px] shadow-[0px_14px_28px_#0719150D] flex flex-col gap-[10px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px]"
          >
            <div
              data-pencil-name="Topo Pendente hoje"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Label Pendente hoje"
                className="text-[11px]/[normal] box-border text-[#59615A] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] text-left whitespace-nowrap"
              >
                {dataFiltro ? `PENDENTE (${formatData(dataFiltro)})` : 'PENDENTE HOJE'}
              </div>
              <div
                data-pencil-name="Ícone Pendente hoje"
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#FFF5E8] rounded-[12px]"
              >
                <Clock3 size={17} className="text-[#C8661A]" />
              </div>
            </div>
            <div
              data-pencil-name="Valor Pendente hoje"
              className="text-[30px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal tracking-[-0.5px] text-left whitespace-nowrap"
            >
              {formatCurrency(dataFiltro && kpis?.resumoFiltrado ? kpis.resumoFiltrado.pendente : (kpis?.pendenteHoje || 0))}
            </div>
            <div
              data-pencil-name="Rodapé Pendente hoje"
              className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center"
            >
              <div
                data-pencil-name="Ponto Pendente hoje"
                className="box-border w-[7px] shrink-0 h-[7px] bg-[#C8661A] rounded-full"
              />
              <div
                data-pencil-name="Nota Pendente hoje"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {dataFiltro && kpis?.resumoFiltrado ? kpis.resumoFiltrado.qtdPendente : (kpis?.qtdPendenteHoje || 0)} reserva(s)
              </div>
            </div>
          </div>

          {/* Card 3: Recebido no mês */}
          <div
            data-pencil-name="Resumo Recebido no mês"
            className="box-border w-full h-full min-h-[128px] shadow-[0px_14px_28px_#0719150D] flex flex-col gap-[10px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px]"
          >
            <div
              data-pencil-name="Topo Recebido no mês"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Label Recebido no mês"
                className="text-[11px]/[normal] box-border text-[#59615A] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] text-left whitespace-nowrap"
              >
                RECEBIDO NO MÊS
              </div>
              <div
                data-pencil-name="Ícone Recebido no mês"
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#EEF3FF] rounded-[12px]"
              >
                <CalendarCheck size={17} className="text-[#2E5BFF]" />
              </div>
            </div>
            <div
              data-pencil-name="Valor Recebido no mês"
              className="text-[30px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal tracking-[-0.5px] text-left whitespace-nowrap"
            >
              {formatCurrency(kpis?.recebidoMes || 0)}
            </div>
            <div
              data-pencil-name="Rodapé Recebido no mês"
              className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center"
            >
              <div
                data-pencil-name="Ponto Recebido no mês"
                className="box-border w-[7px] shrink-0 h-[7px] bg-[#2E5BFF] rounded-full"
              />
              <div
                data-pencil-name="Nota Recebido no mês"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                mês atual · líquido de estornos
              </div>
            </div>
          </div>

          {/* Card 4: Inadimplência */}
          <div
            data-pencil-name="Resumo Inadimplência"
            className="box-border w-full h-full min-h-[128px] shadow-[0px_14px_28px_#0719150D] flex flex-col gap-[10px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px]"
          >
            <div
              data-pencil-name="Topo Inadimplência"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Label Inadimplência"
                className="text-[11px]/[normal] box-border text-[#59615A] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] text-left whitespace-nowrap"
              >
                INADIMPLÊNCIA
              </div>
              <div
                data-pencil-name="Ícone Inadimplência"
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#FFF1F0] rounded-[12px]"
              >
                <AlertTriangle size={17} className="text-[#B32323]" />
              </div>
            </div>
            <div
              data-pencil-name="Valor Inadimplência"
              className="text-[30px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal tracking-[-0.5px] text-left whitespace-nowrap"
            >
              {formatCurrency(kpis?.totalInadimplencia || 0)}
            </div>
            <div
              data-pencil-name="Rodapé Inadimplência"
              className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center"
            >
              <div
                data-pencil-name="Ponto Inadimplência"
                className="box-border w-[7px] shrink-0 h-[7px] bg-[#B32323] rounded-full"
              />
              <div
                data-pencil-name="Nota Inadimplência"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {kpis?.qtdInadimplentes || 0} reserva(s) vencidas
              </div>
            </div>
          </div>
        </div>

        {/* Controles Pagamentos Melhorado */}
        <div
          data-pencil-name="Controles Pagamentos Melhorado"
          className="box-border w-full h-auto shrink-0 flex flex-col gap-[12px] justify-start items-start"
        >
          {/* Linha Filtros */}
          <div
            data-pencil-name="Linha Filtros Melhorado"
            className="box-border w-full min-h-[40px] shrink-0 flex flex-wrap gap-3 justify-between items-center"
          >
            <div
              data-pencil-name="Filtros Pagamento Esquerda Melhorado"
              className="box-border w-fit shrink-0 h-fit flex flex-wrap gap-[8px] justify-start items-center"
            >
              {/* Busca */}
              <label
                data-pencil-name="Busca Pagamentos Melhorada"
                className="box-border w-[310px] shrink-0 h-[40px] flex flex-row gap-[8px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-text"
              >
                <Search size={16} className="text-[#9C9389] shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, ID ou quadra..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="text-[13px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal w-full bg-transparent outline-none border-none placeholder:text-[#9C9389]"
                />
              </label>

              {/* Filtro dd/mm/aaaa */}
              <label
                data-pencil-name="Filtro Melhorado dd/mm/aaaa"
                className="box-border w-fit shrink-0 h-[40px] flex flex-row gap-0 px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-pointer hover:bg-[#F9F7F3] transition-colors relative"
              >
                <DatePicker
                  
                  value={dataFiltro}
                  onValueChange={(value) => setDataFiltro(value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  
                />
                <div
                  data-pencil-name="Texto Filtro Melhorado dd/mm/aaaa"
                  className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {dataFiltro ? dataFiltro.split('-').reverse().join('/') : 'dd/mm/aaaa'}
                </div>
              </label>

              {/* Hoje */}
              <button
                type="button"
                data-pencil-name="Filtro Melhorado Hoje"
                onClick={() => definirData('hoje')}
                className={`box-border w-fit shrink-0 h-[40px] flex flex-row gap-0 px-[12px] justify-start items-center outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-pointer transition-colors border-none ${
                  dataFiltro === new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
                    ? 'bg-[#071915] text-[#FFFFFF]'
                    : 'bg-[#FFFFFF] text-[#071915] hover:bg-[#F9F7F3]'
                }`}
              >
                <div
                  data-pencil-name="Texto Filtro Melhorado Hoje"
                  className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Hoje
                </div>
              </button>

              {/* Ontem */}
              <button
                type="button"
                data-pencil-name="Filtro Melhorado Ontem"
                onClick={() => definirData('ontem')}
                className="box-border w-fit shrink-0 h-[40px] flex flex-row gap-0 px-[12px] justify-start items-center bg-[#FFFFFF] text-[#071915] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
              >
                <div
                  data-pencil-name="Texto Filtro Melhorado Ontem"
                  className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Ontem
                </div>
              </button>

              {/* Amanhã */}
              <button
                type="button"
                data-pencil-name="Filtro Melhorado Amanhã"
                onClick={() => definirData('amanha')}
                className="box-border w-fit shrink-0 h-[40px] flex flex-row gap-0 px-[12px] justify-start items-center bg-[#FFFFFF] text-[#071915] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
              >
                <div
                  data-pencil-name="Texto Filtro Melhorado Amanhã"
                  className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Amanhã
                </div>
              </button>

              {/* Limpar */}
              <button
                type="button"
                data-pencil-name="Filtro Melhorado Limpar"
                onClick={limparFiltros}
                className="box-border w-fit shrink-0 h-[40px] flex flex-row gap-0 px-[12px] justify-start items-center bg-[#FFFFFF] text-[#071915] outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[12px] cursor-pointer hover:bg-[#F9F7F3] transition-colors border-none"
              >
                <div
                  data-pencil-name="Texto Filtro Melhorado Limpar"
                  className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Limpar
                </div>
              </button>
            </div>

            <div
              data-pencil-name="Resumo Lista Pagamentos"
              className="text-[13px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              {reservas.length} reservas encontradas
            </div>
          </div>

          {/* Tabs Pagamentos */}
          <div
            data-pencil-name="Tabs Pagamentos Melhorado"
            className="box-border w-full h-[38px] shrink-0 flex flex-row gap-[8px] justify-start items-start overflow-x-auto custom-scrollbar"
          >
            <button
              type="button"
              onClick={() => setTabAtiva('Pendente')}
              data-pencil-name="Tab Melhorado Pendentes (0)"
              className={`box-border w-fit shrink-0 h-[36px] flex flex-row gap-0 px-[16px] justify-start items-center outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[10px] cursor-pointer transition-colors border-none ${
                tabAtiva === 'Pendente' ? 'bg-[#071915] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#4F5550] hover:bg-[#F9F7F3]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Melhorado Pendentes (0)"
                className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
              >
                Pendentes ({countPendentes})
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTabAtiva('Pago')}
              data-pencil-name="Tab Melhorado Pagos (24)"
              className={`box-border w-fit shrink-0 h-[36px] flex flex-row gap-0 px-[16px] justify-start items-center outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[10px] cursor-pointer transition-colors border-none ${
                tabAtiva === 'Pago' ? 'bg-[#071915] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#4F5550] hover:bg-[#F9F7F3]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Melhorado Pagos (24)"
                className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
              >
                Pagos ({countPagos})
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTabAtiva('inadimplentes')}
              data-pencil-name="Tab Melhorado Inadimplência (0)"
              className={`box-border w-fit shrink-0 h-[36px] flex flex-row gap-0 px-[16px] justify-start items-center outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[10px] cursor-pointer transition-colors border-none ${
                tabAtiva === 'inadimplentes' ? 'bg-[#071915] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#4F5550] hover:bg-[#F9F7F3]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Melhorado Inadimplência (0)"
                className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
              >
                Inadimplência ({countInadimplentes})
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTabAtiva('todos')}
              data-pencil-name="Tab Melhorado Todos (24)"
              className={`box-border w-fit shrink-0 h-[36px] flex flex-row gap-0 px-[16px] justify-start items-center outline outline-1 outline-[#E2D9CC] -outline-offset-1 rounded-[10px] cursor-pointer transition-colors border-none ${
                tabAtiva === 'todos' ? 'bg-[#071915] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#4F5550] hover:bg-[#F9F7F3]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Melhorado Todos (24)"
                className="text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
              >
                Todos ({countTodos})
              </div>
            </button>
          </div>
        </div>

        {/* Tabela Pagamentos Melhorada */}
        <div
          data-pencil-name="Tabela Pagamentos Melhorada"
          className="box-border w-full flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] overflow-hidden"
        >
          <div className="w-full overflow-x-auto custom-scrollbar">
            {/* Header Tabela Pagamentos */}
            <div
              data-pencil-name="Header Tabela Pagamentos Melhorada"
              className="box-border w-full min-w-[998px] h-[42px] shrink-0 flex flex-row gap-[10px] px-[18px] justify-start items-center bg-[#FBFAF7] select-none"
            >
              <div
                data-pencil-name="Head Melhorado ID"
                className="text-[10px]/[normal] box-border w-[62px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                ID
              </div>
              <div
                data-pencil-name="Head Melhorado CLIENTE"
                className="text-[10px]/[normal] box-border w-[150px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                CLIENTE
              </div>
              <div
                data-pencil-name="Head Melhorado QUADRA"
                className="text-[10px]/[normal] box-border w-[90px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                QUADRA
              </div>
              <div
                data-pencil-name="Head Melhorado DATA/HORA"
                className="text-[10px]/[normal] box-border w-[160px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                DATA/HORA
              </div>
              <div
                data-pencil-name="Head Melhorado VALOR"
                className="text-[10px]/[normal] box-border w-[90px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                VALOR
              </div>
              <div
                data-pencil-name="Head Melhorado PAGO"
                className="text-[10px]/[normal] box-border w-[90px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                PAGO
              </div>
              <div
                data-pencil-name="Head Melhorado MÉTODO"
                className="text-[10px]/[normal] box-border w-[94px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                MÉTODO
              </div>
              <div
                data-pencil-name="Head Melhorado STATUS"
                className="text-[10px]/[normal] box-border w-[70px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                STATUS
              </div>
              <div
                data-pencil-name="Head Melhorado AÇÕES"
                className="text-[10px]/[normal] box-border w-[76px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.5px] text-left"
              >
                AÇÕES
              </div>
            </div>

            {/* Linhas da Tabela */}
            <div className="w-full flex flex-col min-h-[140px] max-h-[520px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="w-full min-w-[998px] py-12 text-center text-[13px] text-[#6F766F]">
                  Carregando faturamentos...
                </div>
              ) : reservas.length === 0 ? (
                <div className="w-full min-w-[998px] py-12 text-center text-[13px] text-[#6F766F]">
                  Nenhuma reserva encontrada para os filtros aplicados.
                </div>
              ) : (
                reservas.map((r) => {
                  const statusBg =
                    r.status_pagamento === 'Pago'
                      ? 'bg-[#DFF8E8]'
                      : r.status_pagamento === 'Parcial'
                      ? 'bg-[#FFF5E8]'
                      : 'bg-[#FFF1F0]';

                  const statusColor =
                    r.status_pagamento === 'Pago'
                      ? 'text-[#138A4B]'
                      : r.status_pagamento === 'Parcial'
                      ? 'text-[#C8661A]'
                      : 'text-[#B32323]';

                  return (
                    <div
                      key={r.id}
                      data-pencil-name={`Linha Pagamento Melhorada #${r.id}`}
                      className="box-border w-full min-w-[998px] h-[49.5px] shrink-0 flex flex-row gap-[10px] px-[18px] justify-start items-center bg-[#FFFFFF] hover:bg-[#F9F7F3] transition-colors border-t border-[#F0EBE4]"
                    >
                      <div
                        data-pencil-name={`Cel Melhorada ID #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[62px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left"
                      >
                        #{r.id}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada CLIENTE #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[150px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-semibold text-left truncate pr-2"
                        title={r.cliente_nome}
                      >
                        {r.cliente_nome}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada QUADRA #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[90px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-semibold text-left truncate pr-2"
                        title={r.quadra_nome}
                      >
                        {r.quadra_nome}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada DATA/HORA #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[160px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-semibold text-left truncate pr-2"
                      >
                        {formatData(r.data_reserva)} · {r.hora_inicio}–{r.hora_fim}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada VALOR #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[90px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-semibold text-left"
                      >
                        {formatCurrency(r.valor_total)}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada PAGO #${r.id}`}
                        className={`text-[12px]/[normal] box-border w-[90px] shrink-0 font-[Inter,system-ui,sans-serif] font-normal text-left ${
                          r.total_pago > 0 ? 'text-[#138A4B]' : 'text-[#6F766F]'
                        }`}
                      >
                        {formatCurrency(r.total_pago)}
                      </div>
                      <div
                        data-pencil-name={`Cel Melhorada MÉTODO #${r.id}`}
                        className="text-[12px]/[normal] box-border w-[94px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-semibold text-left truncate pr-2"
                        title={r.metodos || '—'}
                      >
                        {r.metodos || '—'}
                      </div>
                      <div className="box-border w-[70px] shrink-0 flex items-center justify-start">
                        <div
                          data-pencil-name={`Status Melhorado #${r.id}`}
                          className={`box-border w-[70px] shrink-0 h-[26px] flex flex-row gap-0 justify-center items-center ${statusBg} rounded-[13px]`}
                        >
                          <div
                            data-pencil-name={`Texto Status Melhorado #${r.id}`}
                            className={`text-[12px]/[normal] box-border ${statusColor} font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap`}
                          >
                            {r.status_pagamento}
                          </div>
                        </div>
                      </div>
                      <div className="box-border w-[76px] shrink-0 flex items-center justify-start">
                        {r.status_pagamento === 'Pago' || r.status_pagamento.includes('Estorno') ? (
                          <button
                            type="button"
                            onClick={() => abrirEstorno(r)}
                            data-pencil-name={`Estornar Melhorado #${r.id}`}
                            className="box-border w-[76px] shrink-0 h-[30px] flex flex-row gap-0 justify-center items-center bg-[#FFF1F0] outline outline-1 outline-[#F4B4AD] -outline-offset-1 rounded-[9px] cursor-pointer hover:bg-[#FFEAE8] transition-colors border-none"
                          >
                            <div
                              data-pencil-name={`Texto Estornar Melhorado #${r.id}`}
                              className="text-[12px]/[normal] box-border text-[#B32323] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                            >
                              Estornar
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirPagamento(r)}
                            data-pencil-name={`Registrar Melhorado #${r.id}`}
                            className="box-border w-[76px] shrink-0 h-[30px] flex flex-row gap-0 justify-center items-center bg-[#071915] rounded-[9px] cursor-pointer hover:bg-black transition-colors border-none"
                          >
                            <div
                              data-pencil-name={`Texto Registrar Melhorado #${r.id}`}
                              className="text-[12px]/[normal] box-border text-[#C9FF3B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              Registrar
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Resumo Tabela Pagamentos Melhorado */}
            <div
              data-pencil-name="Resumo Tabela Pagamentos Melhorado"
              className="box-border w-full min-w-[998px] flex flex-row gap-0 px-[18px] py-[16px] justify-between items-center bg-[#F5FAFF] border-t border-[#E1EDF8] select-none"
            >
              <div
                data-pencil-name="Listando Pagamentos Melhorado"
                className="text-[13px]/[normal] box-border text-[#356078] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Listando {reservas.length} reserva(s)
              </div>
              <div
                data-pencil-name="Totais Pagamentos Melhorado"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[34px] justify-start items-start"
              >
                <div
                  data-pencil-name="Total Melhorado VALOR TOTAL"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Total Melhorado VALOR TOTAL"
                    className="text-[10px]/[normal] box-border text-[#356078] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    VALOR TOTAL
                  </div>
                  <div
                    data-pencil-name="Valor Total Melhorado VALOR TOTAL"
                    className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {formatCurrency(totalValor)}
                  </div>
                </div>

                <div
                  data-pencil-name="Total Melhorado TOTAL PAGO"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Total Melhorado TOTAL PAGO"
                    className="text-[10px]/[normal] box-border text-[#356078] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    TOTAL PAGO
                  </div>
                  <div
                    data-pencil-name="Valor Total Melhorado TOTAL PAGO"
                    className="text-[13px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {formatCurrency(totalPago)}
                  </div>
                </div>

                <div
                  data-pencil-name="Total Melhorado SALDO A RECEBER"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Total Melhorado SALDO A RECEBER"
                    className="text-[10px]/[normal] box-border text-[#356078] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    SALDO A RECEBER
                  </div>
                  <div
                    data-pencil-name="Valor Total Melhorado SALDO A RECEBER"
                    className={`text-[13px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                      totalSaldo > 0 ? 'text-[#B32323]' : 'text-[#356078]'
                    }`}
                  >
                    {formatCurrency(totalSaldo)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

{/* MODAL: REGISTRAR PAGAMENTO */}
      <div className={`modal-overlay ${activeModal === 'registrar-pagamento' ? 'open' : ''}`}>
        {reservaAtual && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Registrar Pagamento</h2>
              <button className="modal-close" onClick={fecharModalPagamento}>✕</button>
            </div>
            <div className="modal-body">
              {showPixCobranca ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
                  {loadingGateway ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', margin: '40px 0' }}>
                      {rpMetodo === 'Cartão (Maquineta Online)' ? 'Enviando cobrança para a maquineta...' : 'Gerando cobrança Pix...'}
                    </div>
                  ) : rpMetodo === 'Cartão (Maquineta Online)' ? (
                    <>
                      <div style={{ width: '120px', height: '120px', background: 'var(--cream-surface)', border: '1px solid var(--border-passive)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '16px' }}>
                        💳
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
                        Aguardando Cartão...
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', maxWidth: '280px' }}>
                        Cobrança enviada ao terminal <strong>{posDeviceId}</strong> no valor de <strong>{formatCurrency(parseCurrencyToFloat(rpValor))}</strong>. Insira ou aproxime o cartão.
                      </p>

                      <div style={{ width: '100%', borderTop: '1px solid var(--border-passive)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                          type="button"
                          onClick={handleSimularPagamentoPix}
                          style={{ background: 'var(--amber)', color: 'white', border: 'none', padding: '10px', borderRadius: 'var(--r-md)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                        >
                          ⚡ Simular Aproximação do Cartão
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '150px', height: '150px', background: 'white', border: '1px solid var(--border-passive)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', marginBottom: '16px' }}>
                        <img src={qrCode} alt="Pix QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', maxWidth: '280px' }}>
                        {pixManual
                          ? 'Pix por chave, sem confirmação automática. Confira o crédito no banco da arena antes de registrar o recebimento. Para confirmar automaticamente, conecte o Mercado Pago em Configurações → Pagamentos.'
                          : 'Peça para o cliente escanear o QR Code acima. A tela atualizará automaticamente após a confirmação do Mercado Pago.'}
                      </p>
                      {pixManual && (
                        <button type="button" className="btn-primary" onClick={confirmarPixManual} disabled={loadingGateway}>
                          Conferi no banco: registrar recebimento
                        </button>
                      )}
                      
                      <div style={{ width: '100%', textAlign: 'left', marginBottom: '20px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Pix Copia e Cola</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            readOnly 
                            value={copiaCola} 
                            style={{ flex: 1, fontSize: '11px', fontFamily: 'monospace', border: '1px solid var(--border-passive)', padding: '6px 10px', borderRadius: '4px', background: 'var(--cream-surface)', outline: 'none' }}
                          />
                          <button 
                            type="button" 
                            style={{ background: 'rgba(47, 133, 90, 0.1)', color: '#2F855A', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => {
                              navigator.clipboard.writeText(copiaCola);
                              showToast('Chave Pix copiada!', 'success');
                            }}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>

                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ background: 'var(--cream-surface)', border: '1px solid var(--border-passive)', borderRadius: 'var(--r-md)', padding: 'var(--s-3) var(--s-4)', marginBottom: 'var(--s-4)', fontSize: '13px' }}>
                    <strong>{reservaAtual.cliente_nome}</strong> · {reservaAtual.quadra_nome} · {formatData(reservaAtual.data_reserva)} {reservaAtual.hora_inicio}–{reservaAtual.hora_fim}<br />
                    Valor total: <strong>{formatCurrency(reservaAtual.valor_total)}</strong> · Pago: <strong className="valor-positivo">{formatCurrency(reservaAtual.total_pago)}</strong> · Saldo: <strong className="valor-negativo">{formatCurrency(reservaAtual.saldo_devedor)}</strong>
                  </div>

                  {/* Histórico */}
                  {pagamentosReserva.filter(p => p.valor > 0).length > 0 && (
                    <div style={{ marginBottom: 'var(--s-4)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: 'var(--s-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Histórico de Pagamentos
                      </div>
                      <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {pagamentosReserva.filter(p => p.valor > 0).map(p => (
                          <div className="hist-item" key={p.id}>
                            <span>{p.metodo} — {formatPaymentDate(p.registrado_em)}</span>
                            <span className="valor-positivo">{formatCurrency(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
                    <div className="form-group">
                      <label htmlFor="rp-valor">Valor a pagar *</label>
                      <input 
                        type="text" 
                        id="rp-valor" 
                        placeholder="0,00" 
                        value={rpValor}
                        onChange={(e) => setRpValor(formatCurrencyInput(e.target.value))}
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="rp-metodo">Método *</label>
                      <select 
                        id="rp-metodo" 
                        value={rpMetodo}
                        onChange={(e) => setRpMetodo(e.target.value)}
                        required
                      >
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
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" type="button" onClick={fecharModalPagamento}>
                {showPixCobranca ? 'Voltar' : 'Cancelar'}
              </button>
              {!showPixCobranca && (
                <button className="btn-primary" type="button" onClick={handleSalvarPagamento}>Salvar Pagamento</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ESTORNAR PAGAMENTO */}
      <div className={`modal-overlay ${activeModal === 'estornar-pagamento' ? 'open' : ''}`}>
        {reservaAtual && (
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Estornar Pagamento</h2>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <RefundNotice {...refund} />
              {refundResult && <p role="status">{refundResult}</p>}

              <div style={{ background: 'var(--cream-surface)', border: '1px solid var(--border-passive)', borderRadius: 'var(--r-md)', padding: 'var(--s-3) var(--s-4)', marginBottom: 'var(--s-4)', fontSize: '13px' }}>
                Reserva #{reservaAtual.id} de <strong>{reservaAtual.cliente_nome}</strong> <br />
                Valor Total: <strong>{formatCurrency(reservaAtual.valor_total)}</strong> · Pago: <strong className="valor-positivo">{formatCurrency(reservaAtual.total_pago)}</strong>
              </div>

              {/* Pagamentos disponíveis para estorno */}
              {refund.quote?.online ? null : loadingHistorico ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Carregando pagamentos...</p>
              ) : pagamentosReserva.filter(p => p.valor > 0).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Nenhum pagamento encontrado para estorno.</p>
              ) : (
                <div style={{ marginBottom: 'var(--s-4)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: 'var(--s-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Selecione o pagamento a ser estornado
                  </div>
                  {pagamentosReserva.filter(p => p.valor > 0).map(p => (
                    <div 
                      key={p.id} 
                      className={`hist-item p-2 rounded-md mb-1 cursor-pointer flex justify-between items-center ${
                        pagamentoEstornoId === p.id ? 'bg-cream-surface border border-primary' : 'hover:bg-cream-surface/50 border border-transparent'
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPagamentoEstornoId(p.id);
                        setEstpValor(formatFloatToCurrencyInput(p.valor));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setPagamentoEstornoId(p.id);
                          setEstpValor(formatFloatToCurrencyInput(p.valor));
                        }
                      }}
                    >
                      <span className="text-xs text-charcoal">{p.metodo} — {formatPaymentDate(p.registrado_em)}</span>
                      <span className="font-semibold text-xs valor-positivo">{formatCurrency(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="estp-valor">Valor a estornar *</label>
                <input 
                  type="text" 
                  id="estp-valor" 
                  placeholder="Ex: 15,00" 
                  readOnly={Boolean(refund.quote?.online)}
                  value={refund.quote?.online ? formatFloatToCurrencyInput(refund.quote.valor_centavos / 100) : estpValor}
                  onChange={(e) => setEstpValor(formatCurrencyInput(e.target.value))}
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="estp-motivo">Justificativa do Estorno *</label>
                <textarea 
                  id="estp-motivo" 
                  rows={2} 
                  placeholder="Obrigatório para auditoria" 
                  maxLength={100} 
                  value={estpMotivo}
                  onChange={(e) => setEstpMotivo(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" type="button" onClick={() => setActiveModal(null)}>Cancelar</button>
              <button 
                className="btn-primary" 
                type="button" 
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
    </div>
  );
}
