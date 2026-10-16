import { ToastLayer } from "../../components/ToastLayer";
import { ArenaPortalButton } from '../../components/ArenaPortalButton';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePixRecovery } from '../../hooks/usePixRecovery';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
  Zap,
  Repeat2,
  Globe,
  Bell,
  Sparkles,
  Star,
  Landmark,
  Users,
  ArrowRight,
  Check,
  AlertTriangle,
  ShieldCheck,
  X,
  FileText,
  Copy,
  CheckCheck,
  Menu,
} from 'lucide-react';
import { enterpriseContactUrl } from '../../utils/commercialContact';
import { errorMessage } from '../../utils/errorMessage';
import { subscriptionDate } from '../../utils/subscriptionDate';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { getStoredUser } from '../../utils/session';
import type { Announcement } from '../../types/api';

interface PlanoDados {
  arena_id: number;
  arena_nome: string;
  arena_status: number; // 1 = Ativa, 0 = Inadimplente/Bloqueada
  dia_vencimento: number;
  trial_expira_em: string | null;
  em_trial?: boolean;
  dias_restantes_trial?: number;
  ciclo_cobranca?: string;
  cobertura_ate?: string | null;
  proximo_vencimento?: string | null;
  meses_adiantados?: number;
  proxima_competencia?: string | null;
  plano: {
    id: number;
    nome: string;
    valor_mensal: number;
    valor_anual?: number;
    max_quadras: number;
    max_usuarios: number;
  };
  uso: {
    quadras_usadas: number;
    usuarios_usados: number;
  };
  fatura_atual: {
    id: number;
    valor: number;
    data_vencimento: string;
    status: string;
  } | null;
}

interface Fatura {
  id: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'Paga' | 'Pendente' | 'Atrasada';
  gateway_ref: string | null;
  copia_cola: string | null;
  qr_expira_em: string | null;
  metodo_pagamento: string | null;
  plano_nome: string;
  ciclo?: string;
  descricao?: string;
  competencia?: string;
  antecipada?: boolean;
}

interface PixResponse {
  qr_code: string | null;
  copia_cola: string;
  gateway_ref: string;
  expira_em: string;
  reutilizado?: boolean;
}

interface PlanoItem {
  id: number;
  nome: string;
  max_quadras: number;
  max_usuarios: number;
  valor_mensal: number;
  valor_anual: number;
}

interface ReciboData {
  recibo_numero: string;
  data_emissao: string;
  fatura: {
    id: number;
    valor: number;
    ciclo: string;
    descricao: string;
    data_vencimento: string;
    data_pagamento: string;
    metodo_pagamento: string | null;
    gateway_ref: string | null;
    periodo_fim: string;
    status: string;
  };
  plano: {
    nome: string;
    max_quadras: number;
    max_usuarios: number;
  };
  arena: {
    nome: string;
    email: string;
    telefone: string;
    endereco: string;
    slug: string;
  };
  emissor: {
    empresa: string | null;
    cnpj: string | null;
    suporte: string | null;
  };
}

export function AdminAssinatura() {
  const pixRecovery = usePixRecovery();
  const { onToggleSidebar } = useOutletContext<{ onToggleSidebar?: () => void }>() || {};

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [dados, setDados] = useState<PlanoDados | null>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);

  // Arena & Usuário
  const user = getStoredUser();
  const userName = user?.nome || 'fefe';

  // Notificações
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Modal Planos / Upgrade
  const [modalPlanosOpen, setModalPlanosOpen] = useState(false);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoItem[]>([]);
  const [erroPlanos, setErroPlanos] = useState<string | null>(null);
  const [confirmacaoPlano, setConfirmacaoPlano] = useState<{ plano: PlanoItem; ciclo: 'mensal' | 'anual'; totalCentavos: number } | null>(null);
  const enviandoTroca = useRef(false);
  const [loadingPlanos, setLoadingPlanos] = useState(false);
  const [solicitandoUpgradeId, setSolicitandoUpgradeId] = useState<number | null>(null);
  const [cicloSelecionado, setCicloSelecionado] = useState<'mensal' | 'anual'>('mensal');

  // Modal Recibo
  const [modalReciboOpen, setModalReciboOpen] = useState(false);
  const [reciboSelecionado, setReciboSelecionado] = useState<ReciboData | null>(null);
  const [carregandoRecibo, setCarregandoRecibo] = useState(false);

  // Modal Pix
  const [modalPixOpen, setModalPixOpen] = useState(false);
  const [faturaSelecionada, setFaturaSelecionada] = useState<Fatura | null>(null);
  const [pixData, setPixData] = useState<PixResponse | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [pixPagoComSucesso, setPixPagoComSucesso] = useState(false);
  const [pixExpirado, setPixExpirado] = useState(false);

  // Modal Todas as Faturas
  const [modalTodasFaturasOpen, setModalTodasFaturasOpen] = useState(false);

  const [adiantandoMensalidade, setAdiantandoMensalidade] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carregar dados de Assinatura e Faturas
  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resPlano, resFaturas] = await Promise.all([
        fetch('/api/tenant/assinatura/plano'),
        fetch('/api/tenant/assinatura/faturas'),
      ]);

      if (!resPlano.ok) {
        const errJson = await resPlano.json();
        throw new Error(errJson.error || 'Erro ao carregar dados do plano.');
      }
      if (!resFaturas.ok) {
        const errJson = await resFaturas.json();
        throw new Error(errJson.error || 'Erro ao carregar faturas.');
      }

      const dataPlano = await resPlano.json();
      const dataFaturas = await resFaturas.json();

      if (!dataPlano?.plano?.nome || !dataPlano?.uso ||
          ![dataPlano.plano.valor_mensal, dataPlano.plano.max_quadras, dataPlano.plano.max_usuarios,
            dataPlano.uso.quadras_usadas, dataPlano.uso.usuarios_usados].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
        throw new Error('Os dados da assinatura estão indisponíveis. Tente novamente.');
      }

      setDados(dataPlano);
      setFaturas(Array.isArray(dataFaturas) ? dataFaturas : []);
    } catch (e) {
      setErro(errorMessage(e) || 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();



    fetch('/api/auth/comunicados/ativos', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, [carregarDados]);

  // Polling automático do Pix
  useEffect(() => {
    if (!modalPixOpen || !pixData || !pixData.gateway_ref || pixPagoComSucesso || pixExpirado) return;

    if (pixData.expira_em && new Date() >= new Date(pixData.expira_em)) {
      setPixExpirado(true);
      return;
    }

    const interval = setInterval(async () => {
      if (pixData.expira_em && new Date() >= new Date(pixData.expira_em)) {
        clearInterval(interval);
        setPixExpirado(true);
        showToast('O prazo de validade deste QR Code Pix expirou.', 'info');
        return;
      }

      try {
        const res = await fetch(`/api/tenant/assinatura/status-pagamento/${pixData.gateway_ref}`);
        if (res.ok) {
          const statusJson = await res.json();
          if (statusJson.pago) {
            setPixPagoComSucesso(true);
            showToast('🎉 Pagamento Pix confirmado com sucesso! Seu plano foi atualizado.', 'success');
            carregarDados();
          }
        }
      } catch (err) {
        console.error('Erro no polling do Pix:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [modalPixOpen, pixData, pixPagoComSucesso, pixExpirado, carregarDados]);

  // Abrir modal de seleção de planos
  const abrirModalPlanos = async () => {
    setModalPlanosOpen(true);
    setConfirmacaoPlano(null);
    setLoadingPlanos(true);
    setErroPlanos(null);
    setPlanosDisponiveis([]);
    try {
      const res = await fetch('/api/tenant/assinatura/planos-disponiveis');
      if (!res.ok) throw new Error('Não foi possível carregar os planos.');
      const data = await res.json();
      if (!Array.isArray(data) || !data.length || data.some(p =>
        !Number.isInteger(p.id) || !p.nome ||
        ![p.valor_mensal, p.valor_anual, p.max_quadras, p.max_usuarios].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0))) {
        throw new Error('Os dados dos planos estão indisponíveis.');
      }
      setPlanosDisponiveis(data);
    } catch (err) {
      setErroPlanos(errorMessage(err));
    } finally {
      setLoadingPlanos(false);
    }
  };

  // Solicitar upgrade de plano
  const handleSolicitarUpgrade = async () => {
    if (!confirmacaoPlano || enviandoTroca.current) return;
    const { plano, ciclo: cicloEscolhido, totalCentavos } = confirmacaoPlano;
    const planoId = plano.id;
    enviandoTroca.current = true;
    setSolicitandoUpgradeId(planoId);
    try {
      const res = await fetch('/api/tenant/assinatura/solicitar-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano_id: planoId, ciclo: cicloEscolhido, valor_confirmado_centavos: totalCentavos }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.fatura_id) pixRecovery.show(resData, `/api/tenant/assinatura/faturas/${resData.fatura_id}/pix`);
        void carregarDados();
        throw new Error(resData.error || 'Erro ao solicitar upgrade.');
      }

      setModalPlanosOpen(false);
      setConfirmacaoPlano(null);
      setFaturaSelecionada({
        id: resData.fatura_id,
        valor: resData.valor,
        data_vencimento: new Date().toISOString().split('T')[0],
        data_pagamento: null,
        status: 'Pendente',
        gateway_ref: resData.pix?.gateway_ref || null,
        copia_cola: resData.pix?.copia_cola || null,
        qr_expira_em: resData.pix?.expira_em || null,
        metodo_pagamento: 'Pix Online',
        plano_nome: resData.plano_nome,
      });
      setPixData(resData.pix);
      setModalPixOpen(true);
      setPixPagoComSucesso(false);
      setPixCopiado(false);
      setPixExpirado(false);
      showToast(`Cobrança Pix gerada para o Plano ${resData.plano_nome}!`, 'info');
      carregarDados();
    } catch (err) {
      showToast(errorMessage(err) || 'Erro ao processar upgrade de plano.', 'error');
    } finally {
      enviandoTroca.current = false;
      setSolicitandoUpgradeId(null);
    }
  };

  // Visualizar recibo
  const handleVisualizarRecibo = async (faturaId: number) => {
    setCarregandoRecibo(true);
    setModalReciboOpen(true);
    setReciboSelecionado(null);
    try {
      const res = await fetch(`/api/tenant/assinatura/faturas/${faturaId}/recibo`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar recibo.');
      setReciboSelecionado(data);
    } catch (err) {
      showToast(errorMessage(err) || 'Erro ao carregar recibo.', 'error');
      setModalReciboOpen(false);
    } finally {
      setCarregandoRecibo(false);
    }
  };

  // Gerar Pix de uma fatura
  const handlePagarPix = async (fatura: Fatura) => {
    setFaturaSelecionada(fatura);
    setPixData(null);
    setPixPagoComSucesso(false);
    setPixCopiado(false);
    setPixExpirado(false);
    setModalPixOpen(true);
    setGerandoPix(true);

    try {
      const res = await fetch(`/api/tenant/assinatura/faturas/${fatura.id}/gerar-pix`, {
        method: 'POST',
      });

      const json = await res.json();
      if (!res.ok) {
        pixRecovery.show(json, `/api/tenant/assinatura/faturas/${fatura.id}/pix`);
        throw new Error(json.error || 'Erro ao gerar Pix.');
      }

      setPixData(json);
    } catch (err) {
      showToast(errorMessage(err) || 'Não foi possível gerar a cobrança Pix.', 'error');
      setModalPixOpen(false);
    } finally {
      setGerandoPix(false);
    }
  };

  // Copiar chave Pix
  const handleCopiarPix = () => {
    if (!pixData || !pixData.copia_cola) return;
    navigator.clipboard.writeText(pixData.copia_cola);
    setPixCopiado(true);
    showToast('Chave Pix copia e cola copiada!', 'success');
    setTimeout(() => setPixCopiado(false), 3000);
  };

  // Adiantamento de Mensalidade
  const handleAdiantarMensalidade = async () => {
    setAdiantandoMensalidade(true);
    try {
      const res = await fetch('/api/tenant/assinatura/adiantar-fatura', {
        method: 'POST',
      });
      const resData = await res.json();
      if (!res.ok) {
        if (resData.fatura_id) pixRecovery.show(resData, `/api/tenant/assinatura/faturas/${resData.fatura_id}/pix`);
        void carregarDados();
        throw new Error(resData.error || 'Erro ao gerar fatura antecipada.');
      }

      setFaturaSelecionada({
        id: resData.fatura_id,
        valor: resData.valor,
        data_vencimento: resData.data_vencimento,
        data_pagamento: null,
        status: 'Pendente',
        gateway_ref: resData.pix?.gateway_ref || null,
        copia_cola: resData.pix?.copia_cola || null,
        qr_expira_em: resData.pix?.expira_em || null,
        metodo_pagamento: 'Pix Online',
        plano_nome: resData.plano_nome,
      });
      setPixData(resData.pix);
      setModalPixOpen(true);
      setPixPagoComSucesso(false);
      setPixCopiado(false);
      setPixExpirado(false);
      showToast(`Cobrança Pix da próxima mensalidade gerada com sucesso!`, 'info');
      carregarDados();
    } catch (err) {
      showToast(errorMessage(err) || 'Erro ao adiantar mensalidade.', 'error');
    } finally {
      setAdiantandoMensalidade(false);
    }
  };

  // Formatação de data
  const formatarDataBR = (dataStr?: string | null) => {
    if (!dataStr) return '—';
    try {
      const str = String(dataStr).trim();
      const datePart = str.split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    } catch { /* Preserva o valor original quando a data não pode ser formatada. */ }
    return String(dataStr);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Detalhes da próxima data de cobrança
  const proximaData = subscriptionDate(dados?.proximo_vencimento || dados?.trial_expira_em || dados?.fatura_atual?.data_vencimento);

  // Cálculos de capacidade e trial
  const quadrasUsadas = dados?.uso?.quadras_usadas ?? 0;
  const maxQuadras = dados?.plano?.max_quadras ?? 0;
  const quadrasDisponiveis = Math.max(0, maxQuadras - quadrasUsadas);
  const quadrasPct = maxQuadras > 0 ? Math.min(100, Math.round((quadrasUsadas / maxQuadras) * 100)) : 0;

  const usuariosUsados = dados?.uso?.usuarios_usados ?? 0;
  const maxUsuarios = dados?.plano?.max_usuarios ?? 0;
  const usuariosDisponiveis = Math.max(0, maxUsuarios - usuariosUsados);
  const usuariosPct = maxUsuarios > 0 ? Math.min(100, Math.round((usuariosUsados / maxUsuarios) * 100)) : 0;

  const isTrial = dados?.em_trial ?? false;
  const diasRestantes = dados?.dias_restantes_trial ?? 0;
  const diasConsumidos = Math.max(0, 30 - diasRestantes);
  const trialPercentage = Math.min(100, Math.max(0, Math.round((diasConsumidos / 30) * 100))) || 50;

  // Fatura mais recente / pendente
  const faturaPendente = faturas.filter((f) => f.status === 'Pendente' || f.status === 'Atrasada')
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.id - b.id)[0];
  const valorFaturaAtual = faturaPendente?.valor;

  if (loading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-[#6F766F] font-[Inter,sans-serif]">
        <div className="w-8 h-8 rounded-full border-2 border-[#071915] border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Carregando informações da sua assinatura...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center gap-4 text-center font-[Inter,sans-serif]">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-xl font-bold">
          ⚠️
        </div>
        <h3 className="text-lg font-bold text-[#071915]">Ocorreu um erro ao carregar assinatura</h3>
        <p className="text-sm text-[#6F766F] max-w-md">{erro}</p>
        <button
          onClick={carregarDados}
          className="px-5 py-2.5 rounded-xl bg-[#071915] text-[#FFFFFF] font-bold text-xs hover:bg-[#122822] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div
      data-pencil-name="Assinatura"
      className="admin-assinatura-page w-full flex flex-col min-w-0 font-[Inter,system-ui,sans-serif]"
    >
      {pixRecovery.notice}
      {/* Toast Notification */}
      {toast && (
        <ToastLayer><div
          style={{ zIndex: 999999 }}
          className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slideUp border ${
            toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500'
              : toast.type === 'info'
              ? 'bg-blue-600 border-blue-500'
              : 'bg-rose-600 border-rose-500'
          }`}
        >
          <span>{toast.message}</span>
        </div></ToastLayer>
      )}

      {/* Área Principal Assinatura */}
      <div
        data-pencil-name="Área Principal Assinatura"
        className="box-border w-full flex flex-col gap-[18px] justify-start items-start"
      >
        {/* Cabeçalho Assinatura Autêntico */}
        <div
          data-pencil-name="Cabeçalho Assinatura Autêntico"
          className="box-border w-full min-h-[64px] shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center select-none"
        >
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-xl bg-white border border-[#E6DED2] text-[#071915] hover:bg-[#F1EDE6] transition-colors"
                title="Abrir menu"
              >
                <Menu size={20} />
              </button>
            )}
            <div
              data-pencil-name="Título Assinatura Autêntico"
              className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
            >
              <div
                data-pencil-name="Breadcrumb Assinatura Autêntico"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Conta / Assinatura
              </div>
              <div
                data-pencil-name="Título Minha Assinatura"
                className="text-[28px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
              >
                Minha Assinatura
              </div>
            </div>
          </div>

          {/* Ações Assinatura Autêntico */}
          <div
            data-pencil-name="Ações Assinatura Autêntico"
            className="box-border w-fit shrink-0 h-fit flex flex-wrap gap-[10px] justify-start items-center"
          >
            {/* Ação topo Pagar mensalidade */}
            <button
              data-pencil-name="Ação topo Pagar mensalidade"
              type="button"
              disabled={adiantandoMensalidade}
              onClick={handleAdiantarMensalidade}
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[14px] justify-start items-center bg-[#C9FF3B] hover:bg-[#b8f028] rounded-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Zap size={15} className="text-[#071915] shrink-0 fill-[#071915]" />
              <div
                data-pencil-name="Texto Pagar mensalidade"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                {adiantandoMensalidade ? 'Gerando...' : 'Pagar mensalidade'}
              </div>
            </button>

            {/* Ação topo Trocar plano */}
            <button
              data-pencil-name="Ação topo Trocar plano"
              type="button"
              onClick={abrirModalPlanos}
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[14px] justify-start items-center bg-[#071915] hover:bg-[#122822] rounded-[10px] transition-all cursor-pointer active:scale-95"
            >
              <Repeat2 size={15} className="text-[#FFFFFF] shrink-0" />
              <div
                data-pencil-name="Texto Trocar plano"
                className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Trocar plano
              </div>
            </button>

            {/* Acesso usuário Assinatura refinado */}
            <div
              data-pencil-name="Acesso usuário Assinatura refinado"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
            >
              {/* Portal do Cliente */}
              <ArenaPortalButton />

              {/* Usuário fefe */}
              <div
                data-pencil-name="Usuário fefe Assinatura refinado"
                className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[11px] justify-start items-center bg-[#F1EDE6] rounded-[17px]"
              >
                <div
                  data-pencil-name="Online Assinatura refinado"
                  className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full"
                />
                <div
                  data-pencil-name="Nome fefe Assinatura refinado"
                  className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-[120px]"
                >
                  {userName}
                </div>
              </div>

              {/* Notificações */}
              <div className="relative">
                <button
                  data-pencil-name="Notificações Assinatura refinado"
                  type="button"
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] flex items-center justify-center hover:bg-[#F7F2EA] transition-colors cursor-pointer relative"
                  title="Notificações"
                >
                  <Bell size={16} className="text-[#071915]" />
                  {notifications.length > 0 && (
                    <div
                      data-pencil-name="Bolinha Notificação Assinatura refinado"
                      className="box-border w-[7px] h-[7px] absolute right-2 top-2 bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] -outline-offset-1 rounded-full z-10"
                    />
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E6DED2] p-4 z-50 text-[#071915] text-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0EBE4] font-bold">
                      <span>Comunicados do Sistema</span>
                      <span className="text-[10px] bg-[#F1EDE6] px-2 py-0.5 rounded-full">
                        {notifications.length}
                      </span>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-[#6F766F] text-center py-4">Nenhum comunicado no momento.</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
                        {notifications.map((n) => (
                          <div key={n.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4]">
                            <p className="font-semibold text-xs mb-1">{n.message}</p>
                            <p className="text-[11px] text-[#6F766F]">{new Date(n.createdAt).toLocaleDateString('pt-BR')}</p>
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

        {/* Painel do Plano Atual */}
        <div
          data-pencil-name="Painel do Plano Atual"
          className="box-border w-full min-h-[238px] shrink-0 flex flex-col lg:flex-row gap-[22px] p-[24px] justify-between items-start bg-[#071915] rounded-[22px] overflow-hidden shadow-xl"
        >
          {/* Plano Atual Conteúdo */}
          <div
            data-pencil-name="Plano Atual Conteúdo"
            className="box-border flex-1 h-full flex flex-col gap-[12px] justify-start items-start min-w-0"
          >
            {isTrial ? (
              <div
                data-pencil-name="Tag Trial Ativo"
                className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] px-[10px] py-[6px] justify-start items-center bg-[#C9FF3B] rounded-[14px]"
              >
                <Sparkles size={14} className="text-[#071915]" />
                <div
                  data-pencil-name="Texto Trial"
                  className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left whitespace-nowrap"
                >
                  TRIAL ATIVO · {diasRestantes} DIAS RESTANTES
                </div>
              </div>
            ) : (
              <div
                data-pencil-name="Tag Assinatura Ativa"
                className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] px-[10px] py-[6px] justify-start items-center bg-[#EAF8EF] rounded-[14px]"
              >
                <Check size={14} className="text-[#138A4B]" />
                <div className="text-[11px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left whitespace-nowrap">
                  ASSINATURA ATIVA
                </div>
              </div>
            )}

            <div
              data-pencil-name="Plano Basic Hero"
              className="text-[31px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-tight"
            >
              Plano {dados?.plano?.nome}
            </div>

            <div
              data-pencil-name="Descrição Plano Hero"
              className="text-[12px]/[normal] box-border w-full max-w-[620px] text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left leading-relaxed"
            >
              {isTrial
                ? 'Sua arena está operando no período gratuito. Ao efetivar, você mantém reservas, pagamentos, relatórios e portal do cliente sem interrupção.'
                : 'Sua arena está operando com todos os recursos e integrações ativas, garantindo automação total de reservas e pagamentos.'}
            </div>

            {/* Metadados Plano */}
            <div
              data-pencil-name="Metadados Plano"
              className="box-border w-fit h-fit shrink-0 flex flex-wrap gap-[12px] justify-start items-start pt-1"
            >
              {/* Meta Próxima renovação */}
              <div
                data-pencil-name="Meta Próxima renovação"
                className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] px-[12px] py-[10px] justify-start items-start bg-[#152018] rounded-[12px]"
              >
                <div
                  data-pencil-name="Valor Próxima renovação"
                  className="text-[15px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {formatCurrency(dados?.plano?.valor_mensal ?? 0)}/mês
                </div>
                <div
                  data-pencil-name="Label Próxima renovação"
                  className="text-[10px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Próxima renovação
                </div>
              </div>

              {/* Meta Fim do trial */}
              <div
                data-pencil-name="Meta Fim do trial"
                className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] px-[12px] py-[10px] justify-start items-start bg-[#152018] rounded-[12px]"
              >
                <div
                  data-pencil-name="Valor Fim do trial"
                  className="text-[15px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {proximaData?.formatada || 'Data indisponível'}
                </div>
                <div
                  data-pencil-name="Label Fim do trial"
                  className="text-[10px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  {isTrial ? 'Fim do trial' : 'Próximo vencimento'}
                </div>
              </div>

              {/* Meta Plano contratado */}
              <div
                data-pencil-name="Meta Plano contratado"
                className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] px-[12px] py-[10px] justify-start items-start bg-[#152018] rounded-[12px]"
              >
                <div
                  data-pencil-name="Valor Plano contratado"
                  className="text-[15px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {dados?.plano?.nome}
                </div>
                <div
                  data-pencil-name="Label Plano contratado"
                  className="text-[10px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Plano contratado
                </div>
              </div>
            </div>
          </div>

          {/* Medidor de continuidade */}
          <div
            data-pencil-name="Medidor de continuidade"
            className="box-border w-full lg:w-[310px] shrink-0 h-full flex flex-col gap-[12px] p-[16px] justify-start items-start bg-[#101A13] rounded-[18px]"
          >
            <div
              data-pencil-name="Título Continuidade"
              className="text-[16px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              Continuidade do serviço
            </div>
            <div
              data-pencil-name="Texto Continuidade"
              className="text-[12px]/[normal] box-border w-full text-[#C6D0C3] font-[Inter,system-ui,sans-serif] font-normal text-left leading-snug"
            >
              Efetive a assinatura antes do fim do trial para evitar bloqueio de automações e portal.
            </div>

            {/* Linha Trial Progresso */}
            <div
              data-pencil-name="Linha Trial Progresso"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[8px] justify-start items-start"
            >
              <div
                data-pencil-name="Topo Trial Progresso"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
              >
                <div
                  data-pencil-name="Label Trial Progresso"
                  className="text-[11px]/[normal] box-border text-[#C6D0C3] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Trial consumido
                </div>
                <div
                  data-pencil-name="Valor Trial Progresso"
                  className="text-[11px]/[normal] box-border text-[#C9FF3B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {trialPercentage}%
                </div>
              </div>
              <div
                data-pencil-name="Barra Trial"
                className="box-border w-full h-[9px] shrink-0 bg-[#2A342D] rounded-[9px] relative overflow-hidden"
              >
                <div
                  data-pencil-name="Preenchimento Trial"
                  style={{ width: `${trialPercentage}%` }}
                  className="box-border h-[9px] absolute left-0 top-0 bg-[#C9FF3B] rounded-[9px] transition-all duration-500"
                />
              </div>
            </div>

            {/* CTA Hero Assinatura */}
            <button
              data-pencil-name="CTA Hero Assinatura"
              type="button"
              onClick={handleAdiantarMensalidade}
              disabled={adiantandoMensalidade}
              className="box-border w-full h-[36px] shrink-0 flex flex-row gap-[8px] justify-center items-center bg-[#C9FF3B] hover:bg-[#b8f028] rounded-[10px] transition-all cursor-pointer active:scale-95 shadow-md mt-auto"
            >
              <Star size={15} className="text-[#071915] fill-[#071915]" />
              <div
                data-pencil-name="Texto CTA Hero"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Efetivar assinatura agora
              </div>
            </button>
          </div>
        </div>

        {/* Corpo Assinatura Autêntico */}
        <div
          data-pencil-name="Corpo Assinatura Autêntico"
          className="box-border w-full flex flex-col lg:flex-row gap-[18px] justify-start items-stretch"
        >
          {/* Uso do Plano Assinatura (Capacidade do plano) */}
          <div
            data-pencil-name="Uso do Plano Assinatura"
            className="box-border w-full lg:w-[430px] shrink-0 flex flex-col gap-[16px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px] shadow-sm"
          >
            <div
              data-pencil-name="Header Uso Premium"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Título Uso Premium"
                className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Capacidade do plano
              </div>
              <div
                data-pencil-name="Selo Uso Premium"
                className="text-[12px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                {dados?.plano?.nome}
              </div>
            </div>

            {/* Tile Uso Quadras */}
            <div
              data-pencil-name="Tile Uso Quadras"
              className="box-border w-full flex-1 flex flex-row gap-[12px] p-[12px] justify-start items-center bg-[#FBFAF7] rounded-[14px]"
            >
              <div
                data-pencil-name="Ícone Tile Quadras"
                className="box-border w-[40px] shrink-0 h-[40px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[13px]"
              >
                <Landmark size={18} className="text-[#2563EB]" />
              </div>
              <div
                data-pencil-name="Texto Tile Quadras"
                className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
              >
                <div
                  data-pencil-name="Topo Tile Quadras"
                  className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
                >
                  <div
                    data-pencil-name="Label Tile Quadras"
                    className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Quadras
                  </div>
                  <div
                    data-pencil-name="Valor Tile Quadras"
                    className="text-[13px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {quadrasUsadas}/{maxQuadras}
                  </div>
                </div>
                <div
                  data-pencil-name="Barra Tile Quadras"
                  className="box-border w-full h-[7px] shrink-0 bg-[#F1EDE6] rounded-[7px] relative overflow-hidden"
                >
                  <div
                    data-pencil-name="Preenchimento Tile Quadras"
                    style={{ width: `${quadrasPct}%` }}
                    className="box-border h-[7px] absolute left-0 top-0 bg-[#2563EB] rounded-[7px] transition-all"
                  />
                </div>
                <div
                  data-pencil-name="Sub Tile Quadras"
                  className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  {quadrasDisponiveis} {quadrasDisponiveis === 1 ? 'quadra disponível' : 'quadras disponíveis'}
                </div>
              </div>
            </div>

            {/* Tile Uso Equipe */}
            <div
              data-pencil-name="Tile Uso Equipe"
              className="box-border w-full flex-1 flex flex-row gap-[12px] p-[12px] justify-start items-center bg-[#FBFAF7] rounded-[14px]"
            >
              <div
                data-pencil-name="Ícone Tile Equipe"
                className="box-border w-[40px] shrink-0 h-[40px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[13px]"
              >
                <Users size={18} className="text-[#16A34A]" />
              </div>
              <div
                data-pencil-name="Texto Tile Equipe"
                className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
              >
                <div
                  data-pencil-name="Topo Tile Equipe"
                  className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
                >
                  <div
                    data-pencil-name="Label Tile Equipe"
                    className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Equipe
                  </div>
                  <div
                    data-pencil-name="Valor Tile Equipe"
                    className="text-[13px]/[normal] box-border text-[#16A34A] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {usuariosUsados}/{maxUsuarios}
                  </div>
                </div>
                <div
                  data-pencil-name="Barra Tile Equipe"
                  className="box-border w-full h-[7px] shrink-0 bg-[#F1EDE6] rounded-[7px] relative overflow-hidden"
                >
                  <div
                    data-pencil-name="Preenchimento Tile Equipe"
                    style={{ width: `${usuariosPct}%` }}
                    className="box-border h-[7px] absolute left-0 top-0 bg-[#16A34A] rounded-[7px] transition-all"
                  />
                </div>
                <div
                  data-pencil-name="Sub Tile Equipe"
                  className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  {usuariosDisponiveis} {usuariosDisponiveis === 1 ? 'acesso livre' : 'acessos livres'}
                </div>
              </div>
            </div>

            {/* Tile Uso Portal */}
            <div
              data-pencil-name="Tile Uso Portal"
              className="box-border w-full flex-1 flex flex-row gap-[12px] p-[12px] justify-start items-center bg-[#FBFAF7] rounded-[14px]"
            >
              <div
                data-pencil-name="Ícone Tile Portal"
                className="box-border w-[40px] shrink-0 h-[40px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[13px]"
              >
                <Globe size={18} className="text-[#A85B00]" />
              </div>
              <div
                data-pencil-name="Texto Tile Portal"
                className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
              >
                <div
                  data-pencil-name="Topo Tile Portal"
                  className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
                >
                  <div
                    data-pencil-name="Label Tile Portal"
                    className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Portal
                  </div>
                  <div
                    data-pencil-name="Valor Tile Portal"
                    className="text-[13px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Ativo
                  </div>
                </div>
                <div
                  data-pencil-name="Barra Tile Portal"
                  className="box-border w-full h-[7px] shrink-0 bg-[#F1EDE6] rounded-[7px] relative overflow-hidden"
                >
                  <div
                    data-pencil-name="Preenchimento Tile Portal"
                    className="box-border w-full h-[7px] absolute left-0 top-0 bg-[#A85B00] rounded-[7px]"
                  />
                </div>
                <div
                  data-pencil-name="Sub Tile Portal"
                  className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Liberado no trial
                </div>
              </div>
            </div>
          </div>

          {/* Linha do tempo de cobrança */}
          <div
            data-pencil-name="Linha do tempo de cobrança"
            className="box-border flex-1 h-full flex flex-col gap-[14px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px] shadow-sm min-w-0"
          >
            <div
              data-pencil-name="Header Timeline Premium"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
            >
              <div
                data-pencil-name="Título Timeline Premium"
                className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Próxima cobrança
              </div>
              <div
                data-pencil-name="Tag Timeline Premium"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[9px] py-[4px] justify-start items-center bg-[#EEF3FF] rounded-[12px]"
              >
                <div
                  data-pencil-name="Texto Tag Timeline"
                  className="text-[11px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {diasRestantes} dias
                </div>
              </div>
            </div>

            {/* Cobrança Destaque */}
            <div
              data-pencil-name="Cobrança Destaque"
              onClick={handleAdiantarMensalidade}
              className="box-border w-full min-h-[72px] shrink-0 flex flex-row gap-[14px] p-[14px] justify-start items-center bg-[#071915] rounded-[16px] cursor-pointer hover:bg-[#122822] transition-colors"
            >
              <div
                data-pencil-name="Data Cobrança Destaque"
                className="box-border w-[54px] shrink-0 h-[54px] flex flex-col gap-0 justify-center items-center bg-[#C9FF3B] rounded-[14px] select-none"
              >
                <div
                  data-pencil-name="Dia Cobrança"
                  className="text-[21px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-center whitespace-nowrap leading-none"
                >
                  {proximaData?.dia || '—'}
                </div>
                <div
                  data-pencil-name="Mês Cobrança"
                  className="text-[9px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-center whitespace-nowrap leading-none mt-0.5"
                >
                  {proximaData?.mes || '—'}
                </div>
              </div>
              <div
                data-pencil-name="Texto Cobrança Destaque"
                className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
              >
                <div
                  data-pencil-name="Título Cobrança Destaque"
                  className="text-[16px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
                >
                  {isTrial ? 'Primeira mensalidade' : 'Mensalidade regular'}
                </div>
                <div
                  data-pencil-name="Sub Cobrança Destaque"
                  className="text-[12px]/[normal] box-border text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap truncate"
                >
                  {valorFaturaAtual !== undefined ? `${formatCurrency(valorFaturaAtual)} em aberto` : 'Nenhuma fatura em aberto'}
                </div>
              </div>
              <ArrowRight size={18} className="text-[#C9FF3B] shrink-0" />
            </div>

            {/* Fluxo Pós Trial */}
            <div
              data-pencil-name="Fluxo Pós Trial"
              className="box-border w-full flex-1 flex flex-col gap-[7px] justify-start items-start pt-1"
            >
              <div
                data-pencil-name="Título Depois Trial Compacto"
                className="text-[14px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                O que acontece depois do trial
              </div>
              <div
                data-pencil-name="Bullet Pós Trial Assinando até 11/10, nada é interrompido."
                className="box-border w-full h-[28px] shrink-0 flex flex-row gap-[9px] px-[8px] justify-start items-center bg-[#FBFAF7] rounded-[10px]"
              >
                <div
                  data-pencil-name="Ícone Bullet Pós Trial Assinando até 11/10, nada é interrompido."
                  className="box-border w-[22px] shrink-0 h-[22px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[8px]"
                >
                  <Check size={12} className="text-[#138A4B]" />
                </div>
                <div
                  data-pencil-name="Texto Bullet Pós Trial Assinando até 11/10, nada é interrompido."
                  className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
                >
                  {proximaData ? `Assinando até ${proximaData.formatada}, nada é interrompido.` : 'Consulte as faturas para verificar o próximo vencimento.'}
                </div>
              </div>

              <div
                data-pencil-name="Bullet Pós Trial Sem pagamento, portal e automações podem pausar."
                className="box-border w-full h-[28px] shrink-0 flex flex-row gap-[9px] px-[8px] justify-start items-center bg-[#FBFAF7] rounded-[10px]"
              >
                <div
                  data-pencil-name="Ícone Bullet Pós Trial Sem pagamento, portal e automações podem pausar."
                  className="box-border w-[22px] shrink-0 h-[22px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[8px]"
                >
                  <AlertTriangle size={12} className="text-[#A85B00]" />
                </div>
                <div
                  data-pencil-name="Texto Bullet Pós Trial Sem pagamento, portal e automações podem pausar."
                  className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
                >
                  Sem pagamento, portal e automações podem pausar.
                </div>
              </div>

              <div
                data-pencil-name="Bullet Pós Trial Você pode trocar o plano antes da cobrança."
                className="box-border w-full h-[28px] shrink-0 flex flex-row gap-[9px] px-[8px] justify-start items-center bg-[#FBFAF7] rounded-[10px]"
              >
                <div
                  data-pencil-name="Ícone Bullet Pós Trial Você pode trocar o plano antes da cobrança."
                  className="box-border w-[22px] shrink-0 h-[22px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[8px]"
                >
                  <Repeat2 size={12} className="text-[#2563EB]" />
                </div>
                <div
                  data-pencil-name="Texto Bullet Pós Trial Você pode trocar o plano antes da cobrança."
                  className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
                >
                  Você pode trocar o plano antes da cobrança.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Faturas e Pagamentos Autêntico */}
        <div
          data-pencil-name="Faturas e Pagamentos Autêntico"
          className="box-border w-full flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[20px] overflow-hidden shadow-sm"
        >
          {/* Header Faturas Premium */}
          <div
            data-pencil-name="Header Faturas Premium"
            className="box-border w-full h-[57.5px] shrink-0 flex flex-row gap-0 px-[22px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
          >
            <div
              data-pencil-name="Título Faturas Premium"
              className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              Faturas
            </div>
            <button
              data-pencil-name="Pagar Antecipado Premium"
              type="button"
              disabled={adiantandoMensalidade}
              onClick={handleAdiantarMensalidade}
              className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[8px] px-[12px] justify-start items-center bg-[#ECFFF4] outline outline-1 outline-[#B8F0D0] -outline-offset-1 rounded-[10px] hover:bg-[#d8fced] transition-colors cursor-pointer"
            >
              <Zap size={14} className="text-[#138A4B] fill-[#138A4B]" />
              <div
                data-pencil-name="Texto Pagar Premium"
                className="text-[12px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Pagar antecipado
              </div>
            </button>
          </div>

          {/* Resumo Faturas Compacto */}
          <div
            data-pencil-name="Resumo Faturas Compacto"
            className="box-border w-full flex flex-col lg:flex-row gap-[16px] p-[18px] justify-start items-stretch"
          >
            {/* Fatura Atual Compacta */}
            <div
              data-pencil-name="Fatura Atual Compacta"
              className="box-border w-full lg:w-[340px] shrink-0 flex flex-col gap-[8px] p-[16px] justify-start items-start bg-[#071915] rounded-[16px] text-white shadow-md"
            >
              <div
                data-pencil-name="Topo Fatura Atual Compacta"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center"
              >
                <div
                  data-pencil-name="Label Fatura Atual Compacta"
                  className="text-[10px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
                >
                  FATURA ATUAL
                </div>
                <div
                  data-pencil-name="Status Fatura Atual Compacta"
                  className="text-[11px]/[normal] box-border text-[#C9FF3B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {faturaPendente ? (faturaPendente.status === 'Atrasada' ? 'Atrasada' : 'Em aberto') : 'Sem pendências'}
                </div>
              </div>
              <div
                data-pencil-name="Valor Fatura Atual Compacta"
                className="text-[30px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none mt-1"
              >
                {valorFaturaAtual !== undefined ? formatCurrency(valorFaturaAtual) : '—'}
              </div>
              <div
                data-pencil-name="Vencimento Fatura Atual Compacta"
                className="text-[12px]/[normal] box-border text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {faturaPendente
                  ? `Vencimento: ${formatarDataBR(faturaPendente.data_vencimento)} · Plano ${faturaPendente.plano_nome}`
                  : 'Nenhuma fatura em aberto'}
              </div>

              {/* Botão de Pagamento na Fatura Atual */}
              <button
                type="button"
                onClick={() => faturaPendente ? handlePagarPix(faturaPendente) : handleAdiantarMensalidade()}
                disabled={adiantandoMensalidade || gerandoPix}
                className="mt-3 w-full h-[36px] bg-[#C9FF3B] hover:bg-[#b8f028] text-[#071915] font-bold text-xs rounded-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
              >
                <Zap size={14} className="fill-[#071915]" />
                {faturaPendente ? 'Pagar Fatura com Pix' : 'Adiantar Mensalidade com Pix'}
              </button>
            </div>

            {/* Histórico Recente Compacto */}
            <div
              data-pencil-name="Histórico Recente Compacto"
              className="box-border flex-1 flex flex-col gap-[10px] p-[16px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
            >
              <div
                data-pencil-name="Header Histórico Compacto"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center pb-1 border-b border-[#F0EBE4]"
              >
                <div
                  data-pencil-name="Título Histórico Compacto"
                  className="text-[15px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Histórico recente
                </div>
                <button
                  data-pencil-name="Link Histórico Compacto"
                  type="button"
                  onClick={() => setModalTodasFaturasOpen(true)}
                  className="text-[12px]/[normal] box-border text-[#138A4B] hover:text-[#0e6336] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap cursor-pointer transition-colors"
                >
                  Ver tudo ({faturas.length})
                </button>
              </div>

              {/* Lista de Faturas Recentes */}
              <div className="w-full flex flex-col gap-1 overflow-y-auto max-h-[160px]">
                {faturas.length === 0 ? (
                  <p className="py-4 text-sm text-[#6F766F]">Nenhuma fatura emitida.</p>
                ) : (
                  faturas.slice(0, 4).map((fat) => {
                    const isPaga = fat.status === 'Paga';
                    const isAtrasada = fat.status === 'Atrasada';

                    return (
                      <div
                        key={fat.id}
                        className="box-border w-full min-h-[35.5px] shrink-0 flex flex-row gap-[12px] py-[6px] justify-between items-center border-b border-[#F0EBE4] hover:bg-[#F1EDE6]/50 px-1 rounded-md transition-colors"
                      >
                        <div title={fat.competencia} className="text-[12px]/[normal] text-[#071915] font-bold truncate max-w-[160px]">
                          {fat.competencia || fat.descricao || formatarDataBR(fat.data_vencimento)}
                        </div>
                        <div className="text-[12px]/[normal] text-[#071915] font-medium whitespace-nowrap">
                          {formatCurrency(fat.valor)}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`box-border w-fit shrink-0 h-[22px] flex flex-row gap-0 px-[8px] justify-center items-center rounded-[12px] ${
                              isPaga
                                ? 'bg-[#EAF8EF] text-[#138A4B]'
                                : isAtrasada
                                ? 'bg-red-50 text-red-600'
                                : 'bg-[#FFF3D9] text-[#A85B00]'
                            }`}
                          >
                            <span className="text-[10px]/[normal] font-bold whitespace-nowrap">
                              {fat.status}
                            </span>
                          </div>

                          {isPaga ? (
                            <button
                              type="button"
                              onClick={() => handleVisualizarRecibo(fat.id)}
                              className="text-[11px] font-bold text-[#138A4B] hover:underline flex items-center gap-0.5"
                              title="Ver Recibo"
                            >
                              <FileText size={12} /> Recibo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePagarPix(fat)}
                              className="text-[11px] font-bold text-[#2563EB] hover:underline flex items-center gap-0.5"
                              title="Pagar com Pix"
                            >
                              <Zap size={12} /> Pagar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: PAGAMENTO VIA PIX ONLINE                                          */}
      {/* ========================================================================= */}
      {modalPixOpen && faturaSelecionada &&
        createPortal(
          <div
            data-pencil-name="Overlay Pix Assinatura"
            className="fixed inset-0 bg-[#07191599] backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalPixOpen(false);
            }}
          >
          <div
            data-pencil-name="Modal Pix Assinatura"
            className="box-border w-full max-w-[520px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[24px] p-6 shadow-2xl flex flex-col gap-4 text-center animate-scale-in"
          >
            {/* Header Modal Pix */}
            <div className="flex items-center justify-between w-full border-b border-[#F0EBE4] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ECFFF4] text-[#138A4B] flex items-center justify-center font-bold">
                  <Zap size={16} className="fill-[#138A4B]" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-[#071915] leading-tight">
                    Pagamento via Pix Online
                  </h3>
                  <p className="text-[11px] text-[#6F766F]">Liberação automática e instantânea</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPixOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F7F2EA] hover:bg-[#EBE4D8] text-[#6F766F] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Conteúdo do Pix */}
            {gerandoPix ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#2563EB]">
                <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold">Gerando QR Code Pix com o Mercado Pago...</p>
              </div>
            ) : pixPagoComSucesso ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#EAF8EF] text-[#138A4B] flex items-center justify-center text-3xl font-extrabold animate-bounce">
                  ✓
                </div>
                <h4 className="text-lg font-bold text-[#138A4B]">Pagamento Confirmado!</h4>
                <p className="text-xs text-[#6F766F] max-w-xs">
                  Sua mensalidade foi liquidada e o acesso total da sua arena foi atualizado.
                </p>
                <button
                  type="button"
                  onClick={() => setModalPixOpen(false)}
                  className="mt-3 px-6 py-2.5 rounded-xl bg-[#071915] text-[#FFFFFF] font-bold text-xs hover:bg-[#122822] transition-colors"
                >
                  Concluir
                </button>
              </div>
            ) : pixExpirado ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl">
                  ⏰
                </div>
                <h4 className="text-base font-bold text-red-700">Cobrança Pix Expirada</h4>
                <p className="text-xs text-[#6F766F] max-w-xs">
                  O prazo limite deste código encerrou. Clique abaixo para gerar uma nova cobrança.
                </p>
                <button
                  type="button"
                  disabled={gerandoPix}
                  onClick={() => faturaSelecionada && handlePagarPix(faturaSelecionada)}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-[#071915] text-[#FFFFFF] font-bold text-xs hover:bg-[#122822] transition-colors"
                >
                  {gerandoPix ? 'Gerando...' : 'Gerar Novo Pix'}
                </button>
              </div>
            ) : pixData ? (
              <div className="flex flex-col items-center gap-3">
                {/* QR Code Container */}
                <div className="p-3 bg-[#FBFAF7] outline outline-1 outline-[#E6DED2] rounded-2xl flex items-center justify-center shadow-inner">
                  {pixData.qr_code ? (
                    <img src={pixData.qr_code} alt="QR Code Pix" className="w-44 h-44 rounded-lg block" />
                  ) : (
                    <div className="w-44 h-44 bg-white flex items-center justify-center rounded-lg p-2">
                      <QRCode
                        value={pixData.copia_cola}
                        size={160}
                        style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                        viewBox="0 0 160 160"
                      />
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-[22px] font-bold text-[#071915]">
                    {formatCurrency(faturaSelecionada.valor)}
                  </div>
                  <p className="text-xs text-[#6F766F] mt-0.5">
                    Fatura #{faturaSelecionada.id} · {faturaSelecionada.plano_nome}
                  </p>
                </div>

                {/* Chave Copia e Cola */}
                <div className="w-full flex flex-col gap-1.5 text-left">
                  <label className="text-[11px] font-bold text-[#6F766F] uppercase tracking-wide">
                    Pix Copia e Cola:
                  </label>
                  <div className="flex items-center gap-2 bg-[#FBFAF7] border border-[#E6DED2] rounded-xl p-1.5 pl-3">
                    <input
                      type="text"
                      readOnly
                      value={pixData.copia_cola}
                      className="w-full bg-transparent text-xs font-mono text-[#071915] outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopiarPix}
                      className="px-3 py-1.5 rounded-lg bg-[#071915] text-[#FFFFFF] text-xs font-bold hover:bg-[#122822] transition-colors flex items-center gap-1 shrink-0"
                    >
                      {pixCopiado ? <CheckCheck size={14} className="text-[#C9FF3B]" /> : <Copy size={14} />}
                      {pixCopiado ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Status em tempo real */}
                <div className="w-full p-2.5 rounded-xl bg-[#ECFFF4] border border-[#B8F0D0] text-[11px] text-[#007A50] font-medium flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#188A45] animate-ping" />
                  Aguardando confirmação do pagamento em tempo real...
                </div>

                {/* Botões de Ação para Desenvolvedor / Simulação */}
                <div className="flex gap-2 w-full pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const refToUse = pixData.gateway_ref || faturaSelecionada?.id;
                        const res = await fetch(`/api/tenant/assinatura/status-pagamento/${refToUse}`);
                        const json = await res.json();
                        if (json.pago) {
                          setPixPagoComSucesso(true);
                          showToast('🎉 Pagamento confirmado com sucesso!', 'success');
                          carregarDados();
                        } else {
                          showToast('Pagamento ainda não detectado.', 'info');
                        }
                      } catch {
                        showToast('Erro ao consultar status.', 'error');
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#FFFFFF] border border-[#DED6CA] text-xs font-semibold text-[#071915] hover:bg-[#F7F2EA] transition-colors"
                  >
                    Verificar Agora
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!faturaSelecionada) return;
                      try {
                        const res = await fetch(
                          `/api/tenant/assinatura/faturas/${faturaSelecionada.id}/simular-pagamento`,
                          { method: 'POST' }
                        );
                        if (res.ok) {
                          setPixPagoComSucesso(true);
                          showToast('🎉 Pagamento de teste simulado com sucesso!', 'success');
                          carregarDados();
                        } else {
                          showToast('Erro ao simular.', 'error');
                        }
                      } catch {
                        showToast('Erro de conexão.', 'error');
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#071915] text-[#C9FF3B] text-xs font-bold hover:bg-[#122822] transition-colors"
                  >
                    🧪 Simular Aprovação
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: TROCAR PLANO / UPGRADE (PENPOT REF DESIGN)                         */}
      {/* ========================================================================= */}
      {modalPlanosOpen &&
        createPortal(
          <div
            data-pencil-name="Overlay Trocar Plano"
            className="fixed inset-0 bg-[#07191599] backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalPlanosOpen(false);
            }}
          >
            <div
              data-pencil-name="Modal Trocar Plano"
              className={`box-border w-full ${confirmacaoPlano ? 'max-w-[520px]' : 'max-w-[880px]'} my-auto bg-[#FFFFFF] rounded-[24px] overflow-hidden shadow-2xl flex flex-col gap-3 justify-start items-start animate-scale-in max-h-[85vh] transition-[max-width] duration-200`}
            >
              {/* Hero Modal Planos */}
              <div
                data-pencil-name="Hero Modal Planos"
                className={confirmacaoPlano ? 'hidden' : 'box-border w-full shrink-0 flex flex-row gap-4 p-[20px_28px] justify-between items-center bg-[#071915]'}
              >
                <div
                  data-pencil-name="Texto Hero Modal Planos"
                  className="box-border flex-1 min-w-0 h-fit flex flex-col gap-2 justify-start items-start"
                >
                  <div
                    data-pencil-name="Badge Upgrade Modal"
                    className="box-border w-fit h-fit shrink-0 flex flex-row gap-[7px] px-[10px] py-[5px] justify-start items-center bg-[#C9FF3B] rounded-[14px]"
                  >
                    <Sparkles size={14} className="text-[#071915]" />
                    <div
                      data-pencil-name="Texto Badge Upgrade Modal"
                      className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left whitespace-nowrap"
                    >
                      ATIVAÇÃO APÓS PAGAMENTO
                    </div>
                  </div>
                  <div
                    data-pencil-name="Título Hero Modal Planos"
                    className="text-[20px] sm:text-[22px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left"
                  >
                    Escolha o plano ideal para sua arena
                  </div>
                  <div
                    data-pencil-name="Sub Hero Modal Planos"
                    className="text-[13px]/[normal] box-border w-full text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left"
                  >
                    Compare os planos e seus limites. A mudança entra em vigor somente após a confirmação do pagamento.
                  </div>
                </div>
                <button
                  type="button"
                  data-pencil-name="Fechar Modal Planos Refinado"
                  onClick={() => setModalPlanosOpen(false)}
                  className="box-border w-[38px] shrink-0 h-[38px] flex flex-row gap-0 justify-center items-center bg-[#FFFFFF1A] hover:bg-[#FFFFFF33] text-[#FFFFFF] rounded-[19px] transition-colors cursor-pointer border-0"
                >
                  <X size={19} className="text-white" />
                </button>
              </div>

              {/* Controles Modal Planos */}
              <div
                data-pencil-name="Controles Modal Planos"
                className={confirmacaoPlano ? 'hidden' : 'box-border w-full min-h-[44px] shrink-0 flex flex-row gap-2 px-[28px] justify-between items-center'}
              >
                <div
                  data-pencil-name="Texto Escolha Periodicidade"
                  className="text-[13px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Compare os planos disponíveis para sua operação
                </div>
                <div
                  data-pencil-name="Toggle Planos Refinado"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-[4px] p-[4px] justify-start items-center bg-[#F1EDE6] rounded-[14px]"
                >
                  <button
                    type="button"
                    data-pencil-name="Toggle Mensal"
                    onClick={() => setCicloSelecionado('mensal')}
                    className={`box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[14px] justify-start items-center rounded-[10px] cursor-pointer transition-all border-0 ${
                      cicloSelecionado === 'mensal'
                        ? 'bg-[#071915]'
                        : 'bg-transparent'
                    }`}
                  >
                    <div
                      data-pencil-name="Texto Toggle Mensal"
                      className={`text-[13px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                        cicloSelecionado === 'mensal' ? 'text-[#FFFFFF]' : 'text-[#6F766F]'
                      }`}
                    >
                      Mensal
                    </div>
                  </button>
                  <button
                    type="button"
                    data-pencil-name="Toggle Anual"
                    onClick={() => setCicloSelecionado('anual')}
                    className={`box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[14px] justify-start items-center rounded-[10px] cursor-pointer transition-all border-0 ${
                      cicloSelecionado === 'anual'
                        ? 'bg-[#071915]'
                        : 'bg-transparent'
                    }`}
                  >
                    <div
                      data-pencil-name="Texto Toggle Anual"
                      className={`text-[13px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                        cicloSelecionado === 'anual' ? 'text-[#FFFFFF]' : 'text-[#6F766F]'
                      }`}
                    >
                      Anual
                    </div>
                    <div
                      data-pencil-name="Desconto Toggle Anual"
                      className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#C9FF3B] rounded-[8px]"
                    >
                      <div
                        data-pencil-name="Texto Desconto Toggle Anual"
                        className="text-[10px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        12 meses
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Planos Refinados */}
              <div
                data-pencil-name="Planos Refinados"
                className={confirmacaoPlano ? 'hidden' : 'box-border w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-none md:grid-flow-col md:auto-cols-[minmax(0,1fr)] gap-4 px-[28px] pb-3 items-stretch overflow-y-auto'}
              >
                {loadingPlanos ? (
                  <div className="w-full py-20 text-center text-xs text-[#6F766F] font-medium">
                    Carregando planos disponíveis...
                  </div>
                ) : erroPlanos ? (
                  <div role="alert" className="w-full py-12 text-center">
                    <p>{erroPlanos}</p>
                    <button type="button" onClick={abrirModalPlanos} className="mt-4 px-5 py-3 rounded-xl bg-[#071915] text-white">Tentar novamente</button>
                  </div>
                ) : (
                  [...planosDisponiveis]
                    .sort((a, b) => {
                      const priceA = a.valor_mensal === 0 ? 999999 : a.valor_mensal;
                      const priceB = b.valor_mensal === 0 ? 999999 : b.valor_mensal;
                      return priceA - priceB;
                    })
                    .map((p) => {
                  const isCurrent = dados?.plano?.id === p.id && (dados.ciclo_cobranca || 'mensal') === cicloSelecionado;
                  const isEnterprise = p.valor_mensal === 0 || p.nome.toLowerCase().includes('enterprise');
                  const isPro = p.nome.toLowerCase().includes('pro');
                  const valor = cicloSelecionado === 'anual' ? p.valor_anual : p.valor_mensal;

                  // Tagline based on Penpot design
                  const tagline = isEnterprise
                    ? 'Para redes e operações grandes'
                    : isPro
                    ? 'Para arenas em crescimento'
                    : 'Para começar';

                  // Badge based on Penpot design
                  const badge = isCurrent ? (
                    <div className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[9px] py-[5px] justify-start items-center bg-[#F1EDE6] rounded-[12px]">
                      <div className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                        Atual
                      </div>
                    </div>
                  ) : isPro ? (
                    <div className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[9px] py-[5px] justify-start items-center bg-[#2563EB] rounded-[12px]">
                      <div className="text-[10px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                        Recomendado
                      </div>
                    </div>
                  ) : isEnterprise ? (
                    <div className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[9px] py-[5px] justify-start items-center bg-[#ECFFF4] rounded-[12px]">
                      <div className="text-[10px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                        Sob consulta
                      </div>
                    </div>
                  ) : null;

                  // Features list per Penpot design
                  const features = isEnterprise
                    ? [
                        `Até ${p.max_quadras} quadras`,
                        `Até ${p.max_usuarios} usuários`,
                        'SLA e suporte VIP',
                        'Relatórios personalizados',
                        'Onboarding dedicado',
                      ]
                    : isPro
                    ? [
                        `Até ${p.max_quadras} quadras`,
                        `Até ${p.max_usuarios} usuários`,
                        'BI e exportação',
                        'Auditoria completa',
                        'Suporte prioritário',
                      ]
                    : [
                        `Até ${p.max_quadras} quadras`,
                        `Até ${p.max_usuarios} usuários`,
                        'Portal do atleta',
                        'Gestão de pagamentos',
                      ];

                  return (
                    <div
                      key={p.id}
                      data-pencil-name={`Plano Refinado ${p.nome}`}
                      className={`box-border min-w-0 h-full flex flex-col gap-[12px] p-4 justify-between items-start rounded-[22px] transition-all ${
                        isPro && !isCurrent
                          ? 'bg-[#F3F8FF] outline outline-2 outline-[#2563EB] -outline-offset-1 shadow-md'
                          : 'bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1'
                      }`}
                    >
                      <div className="w-full flex flex-col gap-[12px]">
                        {/* Topo Plano */}
                        <div className="box-border w-full h-fit shrink-0 flex flex-row gap-2 justify-between items-start">
                          <div className="box-border min-w-0 flex-1 h-fit flex flex-col gap-[4px] justify-start items-start">
                            <div className="text-[20px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left break-words">
                              {p.nome}
                            </div>
                            <div className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left">
                              {tagline}
                            </div>
                          </div>
                          {badge}
                        </div>

                        {/* Preço */}
                        <div className="box-border w-full h-fit shrink-0 flex flex-col gap-[5px] justify-start items-start">
                          {isEnterprise ? (
                            <>
                              <div className="text-[24px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left">
                                Sob consulta
                              </div>
                              <div className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                                Contrato personalizado
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] justify-start items-end">
                                <div className="text-[26px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                                  {formatCurrency(valor)}
                                </div>
                                <div className="text-[13px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap pb-1">
                                  /mês
                                </div>
                              </div>
                              <div
                                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                  cicloSelecionado === 'anual' ? 'text-[#138A4B]' : 'text-[#6F766F]'
                                }`}
                              >
                                {cicloSelecionado === 'anual'
                                  ? `Faturado anualmente · R$ ${(valor * 12).toFixed(2).replace('.', ',')}/ano`
                                  : 'Faturamento mensal'}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Divisor */}
                        <div className="box-border w-full h-[1px] shrink-0 bg-[#E6DED2]"></div>

                        {/* Lista Recursos */}
                        <div className="box-border w-full flex-1 flex flex-col gap-[11px] justify-start items-start pt-1">
                          {features.map((feature, fIdx) => (
                            <div
                              key={fIdx}
                              className="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] justify-start items-center"
                            >
                              <Check size={14} className="text-[#16A34A] shrink-0" />
                              <div className="text-[12px]/[normal] box-border min-w-0 text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left">
                                {feature}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botão Ação */}
                      <div className="w-full pt-4">
                        {isCurrent ? (
                          <div
                            data-pencil-name="Botão Refinado Atual"
                            className="box-border w-full h-[40px] shrink-0 flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[12px]"
                          >
                            <div className="text-[13px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                              Plano atual
                            </div>
                          </div>
                        ) : isEnterprise ? (
                          <a
                            data-pencil-name="Botão Refinado Enterprise"
                            href={enterpriseContactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="box-border w-full h-[40px] shrink-0 flex flex-row gap-0 justify-center items-center bg-[#071915] hover:bg-[#122822] rounded-[12px] no-underline transition-colors"
                          >
                            <div className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                              Falar com consultor
                            </div>
                          </a>
                        ) : (
                          <button
                            type="button"
                            data-pencil-name={`Botão Refinado ${p.nome}`}
                            disabled={solicitandoUpgradeId !== null || valor <= 0}
                            onClick={() => setConfirmacaoPlano({ plano: p, ciclo: cicloSelecionado, totalCentavos: Math.round(valor * 100) * (cicloSelecionado === 'anual' ? 12 : 1) })}
                            className={`box-border w-full h-[40px] shrink-0 flex flex-row gap-0 justify-center items-center rounded-[12px] cursor-pointer transition-colors shadow-sm disabled:opacity-50 border-0 ${
                              isPro
                                ? 'bg-[#2563EB] hover:bg-[#1d4ed8] text-[#FFFFFF]'
                                : 'bg-[#C9FF3B] hover:bg-[#b8f028] text-[#071915]'
                            }`}
                          >
                            <div className="text-[13px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                              {valor <= 0 ? 'Ciclo indisponível' : 'Selecionar plano'}
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {confirmacaoPlano && (
              <section aria-label="Confirmar troca de plano" className="w-full px-6 pt-6 pb-3 flex flex-col gap-4 overflow-y-auto text-[#071915]">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE4]">
                  <h3 className="text-base font-bold">Confirmar troca de plano</h3>
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={() => setModalPlanosOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F7F2EA] hover:bg-[#EBE4D8] text-[#6F766F] transition-colors border-0 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#F0EBE4] flex flex-col gap-1.5 text-xs">
                  <p className="text-[#6F766F]">Plano atual: {dados?.plano.nome} ({dados?.ciclo_cobranca || 'mensal'}).</p>
                  <p className="font-semibold">Plano escolhido: {confirmacaoPlano.plano.nome} · Ciclo {confirmacaoPlano.ciclo}.</p>
                  <p className="pt-2 mt-1 border-t border-[#F0EBE4] text-lg font-bold">Total: {formatCurrency(confirmacaoPlano.totalCentavos / 100)}</p>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px] text-[#6F766F] leading-relaxed">
                  <p>Cobrança integral de {confirmacaoPlano.ciclo === 'anual' ? '12 meses' : '1 mês'}. A vigência e os novos limites começam após a confirmação do pagamento.</p>
                  <p>O novo ciclo substitui o período anterior, sem desconto proporcional ou crédito automático pelo período já pago.</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" disabled={solicitandoUpgradeId !== null} onClick={() => setConfirmacaoPlano(null)} className="px-4 py-2 rounded-xl bg-[#FFFFFF] border border-[#DED6CA] text-xs font-semibold text-[#071915] hover:bg-[#F7F2EA] transition-colors disabled:opacity-50">Voltar</button>
                  <button type="button" disabled={solicitandoUpgradeId !== null} onClick={handleSolicitarUpgrade} className="px-4 py-2 rounded-xl bg-[#071915] text-white text-xs font-bold hover:bg-[#122822] transition-colors disabled:opacity-50">{solicitandoUpgradeId !== null ? 'Processando...' : 'Confirmar e gerar Pix'}</button>
                </div>
              </section>
            )}

            {/* Footer Modal Planos Refinado */}
            <div
              data-pencil-name="Footer Modal Planos Refinado"
              className="box-border w-full min-h-[46px] py-3 shrink-0 flex flex-row gap-[10px] px-[28px] justify-start items-center bg-[#FBFAF7] border-t border-[#F0EBE4]"
            >
              <ShieldCheck size={16} className="text-[#138A4B] shrink-0" />
              <div
                data-pencil-name="Texto Footer Modal Planos"
                className="text-[12px]/[normal] box-border text-[#536174] font-[Inter,system-ui,sans-serif] font-normal text-left"
              >
                Sem fidelidade. O upgrade é liberado após confirmação do Pix ou pagamento aprovado.
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: TODAS AS FATURAS                                                  */}
      {/* ========================================================================= */}
      {modalTodasFaturasOpen &&
        createPortal(
          <div
            data-pencil-name="Overlay Todas as Faturas"
            className="fixed inset-0 bg-[#07191599] backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalTodasFaturasOpen(false);
            }}
          >
          <div
            data-pencil-name="Modal Todas as Faturas"
            className="box-border w-full max-w-[720px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[24px] p-6 shadow-2xl flex flex-col gap-4 animate-scale-in max-h-[85vh] overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE4]">
              <div>
                <h3 className="text-lg font-bold text-[#071915]">Todas as Faturas</h3>
                <p className="text-xs text-[#6F766F]">Histórico de faturas geradas para a sua arena.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalTodasFaturasOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F7F2EA] hover:bg-[#EBE4D8] text-[#6F766F] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FBFAF7] border-b border-[#F0EBE4] text-[10px] font-bold text-[#6F766F] uppercase">
                    <th className="py-2.5 px-3">Fatura</th>
                    <th className="py-2.5 px-3">Competência</th>
                    <th className="py-2.5 px-3">Vencimento</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EFE8]">
                  {faturas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6F766F]">
                        Nenhuma fatura registrada.
                      </td>
                    </tr>
                  ) : (
                    faturas.map((f) => {
                      const isPaga = f.status === 'Paga';
                      return (
                        <tr key={f.id} className="hover:bg-[#FAF8F5]">
                          <td className="py-2.5 px-3 font-semibold text-[#071915]">#{f.id}</td>
                          <td className="py-2.5 px-3 text-[#6F766F]">{f.competencia || f.plano_nome}</td>
                          <td className="py-2.5 px-3 text-[#071915]">{formatarDataBR(f.data_vencimento)}</td>
                          <td className="py-2.5 px-3 font-bold text-[#071915]">{formatCurrency(f.valor)}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaga
                                  ? 'bg-[#EAF8EF] text-[#138A4B]'
                                  : f.status === 'Atrasada'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-[#FFF3D9] text-[#A85B00]'
                              }`}
                            >
                              {f.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isPaga ? (
                              <button
                                type="button"
                                onClick={() => handleVisualizarRecibo(f.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#FBFAF7] border border-[#DED6CA] text-[11px] font-bold text-[#071915] hover:bg-[#F1EDE6] transition-colors"
                              >
                                Recibo
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePagarPix(f)}
                                className="px-2.5 py-1 rounded-lg bg-[#071915] text-[#FFFFFF] text-[11px] font-bold hover:bg-[#122822] transition-colors"
                              >
                                Pagar Pix
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECIBO OFICIAL DE PAGAMENTO                                        */}
      {/* ========================================================================= */}
      {modalReciboOpen &&
        createPortal(
          <div
            data-pencil-name="Overlay Recibo"
            className="fixed inset-0 bg-[#07191599] backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalReciboOpen(false);
            }}
          >
          <div
            data-pencil-name="Modal Recibo"
            className="box-border w-full max-w-[520px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[24px] p-6 shadow-2xl flex flex-col gap-4 animate-scale-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE4]">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#138A4B]" />
                <h3 className="text-base font-bold text-[#071915]">Recibo de Pagamento</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalReciboOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F7F2EA] hover:bg-[#EBE4D8] text-[#6F766F] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {carregandoRecibo || !reciboSelecionado ? (
              <div className="py-12 text-center text-xs text-[#6F766F]">Carregando recibo...</div>
            ) : (
              <div className="flex flex-col gap-4 text-xs text-[#071915]">
                {/* Cabeçalho do Recibo */}
                <div className="p-4 bg-[#FBFAF7] rounded-xl border border-[#F0EBE4] flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-[#6F766F] uppercase font-bold">Número do Recibo</div>
                    <div className="text-sm font-bold">{reciboSelecionado.recibo_numero}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#6F766F] uppercase font-bold">Data de Emissão</div>
                    <div className="text-xs font-semibold">{formatarDataBR(reciboSelecionado.data_emissao)}</div>
                  </div>
                </div>

                {/* Dados da Fatura */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF8F5] rounded-xl border border-[#F0EBE4]">
                  <div>
                    <span className="text-[#6F766F] text-[11px] block">Plano Contratado</span>
                    <strong className="text-xs">{reciboSelecionado.plano.nome}</strong>
                  </div>
                  <div>
                    <span className="text-[#6F766F] text-[11px] block">Valor Liquidado</span>
                    <strong className="text-xs text-[#138A4B]">
                      {formatCurrency(reciboSelecionado.fatura.valor)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6F766F] text-[11px] block">Data do Pagamento</span>
                    <strong className="text-xs">
                      {formatarDataBR(reciboSelecionado.fatura.data_pagamento)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6F766F] text-[11px] block">Método</span>
                    <strong className="text-xs">{reciboSelecionado.fatura.metodo_pagamento || 'Não informado'}</strong>
                  </div>
                </div>

                {/* Arena e Emissor */}
                <p className="text-xs text-[#6F766F]">
                  Período: {formatarDataBR(reciboSelecionado.fatura.data_vencimento)} a {formatarDataBR(reciboSelecionado.fatura.periodo_fim)}
                </p>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#F0EBE4] flex flex-col gap-1 text-[11px]">
                  <div>
                    <span className="text-[#6F766F]">Sacado: </span>
                    <strong>{reciboSelecionado.arena.nome}</strong>
                  </div>
                  <div>
                    <span className="text-[#6F766F]">Emissor: </span>
                    <span>{reciboSelecionado.emissor.empresa || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-[#6F766F]">CNPJ: </span>
                    <span>{reciboSelecionado.emissor.cnpj || 'Não informado'}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-[#F0EBE4]">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-[#071915] text-[#FFFFFF] font-bold text-xs hover:bg-[#122822] transition-colors"
                  >
                    Imprimir Recibo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default AdminAssinatura;
