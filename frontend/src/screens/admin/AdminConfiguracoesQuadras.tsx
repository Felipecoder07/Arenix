import { CourtTimeSelect } from "../../components/CourtTimeSelect";
import { formatCourtPriceInput, parseCourtPrice } from "../../utils/courtPrice";
import { ToastLayer } from "../../components/ToastLayer";
import { TeamRecentActivity } from '../../components/TeamRecentActivity';
import { ArenaPortalButton } from '../../components/ArenaPortalButton';
import React, { useState, useEffect, useCallback } from "react";
import { apiFetch as fetch } from "../../utils/apiFetch";
import { getStoredUser, clearSession } from "../../utils/session";
import { AdminArenaConfiguracoes } from "./AdminArenaConfiguracoes";
import type { Announcement } from "../../types/api";
import {
  X,
  Check,
  UserPlus,
  User,
  Mail,
  ShieldCheck,
  ChevronDown,
  MailCheck,
  ArrowRightLeft,
  AlertTriangle,
  Link as LinkIcon,
  Plug,
  KeyRound,
  QrCode,
  CreditCard,
  Save,
  CheckCircle2,
  BellRing,
  CalendarX,
  ListChecks,
  UserX,
  GripVertical,
  CloudRain,
  Wrench,
  Pencil,
  Trash2,
  TrendingDown,
  Plus,
  Info,
} from "lucide-react";

interface UsuarioData {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  criado_em: string;
  ultimo_acesso?: string;
  ativo?: number;
}


interface PlanoInfo {
  plano: { nome: string; max_quadras: number; max_usuarios: number; valor_mensal: number };
  uso: { quadras_usadas: number; usuarios_usados: number };
}

interface ModalityItem {
  nome: string;
  preco?: number;
}

interface QuadraData {
  id: number;
  nome: string;
  tipo?: string;
  preco_base?: number;
  preco_hora?: number;
  hora_abertura?: string;
  hora_fechamento?: string;
  status?: string;
  ativa?: boolean;
  modalidades?: (string | ModalityItem)[];
}

const MODALITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "Beach Tennis": { bg: "bg-[#EAF8EF]", text: "text-[#138A4B]", dot: "bg-[#138A4B]" },
  "Vôlei de Praia": { bg: "bg-[#FFF3D9]", text: "text-[#A85B00]", dot: "bg-[#A85B00]" },
  "Futevôlei": { bg: "bg-[#EEF3FF]", text: "text-[#2563EB]", dot: "bg-[#2563EB]" },
  "Society": { bg: "bg-[#F1EDE6]", text: "text-[#394236]", dot: "bg-[#394236]" },
  "Funcional": { bg: "bg-[#F3E8FF]", text: "text-[#7C3AED]", dot: "bg-[#7C3AED]" },
  "Padel": { bg: "bg-[#ECFEFF]", text: "text-[#0891B2]", dot: "bg-[#0891B2]" },
  "Tênis": { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]" },
};

export interface MotivoCancelamento {
  id: number;
  motivo: string;
}

interface EstatisticasCancelamentos {
  mes: { total: number; valorTotal: number };
  ultimos30Dias: {
    total: number;
    porMotivo: { id: number | null; motivo: string; total: number }[];
  };
}

const normalizarMotivo = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const getMotivoVisual = (nome: string) => {
  const lower = (nome || "").toLowerCase();
  if (lower.includes("desistência") || lower.includes("desistencia") || lower.includes("cliente")) {
    return {
      bgIcon: "bg-[#E9F1FF]",
      colorIcon: "text-[#2457C5]",
      barColor: "bg-[#2457C5]",
      textColor: "text-[#2457C5]",
      Icon: UserX,
    };
  }
  if (lower.includes("clima") || lower.includes("climática") || lower.includes("climatica") || lower.includes("chuva") || lower.includes("tempo")) {
    return {
      bgIcon: "bg-[#EAF4FF]",
      colorIcon: "text-[#26709A]",
      barColor: "bg-[#26709A]",
      textColor: "text-[#26709A]",
      Icon: CloudRain,
    };
  }
  if (lower.includes("manuten") || lower.includes("quadra") || lower.includes("reforma")) {
    return {
      bgIcon: "bg-[#FFF3DB]",
      colorIcon: "text-[#A85A00]",
      barColor: "bg-[#A85A00]",
      textColor: "text-[#A85A00]",
      Icon: Wrench,
    };
  }
  if (lower.includes("pagamento") || lower.includes("cartão") || lower.includes("cartao") || lower.includes("pix") || lower.includes("financeiro")) {
    return {
      bgIcon: "bg-[#F5EAF8]",
      colorIcon: "text-[#8B4A9E]",
      barColor: "bg-[#8B4A9E]",
      textColor: "text-[#8B4A9E]",
      Icon: CreditCard,
    };
  }
  return {
    bgIcon: "bg-[#F0ECE6]",
    colorIcon: "text-[#4F5550]",
    barColor: "bg-[#6F766F]",
    textColor: "text-[#6F766F]",
    Icon: CalendarX,
  };
};

export function AdminConfiguracoesQuadras() {
  const user = getStoredUser();
  const canManageMotivos = user?.perfil === "Administrador";
  const userName = user?.nome || "fefe";

  const getInitialTab = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("aba") || params.get("tab");
      if (tab) return tab;
    }
    return "quadras";
  };
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("aba") || params.get("tab");
        if (tab) setActiveTab(tab);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("aba", tab);
        window.history.pushState({}, "", url.toString());
      } catch {
        /* silent */
      }
    }
  };

  const [quadras, setQuadras] = useState<QuadraData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Usuarios state
  const [usuarios, setUsuarios] = useState<UsuarioData[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: number; perfil: string } | null>(null);
  const [planoInfo, setPlanoInfo] = useState<PlanoInfo | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(true);

  // Resumo de horários calculado a partir das quadras reais
  const horarioResumo = (() => {
    const faixas = quadras
      .filter((q) => q.hora_abertura && q.hora_fechamento)
      .map((q) => ({
        abre: (q.hora_abertura as string).slice(0, 5),
        fecha: (q.hora_fechamento as string).slice(0, 5),
      }));
    if (faixas.length === 0) {
      return { valor: "—", nota: "Nenhuma quadra com horário definido" };
    }
    const distintas = new Set(faixas.map((f) => `${f.abre}–${f.fecha}`));
    if (distintas.size === 1) {
      return {
        valor: [...distintas][0],
        nota: faixas.length === 1 ? "Horário da quadra" : "Mesmo horário em todas as quadras",
      };
    }
    const abre = faixas.map((f) => f.abre).sort()[0];
    const fecha = faixas.map((f) => f.fecha).sort().slice(-1)[0];
    return { valor: `${abre}–${fecha}`, nota: `${distintas.size} horários diferentes entre quadras` };
  })();

  // Modal usuario
  const [modalUsuarioOpen, setModalUsuarioOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioData | null>(null);
  const [formUsuarioNome, setFormUsuarioNome] = useState("");
  const [formUsuarioEmail, setFormUsuarioEmail] = useState("");
  const [formUsuarioPerfil, setFormUsuarioPerfil] = useState("");

  // Modal transferir administração
  const [modalTransferirOpen, setModalTransferirOpen] = useState(false);
  const [novoAdminId, setNovoAdminId] = useState<number | "">("");
  const [transferindo, setTransferindo] = useState(false);
  const [transferPassword, setTransferPassword] = useState("");
  const [transferError, setTransferError] = useState("");

  // Modal para criar / editar quadra
  const [modalOpen, setModalOpen] = useState(false);
  const [salvandoQuadra, setSalvandoQuadra] = useState(false);
  const [editingQuadra, setEditingQuadra] = useState<QuadraData | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formTipoPiso, setFormTipoPiso] = useState("Areia");
  const [formHoraAbertura, setFormHoraAbertura] = useState("07:00");
  const [formHoraFechamento, setFormHoraFechamento] = useState("22:00");
  const [formModalidades, setFormModalidades] = useState<string[]>(["Beach Tennis"]);
  const [formModalidadePrecos, setFormModalidadePrecos] = useState<Record<string, string>>({});
  const [formNovaModalidade, setFormNovaModalidade] = useState("");

  // Pagamentos state
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [maquinetaId, setMaquinetaId] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [titularPix, setTitularPix] = useState("");
  const [cidadePix, setCidadePix] = useState("");
  const [salvandoPagamentos, setSalvandoPagamentos] = useState(false);

  // Notificações state
  const [notifReservaEmail, setNotifReservaEmail] = useState(true);
  const [notifCancelamentoEmail, setNotifCancelamentoEmail] = useState(true);
  const [notifPagamentoEmail, setNotifPagamentoEmail] = useState(true);
  const [alertaPagamentoMinutos, setAlertaPagamentoMinutos] = useState(30);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(false);
  const [notificacoesLoaded, setNotificacoesLoaded] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState<string | null>(null);
  const [salvandoNotificacoes, setSalvandoNotificacoes] = useState(false);
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/comunicados/ativos", { headers: {} })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNotifications(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showNotifications]);

  // Motivos de Cancelamento state
  const [motivos, setMotivos] = useState<MotivoCancelamento[]>([]);
  const [estatisticasCancelamentos, setEstatisticasCancelamentos] = useState<EstatisticasCancelamentos | null>(null);
  const [erroMotivos, setErroMotivos] = useState<string | null>(null);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [modalMotivoOpen, setModalMotivoOpen] = useState(false);
  const [editingMotivo, setEditingMotivo] = useState<MotivoCancelamento | null>(null);
  const [formMotivoNome, setFormMotivoNome] = useState("");
  const [salvandoMotivo, setSalvandoMotivo] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadQuadras = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quadras", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Não foi possível carregar as quadras.");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Resposta inválida ao carregar as quadras.");
      setQuadras(data);
      return true;
    } catch {
      showToast("Não foi possível carregar as quadras.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsuarios = useCallback(async () => {
    setLoadingUsuarios(true);
    try {
      const res = await fetch("/api/usuarios", { headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsuarios(data);
        }
      }
    } catch { /* silent */ } finally {
      setLoadingUsuarios(false);
    }
  }, []);

  const loadPlanoInfo = useCallback(async () => {
    setLoadingPlano(true);
    try {
      const res = await fetch("/api/tenant/assinatura/plano", { headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Plano indisponível");
      const data = await res.json();
      setPlanoInfo(data?.plano && data?.uso ? data : null);
    } catch {
      setPlanoInfo(null);
    } finally {
      setLoadingPlano(false);
    }
  }, []);

  useEffect(() => {
    loadQuadras();
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => setCurrentUser(d?.usuario || null)).catch(() => {});
  }, [loadQuadras]);

  // Plano da arena (limite de quadras) carregado sempre e atualizado ao cadastrar/remover quadras
  useEffect(() => {
    loadPlanoInfo();
  }, [loadPlanoInfo, quadras.length]);

  useEffect(() => {
    if (activeTab === "usuarios") {
      loadUsuarios();
      loadPlanoInfo();
    }
  }, [activeTab, loadUsuarios, loadPlanoInfo]);

  const loadPagamentos = useCallback(async () => {
    setLoadingGateway(true);
    try {
      const [resMaquineta, resArena] = await Promise.all([
        fetch("/api/pagamentos/gateway/maquineta").catch(() => null),
        fetch("/api/arenas/minha").catch(() => null),
      ]);

      if (resMaquineta && resMaquineta.ok) {
        const dataM = await resMaquineta.json();
        if (dataM) {
          setMaquinetaId(dataM.gateway_device_id || "");
          setPublicKey(dataM.gateway_public_key || "");
          setGatewayConnected(dataM.gateway_connected === true);
        }
      }

      if (resArena && resArena.ok) {
        const dataA = await resArena.json();
        if (dataA) {
          setChavePix(dataA.chave_pix || "");
          setTitularPix(dataA.titular_pix || "");
          setCidadePix(dataA.cidade_pix || "");
        }
      }
    } catch {
      showToast("Não foi possível carregar as configurações de pagamentos.");
    } finally {
      setLoadingGateway(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "pagamentos") {
      loadPagamentos();
    }
  }, [activeTab, loadPagamentos]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthStatus = params.get("oauth");

      if (code && state) {
        handleTabClick("pagamentos");
        fetch("/api/pagamentos/gateway/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao conectar a conta Mercado Pago.");
            return data;
          })
          .then((data) => {
            if (data.gateway_connected) {
              setAccessToken("");
              setGatewayConnected(true);
              loadPagamentos();
              showToast("✓ Conta do Mercado Pago conectada com sucesso!");
              window.history.replaceState({}, document.title, window.location.pathname + "?aba=pagamentos");
            }
          })
          .catch((err) => {
            showToast("Erro na conexão: " + (err instanceof Error ? err.message : String(err)));
          });
      } else if (oauthStatus === "success") {
        handleTabClick("pagamentos");
        showToast("✓ Conta do Mercado Pago conectada com sucesso!");
      }
    }
  }, [loadPagamentos]);

  const handleConectarMercadoPago = async () => {
    try {
      const res = await fetch("/api/pagamentos/gateway/oauth/url");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao iniciar conexão automática.");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao iniciar conexão automática.");
    }
  };

  const [modalDesconectarOpen, setModalDesconectarOpen] = useState(false);
  const [senhaDesconectar, setSenhaDesconectar] = useState("");
  const [desconectando, setDesconectando] = useState(false);

  const handleDesconectarMercadoPago = () => {
    setSenhaDesconectar("");
    setModalDesconectarOpen(true);
  };

  const confirmarDesconectarMercadoPago = async () => {
    if (!senhaDesconectar) {
      showToast("Informe sua senha atual para desconectar.");
      return;
    }
    setDesconectando(true);
    try {
      const res = await fetch("/api/pagamentos/gateway/oauth/desconectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha_atual: senhaDesconectar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao desconectar conta.");
      setAccessToken("");
      setGatewayConnected(false);
      setPublicKey("");
      setModalDesconectarOpen(false);
      setSenhaDesconectar("");
      showToast("Conta Mercado Pago desconectada.");
      loadPagamentos();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao desconectar conta.");
    } finally {
      setDesconectando(false);
    }
  };

  const handleSavePagamentos = async () => {
    setSalvandoPagamentos(true);
    try {
      const promises: Promise<void>[] = [];

      promises.push(
        fetch("/api/arenas/minha", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chave_pix: chavePix,
            titular_pix: titularPix,
            cidade_pix: cidadePix,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Erro ao salvar dados Pix da arena.");
          }
        })
      );

      if (!loadingGateway) {
        const payloadGateway: Record<string, string> = {
          gateway_device_id: maquinetaId,
          gateway_public_key: publicKey,
        };
        if (accessToken.trim()) {
          payloadGateway.gateway_access_token = accessToken.trim();
        }

        promises.push(
          fetch("/api/pagamentos/gateway/maquineta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadGateway),
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || "Erro ao salvar credenciais do gateway.");
            }
          })
        );
      }

      await Promise.all(promises);
      setAccessToken("");
      await loadPagamentos();
      showToast("Configurações salvas com sucesso!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar configurações de pagamentos.");
    } finally {
      setSalvandoPagamentos(false);
    }
  };

  const loadNotificacoes = useCallback(async () => {
    setLoadingNotificacoes(true);
    setNotificacoesLoaded(false);
    setErroNotificacoes(null);
    try {
      const res = await fetch("/api/arenas/minha");
      if (!res.ok) throw new Error("Não foi possível carregar as preferências de notificações.");
      const data = await res.json();
      if (!data || typeof data !== "object") throw new Error("Não foi possível carregar as preferências de notificações.");
      if (data.notif_reserva_email !== undefined) setNotifReservaEmail(Boolean(data.notif_reserva_email));
      if (data.notif_cancelamento_email !== undefined) setNotifCancelamentoEmail(Boolean(data.notif_cancelamento_email));
      if (data.notif_pagamento_email !== undefined) setNotifPagamentoEmail(Boolean(data.notif_pagamento_email));
      if (data.alerta_pagamento_minutos !== undefined) setAlertaPagamentoMinutos(Number(data.alerta_pagamento_minutos) || 30);
      setNotificacoesLoaded(true);
    } catch {
      setErroNotificacoes("Não foi possível carregar as preferências de notificações.");
    } finally {
      setLoadingNotificacoes(false);
    }
  }, []);

  useEffect(() => {
    // Prepare the panel once; tab navigation must preserve unsaved preferences.
    loadNotificacoes();
  }, [loadNotificacoes]);

  const handleSaveNotificacoes = async () => {
    setSalvandoNotificacoes(true);
    try {
      const res = await fetch("/api/arenas/minha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notif_reserva_email: notifReservaEmail ? 1 : 0,
          notif_cancelamento_email: notifCancelamentoEmail ? 1 : 0,
          notif_pagamento_email: notifPagamentoEmail ? 1 : 0,
          alerta_pagamento_minutos: Number(alertaPagamentoMinutos) || 30,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao salvar preferências de notificações.");
      }

      showToast("Configurações de notificações salvas com sucesso!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao salvar notificações.");
    } finally {
      setSalvandoNotificacoes(false);
    }
  };

  const loadMotivos = useCallback(async () => {
    setLoadingMotivos(true);
    setErroMotivos(null);
    try {
      const [motivosRes, estatisticasRes] = await Promise.all([
        fetch("/api/motivos"),
        fetch("/api/motivos/estatisticas"),
      ]);
      if (!motivosRes.ok || !estatisticasRes.ok) throw new Error("Não foi possível carregar os cancelamentos.");
      const [data, estatisticas] = await Promise.all([motivosRes.json(), estatisticasRes.json()]);
      if (!Array.isArray(data) || !estatisticas?.mes || !Array.isArray(estatisticas?.ultimos30Dias?.porMotivo)) {
        throw new Error("Resposta inválida ao carregar os cancelamentos.");
      }
      setMotivos(data);
      setEstatisticasCancelamentos(estatisticas);
    } catch (error) {
      setErroMotivos(error instanceof Error ? error.message : "Não foi possível carregar os cancelamentos.");
    } finally {
      setLoadingMotivos(false);
    }
  }, []);

  useEffect(() => {
    loadMotivos();
  }, [loadMotivos]);

  const handleOpenAdicionarMotivo = () => {
    setEditingMotivo(null);
    setFormMotivoNome("");
    setModalMotivoOpen(true);
  };

  const handleOpenEditarMotivo = (m: MotivoCancelamento) => {
    setEditingMotivo(m);
    setFormMotivoNome(m.motivo);
    setModalMotivoOpen(true);
  };

  const handleSalvarMotivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMotivoNome.trim()) {
      showToast("O nome do motivo é obrigatório.");
      return;
    }
    setSalvandoMotivo(true);
    try {
      if (editingMotivo) {
        const res = await fetch(`/api/motivos/${editingMotivo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: formMotivoNome.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao atualizar motivo.");
        }
        showToast("Motivo atualizado com sucesso!");
      } else {
        const res = await fetch("/api/motivos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: formMotivoNome.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao adicionar motivo.");
        }
        showToast("Motivo adicionado com sucesso!");
      }
      setModalMotivoOpen(false);
      await loadMotivos();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar motivo.");
    } finally {
      setSalvandoMotivo(false);
    }
  };

  const handleExcluirMotivo = async (m: MotivoCancelamento) => {
    if (m.id < 0) {
      showToast("Motivos predefinidos do sistema não podem ser excluídos.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o motivo "${m.motivo}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/motivos/${m.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao excluir motivo.");
      }
      await loadMotivos();
      showToast("Motivo de cancelamento excluído com sucesso.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao excluir motivo.");
    }
  };

  const canManageUser = (u: UsuarioData) =>
    Boolean(currentUser && ['Administrador', 'Gerente'].includes(currentUser.perfil) &&
      u.id !== currentUser.id &&
      (u.perfil === 'Recepcionista' || (currentUser.perfil === 'Administrador' && u.perfil === 'Gerente')));

  const openEditarUsuarioModal = (u: UsuarioData) => {
    setEditingUsuario(u);
    setFormUsuarioNome(u.nome);
    setFormUsuarioEmail(u.email);
    setFormUsuarioPerfil(u.perfil);
    setModalUsuarioOpen(true);
  };

  const openNovoUsuarioModal = () => {
    setEditingUsuario(null);
    setFormUsuarioNome("");
    setFormUsuarioEmail("");
    setFormUsuarioPerfil("");
    setModalUsuarioOpen(true);
  };

  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = { nome: formUsuarioNome, email: formUsuarioEmail, perfil: formUsuarioPerfil };
      const url = editingUsuario ? `/api/usuarios/${editingUsuario.id}` : "/api/usuarios";
      const method = editingUsuario ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Erro ao salvar"); }
      showToast(editingUsuario ? "Usuário atualizado!" : "Usuário criado e convite enviado!");
      setModalUsuarioOpen(false);
      loadUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  const handleDeleteUsuario = async () => {
    if (!editingUsuario) return;
    if (!window.confirm(`Excluir ${editingUsuario.nome}?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${editingUsuario.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      showToast("Usuário removido.");
      setModalUsuarioOpen(false);
      loadUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  const handleTransferirAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferindo || !novoAdminId || !transferPassword) return;
    setTransferError("");
    if (currentUser?.perfil !== "Administrador") {
      setTransferError("Apenas o Administrador atual pode transferir a administra\u00e7\u00e3o.");
      return;
    }
    const targetUser = usuarios.find(u => u.id === Number(novoAdminId) && u.ativo === 1 && canManageUser(u));
    if (!targetUser) {
      setTransferError("Selecione um integrante ativo da equipe.");
      return;
    }
    setTransferindo(true);
    try {
      const res = await fetch("/api/usuarios/transferir-administracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: targetUser.id, senha_atual: transferPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao transferir administra\u00e7\u00e3o.");
      }
      setModalTransferirOpen(false);
      setNovoAdminId("");
      clearSession();
      window.dispatchEvent(new Event('cm:session-expired'));
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Erro ao transferir administra\u00e7\u00e3o.");
    } finally {
      setTransferPassword("");
      setTransferindo(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    if (updatingStatusId !== null) return;
    const isAtiva = currentStatus === "Ativa";
    const newStatus = isAtiva ? "Inativa" : "Ativa";
    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/quadras/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Não foi possível alterar o status da quadra.");
      }
      setQuadras((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: newStatus, ativa: !isAtiva } : q))
      );
      showToast(`Status da quadra alterado para ${newStatus}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível alterar o status da quadra.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const buildDefaultPrecos = (mods: string[], basePreco: number) => {
    const precos: Record<string, string> = {};
    mods.forEach((m) => {
      precos[m] = Number(basePreco).toFixed(2).replace(".", ",");
    });
    return precos;
  };

  const openNewQuadraModal = () => {
    setEditingQuadra(null);
    setFormNome(`Quadra ${quadras.length + 1}`);
    setFormTipoPiso("Areia");
    setFormHoraAbertura("07:00");
    setFormHoraFechamento("22:00");
    const mods = ["Beach Tennis", "Vôlei de Praia"];
    setFormModalidades(mods);
    setFormModalidadePrecos(buildDefaultPrecos(mods, 100));
    setFormNovaModalidade("");
    setModalOpen(true);
  };

  const openEditQuadraModal = (q: QuadraData) => {
    setEditingQuadra(q);
    setFormNome(q.nome);
    setFormTipoPiso(q.tipo || "Areia");
    setFormHoraAbertura(q.hora_abertura ? q.hora_abertura.slice(0, 5) : "07:00");
    setFormHoraFechamento(q.hora_fechamento ? q.hora_fechamento.slice(0, 5) : "22:00");

    let mods: string[] = [];
    const precosMap: Record<string, string> = {};
    if (Array.isArray(q.modalidades)) {
      mods = q.modalidades.map((m) => {
        if (typeof m === "string") {
          precosMap[m] = Number(q.preco_base ?? q.preco_hora ?? 100).toFixed(2).replace(".", ",");
          return m;
        } else {
          precosMap[m.nome] = Number(m.preco ?? q.preco_base ?? 100).toFixed(2).replace(".", ",");
          return m.nome;
        }
      });
    }
    if (mods.length === 0) {
      mods = ["Beach Tennis"];
      precosMap["Beach Tennis"] = Number(q.preco_base ?? 100).toFixed(2).replace(".", ",");
    }
    setFormModalidades(mods);
    setFormModalidadePrecos(precosMap);
    setFormNovaModalidade("");
    setModalOpen(true);
  };

  const horarioQuadraInvalido = Number(formHoraAbertura.split(':')[0]) >= Number(formHoraFechamento.split(':')[0]);

  const handleSaveQuadraForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoQuadra) return;
    if (horarioQuadraInvalido) {
      showToast("O fechamento deve ser depois da abertura.");
      return;
    }
    setSalvandoQuadra(true);
    try {
      const modalidades = formModalidades.map((nome) => ({
        nome,
        preco: parseCourtPrice(formModalidadePrecos[nome] ?? ""),
      }));
      if (!modalidades.length || modalidades.some((m) => !Number.isFinite(m.preco))) {
        throw new Error("Informe um preço maior que zero, com até duas casas decimais, para cada modalidade.");
      }
      const response = await fetch(editingQuadra ? `/api/quadras/${editingQuadra.id}` : "/api/quadras", {
        method: editingQuadra ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formNome,
          preco_base: modalidades[0].preco,
          hora_abertura: `${formHoraAbertura.split(':')[0]}:00`,
          hora_fechamento: `${formHoraFechamento.split(':')[0]}:00`,
          tipo: formTipoPiso,
          modalidades,
          ...(editingQuadra ? { status: editingQuadra.status || (editingQuadra.ativa === false ? "Inativa" : "Ativa") } : {}),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível salvar a quadra.");
      }
      setModalOpen(false);
      const refreshed = await loadQuadras();
      showToast(refreshed
        ? (editingQuadra ? "Quadra atualizada com sucesso!" : "Nova quadra cadastrada com sucesso!")
        : "Quadra salva. Não foi possível atualizar a lista; recarregue a página.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a quadra.");
    } finally {
      setSalvandoQuadra(false);
    }
  };

  const handleDeleteQuadra = async () => {
    if (!editingQuadra || salvandoQuadra) return;
    if (!window.confirm(`Excluir a quadra "${editingQuadra.nome}"? Esta ação não pode ser desfeita.`)) return;
    setSalvandoQuadra(true);
    try {
      const response = await fetch(`/api/quadras/${editingQuadra.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível excluir a quadra.");
      }
      setQuadras((prev) => prev.filter((q) => q.id !== editingQuadra.id));
      setModalOpen(false);
      showToast("Quadra excluída com sucesso!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível excluir a quadra.");
    } finally {
      setSalvandoQuadra(false);
    }
  };
  const handleAddModalidade = () => {
    const nova = formNovaModalidade.trim();
    if (!nova || formModalidades.includes(nova)) return;
    setFormModalidades((prev) => [...prev, nova]);
    setFormModalidadePrecos((prev) => ({ ...prev, [nova]: "100,00" }));
    setFormNovaModalidade("");
  };

  const handleRemoveModalidade = (mod: string) => {
    setFormModalidades((prev) => prev.filter((m) => m !== mod));
    setFormModalidadePrecos((prev) => {
      const copy = { ...prev };
      delete copy[mod];
      return copy;
    });
  };

  const formatCurrency = (val: number) => {
    return "R$ " + Number(val).toFixed(2).replace(".", ",");
  };

  const quadrasAtivas = quadras.filter(
    (q) => q.status === "Ativa" || (q.status !== "Inativa" && q.ativa !== false)
  ).length;

  const total30Dias = estatisticasCancelamentos?.ultimos30Dias.total || 0;
  const porMotivo = estatisticasCancelamentos?.ultimos30Dias.porMotivo || [];
  const correspondeMotivo = (uso: { id: number | null; motivo: string }, motivo: MotivoCancelamento) =>
    uso.id === motivo.id || normalizarMotivo(uso.motivo) === normalizarMotivo(motivo.motivo);
  const motivosComUso = motivos.map((motivo) => {
    const contagem = porMotivo
      .filter((uso) => correspondeMotivo(uso, motivo))
      .reduce((total, uso) => total + uso.total, 0);
    return {
      ...motivo,
      contagem,
      porcentagem: total30Dias ? Math.round(contagem * 100 / total30Dias) : 0,
    };
  });
  const outrosCancelamentos = porMotivo
    .filter((uso) => !motivos.some((motivo) => correspondeMotivo(uso, motivo)))
    .reduce((total, uso) => total + uso.total, 0);
  const maiorContagem = Math.max(0, ...motivosComUso.map((motivo) => motivo.contagem));
  const distribuicao = outrosCancelamentos > 0
    ? [...motivosComUso, { id: 0, motivo: "Outros ou sem motivo", contagem: outrosCancelamentos, porcentagem: Math.round(outrosCancelamentos * 100 / total30Dias) }]
    : motivosComUso;
  const desistencias = motivosComUso.find((motivo) => motivo.id === -1)?.contagem || 0;
  const porcentagemDesistencia = total30Dias ? Math.round(desistencias * 100 / total30Dias) : 0;

  return (
    <>
      {/* Toast Alert */}
      {toastMessage && (
        <ToastLayer><div className="fixed bottom-6 right-6 z-50 bg-[#071915] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#C9FF3B]/30 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-[#C9FF3B] flex items-center justify-center text-[#071915]">
            <Check size={13} strokeWidth={3} />
          </div>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div></ToastLayer>
      )}

      {/* Container Principal */}
      <div
        data-pencil-name="Área Principal Configurações"
        className="box-border w-full flex flex-col gap-[18px] justify-start items-start font-[Inter,system-ui,sans-serif]"
      >
        {/* Cabeçalho Configurações */}
        <div
          data-pencil-name="Cabeçalho Configurações"
          className="box-border w-full h-[70px] shrink-0 flex flex-row gap-0 justify-between items-center"
        >
          <div
            data-pencil-name="Título Configurações Grupo"
            className="box-border w-fit shrink-0 h-fit flex flex-col gap-[6px] justify-start items-start"
          >
            <div
              data-pencil-name="Breadcrumb Configurações"
              className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
            >
              Sistema / Configurações
            </div>
            <div
              data-pencil-name="Título Configurações"
              className="text-[28px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              Configurações
            </div>
          </div>

          <div
            data-pencil-name="Ações Cabeçalho Configurações"
            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
          >
            {/* Acesso usuário Configurações */}
            <div
              data-pencil-name="Acesso usuário Configurações"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
            >
              {/* Portal do Cliente */}
              <ArenaPortalButton />

              {/* Usuário Logado */}
              <div
                data-pencil-name="Usuário logado Configurações"
                className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[11px] justify-start items-center bg-[#F1EDE6] rounded-[17px]"
              >
                <div
                  data-pencil-name="Status online Configurações"
                  className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full"
                ></div>
                <div
                  data-pencil-name="Nome usuário Configurações"
                  className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {userName}
                </div>
              </div>

              {/* Notificações Bell */}
              <div className="relative">
                <button
                  type="button"
                  data-pencil-name="Notificações Configurações"
                  onClick={() => setShowNotifications((open) => !open)}
                  aria-label="Abrir notificações"
                  aria-expanded={showNotifications}
                  aria-controls="config-notifications-menu"
                  title="Notificações"
                  className="box-border w-[34px] h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-full relative flex items-center justify-center cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <BellRing size={16} className="text-[#071915]" />
                  {notifications.length > 0 && <span className="box-border w-[7px] h-[7px] absolute right-[6px] top-[6px] bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] -outline-offset-1 rounded-full" />}
                </button>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" role="presentation" onClick={() => setShowNotifications(false)} />
                    <div id="config-notifications-menu" className="absolute right-0 top-full mt-2 z-50 w-[min(320px,calc(100vw-32px))] bg-[#F7F2EA] border border-[#E6DED2] rounded-[16px] shadow-xl p-4">
                      <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
                        <span className="text-xs font-bold text-[#071915]">Notificações {notifications.length > 0 && <span className="ml-1 rounded-full bg-[#D11F2A]/10 px-1.5 py-0.5 text-[10px] text-[#D11F2A]">{notifications.length}</span>}</span>
                        <button type="button" onClick={() => setShowNotifications(false)} aria-label="Fechar notificações" className="text-[#6F766F] hover:text-[#071915]"><X size={15} /></button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {notifications.length === 0 ? <p className="py-5 text-center text-xs text-[#6F766F]">Nenhuma notificação no momento.</p> : notifications.map((notification) => (
                          <div key={notification.id} className="rounded-lg border border-[#E6DED2] bg-white p-2.5 text-xs font-semibold text-[#071915]">{notification.message}</div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Corpo Configurações: Menu Lateral + Painel Direito */}
        <div
          data-pencil-name="Corpo Configurações"
          className="box-border w-full flex flex-col lg:flex-row gap-[18px] justify-start items-start"
        >
          {/* Menu Interno Configurações */}
          <div
            data-pencil-name="Menu Interno Configurações"
            className="box-border w-full lg:w-[190px] shrink-0 h-fit flex flex-col gap-[4px] p-[8px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm"
          >
            {/* Aba Quadras (Ativa) */}
            <button
              type="button"
              onClick={() => handleTabClick("quadras")}
              data-pencil-name="Aba Configurações Quadras"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "quadras"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Quadras"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M6.81885 0.60156q-0.25293 0.01367-0.44776 0.09912-0.14014 0.05469-2.44384 1.18946-2.30371 1.13477-2.38575 1.18945-0.23926 0.14014-0.33838 0.40674-0.0957 0.2666-0.01367 0.54687 0.07178 0.22217 0.23242 0.38282 0.16064 0.16064 0.39649 0.23242 0.08545 0.01367 5.18164 0.01367 5.09619 0 5.18164-0.01367 0.2085-0.05811 0.37598-0.21192 0.30762-0.27686 0.28027-0.7041-0.02734-0.42725-0.3623-0.65283-0.11279-0.06836-2.04395-1.02197l-2.36865-1.14844q-0.43408-0.2085-0.52979-0.23584-0.35205-0.11279-0.71435-0.07178z m0.3623 1.17578q0.08545 0.02734 1.79444 0.86817l1.71923 0.84082-1.8457 0.01367q-1.84912 0-3.69824 0l-1.8457-0.01367 1.70556-0.84082q1.72266-0.84082 1.80811-0.86817 0.18115-0.05469 0.3623 0z m-3.78027 4.07422q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m2.32422 0q-0.12646 0.01367-0.2461 0.10596-0.11621 0.08887-0.17431 0.21533l-0.04102 0.09912 0 4.38184 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-2.10205q0.01367-2.09863 0-2.21142-0.05469-0.23584-0.24609-0.36914-0.18799-0.1333-0.44092-0.09229z m2.35156 0q-0.18115 0.01367-0.31445 0.14698-0.1333 0.1333-0.17432 0.31445-0.01367 0.11279 0 2.21142l0 2.10205 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-4.34082-0.04102-0.0957q-0.08545-0.19824-0.25293-0.30079-0.16748-0.10596-0.37939-0.06494z m2.32422 0q-0.0957 0.01367-0.17432 0.05127-0.07519 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m-8.79102 6.41211q-0.12646 0.02734-0.23925 0.1333-0.10938 0.10596-0.16749 0.23243-0.06836 0.2085 0.01368 0.42724 0.08545 0.21533 0.29394 0.31445l0.1128 0.04102 10.75292 0 0.1128-0.04102q0.2085-0.11279 0.29053-0.32129 0.08545-0.21191 0.00683-0.4204-0.0752-0.21192-0.28369-0.32471l-0.09912-0.04102-5.36279-0.01367q-5.3457 0-5.43116 0.01367z"
                  fill={activeTab === "quadras" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Quadras"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "quadras" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Quadras
              </div>
            </button>

            {/* Aba Usuários */}
            <button
              type="button"
              onClick={() => handleTabClick("usuarios")}
              data-pencil-name="Aba Configurações Usuários"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "usuarios"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Usuários"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M4.84326 1.20313q-0.81006 0.11279-1.42871 0.61865-0.61523 0.50244-0.89551 1.24414-0.18115 0.48877-0.18115 1.02197 0 0.28027 0.04102 0.50586 0.04443 0.22217 0.14013 0.48877 0.15381 0.46143 0.46826 0.84766 0.31787 0.38281 0.7212 0.63574 0.36572 0.22559 0.73486 0.32471 0.37256 0.0957 0.80664 0.0957 0.22559 0 0.3623-0.01367 0.14014-0.01367 0.35206-0.05811 0.60156-0.15381 1.104-0.55713 0.50586-0.40674 0.7998-0.98096 0.19482-0.39307 0.26661-0.88183 0.02734-0.14014 0.02734-0.40674 0-0.2666-0.02734-0.40674-0.09912-0.65625-0.46485-1.20312-0.3623-0.54688-0.93652-0.89551-0.43408-0.2666-0.98096-0.36572-0.15381-0.02734-0.45459-0.03418-0.30078-0.00684-0.45459 0.02051z m4.34082 0.0581q-0.14014 0.04102-0.25293 0.14014-0.11279 0.0957-0.15381 0.2666-0.04102 0.16748 0 0.32129 0.04102 0.15381 0.15381 0.25293 0.11279 0.0957 0.33838 0.18115 0.24951 0.08203 0.40332 0.17432 0.15381 0.08887 0.30762 0.25976 0.33838 0.33496 0.45459 0.76904 0.11963 0.43408 0.01367 0.86817-0.10254 0.43408-0.41699 0.76904-0.31445 0.33496-0.7793 0.48877-0.19482 0.07178-0.28711 0.14356-0.08887 0.06836-0.16064 0.20849-0.05469 0.09912-0.05469 0.23926 0 0.13672 0.05469 0.23584 0.08545 0.19482 0.28027 0.29395 0.12646 0.05811 0.25293 0.05126 0.12646-0.01025 0.33496-0.07861 0.35205-0.11279 0.6084-0.27344 0.25977-0.16064 0.5127-0.42724 0.78271-0.78271 0.85449-1.84912 0.09912-1.18945-0.70069-2.12598-0.48877-0.58789-1.2749-0.85449-0.33496-0.11279-0.48877-0.05469z m-3.73926 1.09033q0.40674 0.02734 0.78272 0.28711 0.37939 0.25977 0.58105 0.65967 0.20508 0.39648 0.18457 0.88184-0.02051 0.48193-0.28711 0.86132-0.15381 0.23584-0.37939 0.41358-0.22217 0.17432-0.46143 0.27002-0.19482 0.05811-0.2871 0.07861-0.08887 0.02051-0.32813 0.02051-0.23926 0-0.33154-0.02051-0.08887-0.02051-0.28369-0.07861-0.39307-0.14014-0.68018-0.46826-0.28711-0.32813-0.3999-0.73487-0.10938-0.46143 0.01367-0.90918 0.12646-0.44775 0.45459-0.76904 0.33154-0.32471 0.79297-0.45117 0.08545-0.02734 0.24609-0.04785 0.16064-0.02051 0.21533-0.00684l0.16748 0.01367z m-2.35156 5.85156q-0.96387 0.14014-1.65088 0.82715-0.54687 0.54688-0.75537 1.31592-0.07178 0.23926-0.08545 0.44092-0.01367 0.20166-0.01367 0.82031l0 0.76904 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-0.79639q0.01367-0.61865 0.02734-0.77246 0.01367-0.15381 0.07178-0.34863 0.14014-0.37939 0.46826-0.68018 0.32813-0.30078 0.73487-0.41357 0.15381-0.04102 0.53662-0.05469 0.38623-0.01367 1.66113-0.01367 1.2749 0 1.65771 0.01367 0.38623 0.01367 0.54004 0.05469 0.42041 0.11279 0.75538 0.43066 0.33838 0.31445 0.46142 0.71778 0.05811 0.16748 0.06494 0.3247 0.00684 0.15381 0.02051 0.7417l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-0.76904q0-0.61865-0.01367-0.82031-0.01367-0.20166-0.08545-0.44092-0.08203-0.32129-0.23584-0.61523-0.2666-0.51953-0.73828-0.90235-0.46826-0.38623-1.02539-0.54004l-0.04444-0.01367q-0.16748-0.05811-0.29394-0.07178-0.15381-0.01367-0.56055-0.01367l-1.60986-0.01367q-2.05762 0-2.21143 0.02734z m7.85449 0.05811q-0.23926 0.05469-0.36572 0.27344-0.12305 0.21533-0.05469 0.45459 0.05811 0.19482 0.21192 0.30761 0.06836 0.04102 0.28027 0.12647 0.24951 0.08203 0.40332 0.17432 0.15381 0.08887 0.32471 0.27343 0.33496 0.34863 0.44775 0.78272 0.02734 0.11279 0.03418 0.24609 0.00684 0.1333 0.02051 0.70752l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0.01367-0.64599q0-0.64258-0.02734-0.95703-0.02734-0.31445-0.12647-0.59473-0.14014-0.42041-0.42724-0.81006-0.28711-0.39307-0.64942-0.65967-0.31103-0.22559-0.69726-0.35888-0.38281-0.1333-0.5503-0.08887z"
                  fill={activeTab === "usuarios" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Usuários"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "usuarios" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Usuários
              </div>
            </button>

            {/* Aba Pagamentos */}
            <button
              type="button"
              onClick={() => handleTabClick("pagamentos")}
              data-pencil-name="Aba Configurações Pagamentos"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "pagamentos"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Pagamentos"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M2.15674 2.35156q-0.29395 0.02734-0.58789 0.16748-0.29395 0.14014-0.50586 0.3794-0.30762 0.32129-0.43408 0.79638l-0.04102 0.1709 0 6.29932 0.04102 0.16748q0.07178 0.25293 0.18115 0.44092 0.11279 0.18799 0.29394 0.37256 0.18457 0.18115 0.37256 0.29394 0.18799 0.10938 0.44092 0.18115l0.16748 0.04102 9.83008 0 0.16748-0.04102q0.25293-0.07178 0.44092-0.18115 0.18799-0.11279 0.36914-0.29394 0.18457-0.18457 0.29394-0.37256 0.11279-0.18799 0.18457-0.44092l0.04102-0.16748 0-6.33008-0.04102-0.16748q-0.12646-0.46143-0.43408-0.76904-0.44775-0.48877-1.13476-0.56055-0.16748-0.01367-4.81592-0.01367-4.64844 0-4.82959 0.02734z m9.74463 1.20313q0.19482 0.09912 0.29394 0.29394l0.04102 0.09912 0.01367 1.30225-10.5 0 0.01367-1.30225 0.04102-0.09912q0.11279-0.24951 0.37939-0.32129 0.08545-0.02734 4.85694-0.02734l4.76123 0.01367 0.09912 0.04102z m0.34863 4.67578l-0.01367 1.82178-0.02735 0.08545q-0.12646 0.26318-0.37939 0.33496-0.08203 0.02734-4.82959 0.02734-4.74756 0-4.82959-0.02734-0.25293-0.07178-0.37939-0.33496l-0.02735-0.08545-0.01367-3.62647 10.5 0 0 1.80469z"
                  fill={activeTab === "pagamentos" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Pagamentos"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "pagamentos" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Pagamentos
              </div>
            </button>

            {/* Aba Notificações */}
            <button
              type="button"
              onClick={() => handleTabClick("notificacoes")}
              data-pencil-name="Aba Configurações Notificações"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "notificacoes"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Notificações"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M6.76074 0.60156q-0.62891 0.02734-1.22363 0.25293-0.59473 0.22217-1.0835 0.62891-0.63232 0.50586-1.03222 1.22705-0.39648 0.72119-0.48194 1.51758-0.01367 0.16748-0.03418 0.70068-0.02051 0.52979-0.0581 0.86817-0.03418 0.33496-0.12988 0.68359-0.09912 0.43408-0.28028 0.78613-0.14014 0.30762-0.29394 0.51953-0.15381 0.2085-0.50586 0.58448-0.22217 0.25293-0.30762 0.38623-0.08203 0.1333-0.12647 0.31445-0.04102 0.14014-0.02734 0.32471 0.01367 0.18115 0.05469 0.30761 0.1709 0.46143 0.60498 0.66993l0.04101 0.02734q0.09912 0.0581 0.28028 0.07178 0.23584 0.01367 1.04931 0.02734l7.5879 0q0.81348-0.01367 1.04931-0.02734 0.18115-0.01367 0.28027-0.07178l0.04102-0.02734q0.43408-0.2085 0.60498-0.66993 0.04102-0.12646 0.05469-0.30761 0.01367-0.18457-0.02735-0.32471-0.04443-0.18115-0.12988-0.32129-0.08203-0.14014-0.3042-0.37939-0.35205-0.37598-0.50586-0.58448-0.15381-0.21191-0.29394-0.51953-0.16748-0.33496-0.2666-0.69726-0.0957-0.36572-0.14014-0.72803-0.04102-0.36572-0.06836-0.9126-0.01367-0.72803-0.08545-1.04932-0.2085-1.08008-0.93652-1.9038-0.72803-0.82715-1.76367-1.1792-0.7417-0.23584-1.54151-0.19483z m0.68701 1.18946q0.46143 0.07178 0.88184 0.28369 0.42041 0.2085 0.7417 0.55713 0.46143 0.46143 0.67334 1.06298 0.0957 0.25293 0.12988 0.49219 0.0376 0.23584 0.05127 0.7417 0.01367 0.58789 0.06836 1.01514 0.05811 0.42725 0.15723 0.84765 0.16748 0.68359 0.46826 1.2168 0.30078 0.5332 0.84766 1.12109l0.19482 0.19483-9.32422 0 0.19482-0.19483q0.54688-0.58789 0.84766-1.12109 0.30078-0.5332 0.46826-1.2168 0.09912-0.42041 0.15381-0.84765 0.05811-0.42725 0.07861-1.01514 0.02051-0.58789 0.06836-0.875 0.05127-0.28711 0.21192-0.63574 0.16064-0.35205 0.46142-0.68701 0.30078-0.33838 0.63575-0.54688 0.60498-0.36572 1.333-0.42041 0.08203-0.01367 0.31104 0 0.23242 0.01367 0.34521 0.02735z m-1.6372 9.89843q-0.22559 0.08545-0.33155 0.28028-0.10254 0.19482-0.04785 0.42041 0.01367 0.08545 0.11963 0.24609 0.10596 0.16065 0.21875 0.27344 0.50244 0.50244 1.23047 0.50244 0.72803 0 1.23047-0.50244 0.11279-0.11279 0.21875-0.27344 0.10596-0.16064 0.11963-0.24609 0.05469-0.19482-0.0376-0.38282-0.08887-0.19141-0.27002-0.29052-0.08545-0.04102-0.25293-0.04102-0.11279 0-0.15381 0.01367-0.04102 0.01367-0.11279 0.04102-0.09912 0.05811-0.18115 0.15723-0.11279 0.15381-0.17774 0.20849-0.06152 0.05469-0.14697 0.09912-0.08203 0.04102-0.23584 0.04102-0.15381 0-0.23926-0.04102-0.08203-0.04443-0.14697-0.09912-0.06152-0.05469-0.17432-0.20849-0.15381-0.19824-0.43408-0.21192-0.14014 0-0.19482 0.01367z"
                  fill={activeTab === "notificacoes" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Notificações"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "notificacoes" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Notificações
              </div>
            </button>

            {/* Aba Cancelamentos */}
            <button
              type="button"
              onClick={() => handleTabClick("cancelamentos")}
              data-pencil-name="Aba Configurações Motivos de cancelamento"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "cancelamentos"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Motivos de cancelamento"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M1.97559 1.20313q-0.39307 0.08545-0.71778 0.33837-0.32129 0.24951-0.50244 0.61524-0.12646 0.28027-0.16748 0.58789-0.01367 0.16748 0 5.01074l0 4.17334q0.01367 0.68359 0.02734 0.75537 0.11279 0.33496 0.37256 0.5332 0.25977 0.19482 0.58106 0.19483 0.23584 0 0.46142-0.11279 0.09912-0.04101 0.22217-0.16065 0.12646-0.11963 0.65967-0.63574 0.7417-0.7417 0.82715-0.78613l0.08203-0.04102 8.09375-0.01367 0.16748-0.04102q0.25293-0.07178 0.44092-0.18115 0.18799-0.11279 0.36914-0.29394 0.18457-0.18457 0.29394-0.37256 0.11279-0.18799 0.18457-0.44092l0.04102-0.16748 0.01367-6.29932q-0.01367-0.81348-0.02734-1.08008-0.01367-0.19482-0.04102-0.33496-0.14014-0.4751-0.50586-0.81006-0.3623-0.33838-0.84082-0.4375-0.10938-0.02734-0.81006-0.02734l-4.21435 0-4.17334 0q-0.72803 0.01367-0.8374 0.02734z m9.78564 1.14843q0.30762 0.04102 0.43408 0.32129l0.04102 0.09912 0 7.28028-0.02735 0.08544q-0.12646 0.24951-0.35205 0.33497-0.05469 0.01367-4.10156 0.02734l-4.02978 0.01367-0.15723 0.02735q-0.13672 0.04443-0.26318 0.09912-0.21191 0.08545-0.36573 0.21191-0.15381 0.12305-0.60156 0.58447l-0.58789 0.57422 0.01367-9.23877 0.04102-0.09912q0.05811-0.12646 0.16748-0.21533 0.11279-0.09229 0.23242-0.11279 0.11963-0.02051 4.78174-0.02051 4.66211 0 4.7749 0.02734z m-6.35742 2.04395q-0.11279 0.02734-0.22559 0.11279-0.10938 0.08203-0.16748 0.19482-0.05469 0.11279-0.05469 0.25293 0 0.14014 0.06836 0.26661 0.03076 0.06836 0.58789 0.6289l0.56055 0.56055-0.56055 0.56055q-0.34863 0.34863-0.44775 0.46142-0.14014 0.15381-0.16748 0.23242-0.02734 0.0752-0.02734 0.20166 0 0.25293 0.16748 0.42041 0.12646 0.12646 0.28711 0.15381 0.16064 0.02734 0.32812-0.02734 0.07178-0.02734 0.17432-0.11963 0.10596-0.09229 0.49902-0.48193l0.57422-0.57422 0.57422 0.57422q0.39307 0.38965 0.4956 0.48193 0.10596 0.09229 0.17774 0.11963 0.16748 0.05469 0.32812 0.02734 0.16064-0.02734 0.28711-0.15381 0.16748-0.16748 0.16748-0.42041 0-0.12646-0.02734-0.20166-0.02734-0.07861-0.16748-0.23242-0.09912-0.11279-0.45117-0.46142l-0.55713-0.56055 0.55713-0.56055q0.54688-0.56055 0.59131-0.6289 0.05469-0.12646 0.06152-0.27344 0.00684-0.14697-0.06152-0.25977-0.03076-0.06836-0.11622-0.14355-0.08203-0.07861-0.17431-0.11963-0.08887-0.04443-0.22217-0.04443-0.1333 0-0.21191 0.03759-0.0752 0.03418-0.22901 0.15723-0.11279 0.11279-0.46142 0.46484l-0.56055 0.54346-0.56055-0.54346q-0.34863-0.35205-0.46826-0.46142-0.11963-0.11279-0.1914-0.14697-0.06836-0.0376-0.18116-0.05127-0.10938-0.01367-0.19482 0.01367z"
                  fill={activeTab === "cancelamentos" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Motivos de cancelamento"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "cancelamentos" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Cancelamentos
              </div>
            </button>

            {/* Aba Arena */}
            <button
              type="button"
              onClick={() => handleTabClick("arena")}
              data-pencil-name="Aba Configurações Arena"
              className={`box-border w-full h-[36px] shrink-0 flex flex-row gap-[10px] px-[10px] justify-start items-center rounded-[10px] transition-all cursor-pointer ${
                activeTab === "arena"
                  ? "bg-[#071915] text-[#FFFFFF]"
                  : "bg-transparent text-[#394236] hover:bg-[#F1EDE6]"
              }`}
            >
              <svg
                data-pencil-name="Ícone Aba Configurações Arena"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[15px] shrink-0 h-[15px]"
              >
                <path
                  d="M4.35449 1.20313q-0.43408 0.07178-0.77929 0.35205-0.3418 0.28027-0.50928 0.66992l-0.02735 0.04443q-0.05811 0.15381-0.07177 0.22217-0.02734 0.11279-0.02735 0.36572l-0.01367 2.39258-0.34863 0q-0.33838 0-0.47852 0.01367-0.4751 0.07178-0.85449 0.37256-0.37598 0.30078-0.55713 0.76221l-0.01367 0.02734q-0.04443 0.14014-0.05811 0.23926-0.01367 0.15381-0.02734 0.57422l0 1.67822q-0.01367 2.17041 0.01367 2.33789 0.02734 0.30762 0.16748 0.60156 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863l0.15381 0.05469 9.9668 0 0.15381-0.05469q0.36572-0.11279 0.65283-0.34863 0.28711-0.23926 0.44092-0.56397 0.14014-0.28027 0.18115-0.60156 0.01367-0.16748 0-3.20605l0-2.37891q0-0.54688-0.02734-0.72803-0.01367-0.12646-0.05811-0.25293l-0.02734-0.04101q-0.14014-0.37939-0.44092-0.66651-0.30078-0.28711-0.67676-0.39648-0.15723-0.05811-0.31787-0.07178-0.16065-0.01367-0.44092-0.01367l-0.34863 0 0-0.44775q0-0.29395-0.01367-0.38965-0.01367-0.09912-0.02735-0.18457-0.23926-0.81348-0.96728-1.14844-0.15381-0.06836-0.29395-0.11279l-0.14013-0.04102-2.57715 0q-2.5874 0-2.7002 0.02734z m5.20899 1.17578q0.2085 0.09912 0.30761 0.30761l0.04102 0.09912 0.01367 8.89014-1.17578 0 0-0.67334q0-0.55713-0.02051-0.74512-0.02051-0.19141-0.10595-0.3999-0.18115-0.43408-0.54004-0.72119-0.35547-0.28711-0.8169-0.35889-0.2666-0.04102-0.5332 0-0.46143 0.07178-0.82031 0.35889-0.35547 0.28711-0.53663 0.72119-0.08545 0.2085-0.10595 0.3999-0.02051 0.18799-0.02051 0.74512l0 0.67334-1.17578 0 0.01367-8.89014 0.04102-0.09912q0.07178-0.14014 0.18798-0.229 0.11963-0.09229 0.25977-0.11963 0.08545 0 2.47803 0l2.40967 0 0.09912 0.04102z m-3.83838 1.72265q-0.18115 0.02734-0.32129 0.18115-0.14014 0.15381-0.15381 0.35206 0 0.14014 0.06152 0.28027 0.06494 0.14014 0.19141 0.22217l0.01367 0.01367q0.06836 0.05811 0.15039 0.07178 0.08545 0.01367 0.35205 0.02734l1.96192 0q0.2666-0.01367 0.34863-0.02734 0.08545-0.01367 0.15381-0.07178l0.01367-0.01367q0.21191-0.14014 0.24609-0.36914 0.03418-0.23242-0.09912-0.43409-0.1333-0.20508-0.38281-0.23242-0.11279-0.02734-1.2749-0.02734-1.16211 0-1.26123 0.02734z m6.1455 0.60156q0.21192 0.08545 0.32471 0.29395l0.04102 0.09912 0 6.13184-0.04102 0.09912q-0.04443 0.08203-0.11621 0.16064-0.06836 0.0752-0.13672 0.11963-0.14014 0.06836-0.57422 0.06836l-0.29394 0 0-7 0.34863 0q0.23926 0 0.30762 0.00684 0.07178 0.00684 0.14013 0.0205z m-8.94482 4.34083l0 2.63183-0.29394 0q-0.43408 0-0.57422-0.06836-0.06836-0.04443-0.14014-0.11963-0.06836-0.07861-0.11279-0.16064l-0.04102-0.09912 0-4.38184 0.04102-0.09912q0.04443-0.08203 0.1333-0.16406 0.09229-0.08545 0.1914-0.12989 0.05469-0.01367 0.12989-0.0205 0.07861-0.00684 0.3042-0.00684l0.3623 0 0 2.61817z m2.70361-2.59083q-0.09912 0.04443-0.1914 0.12989-0.08887 0.08203-0.12647 0.16064-0.03418 0.0752-0.04101 0.11621-0.00684 0.04102-0.00684 0.14014 0 0.15381 0.04102 0.25293 0.11279 0.2085 0.3247 0.29394 0.06836 0.02734 0.24952 0.02735l1.12109 0 1.12109 0q0.18115 0 0.24952-0.02735 0.21191-0.08545 0.3247-0.29394 0.04102-0.09912 0.04102-0.25293 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.17431-0.11963-0.08203-0.0376-0.26319-0.0376l-1.12109 0-1.12109 0q-0.19482 0.01367-0.24952 0.02734z m1.62354 3.52735q0.18115 0.08545 0.2666 0.2666l0.05469 0.08545 0 1.34326-1.14844 0 0-1.34326 0.05469-0.08545q0.11279-0.22217 0.36572-0.30762 0.04102-0.01367 0.18115-0.00683 0.14014 0.00684 0.22559 0.04785z"
                  fill={activeTab === "arena" ? "#C9FF3B" : "#6F766F"}
                />
              </svg>
              <div
                data-pencil-name="Texto Aba Configurações Arena"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] text-left whitespace-nowrap ${
                  activeTab === "arena" ? "font-bold text-[#FFFFFF]" : "font-normal text-[#394236]"
                }`}
              >
                Arena
              </div>
            </button>
          </div>

          {/* Painel Configurações Quadras */}
          {(activeTab === "quadras" || (!["usuarios", "pagamentos", "notificacoes", "cancelamentos", "arena"].includes(activeTab))) && <div
            data-pencil-name="Painel Configurações Quadras"
            className="box-border flex-1 w-full min-w-0 flex flex-col gap-[14px] justify-start items-start"
          >
            {/* Resumo Quadras Configurações (3 Cards Métricas) */}
            <div
              data-pencil-name="Resumo Quadras Configurações"
              className="box-border w-full grid grid-cols-1 md:grid-cols-3 gap-[14px]"
            >
              {/* Card 1: Quadras Cadastradas */}
              <div
                data-pencil-name="Card Config Quadras cadastradas"
                className="box-border w-full h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm"
              >
                <div
                  data-pencil-name="Ícone Config Quadras cadastradas"
                  className="box-border w-[42px] shrink-0 h-[42px] flex flex-row justify-center items-center bg-[#EEF3FF] rounded-[14px]"
                >
                  <svg
                    data-pencil-name="Lucide Config Quadras cadastradas"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[18px] shrink-0 h-[18px]"
                  >
                    <path
                      d="M6.81885 0.60156q-0.25293 0.01367-0.44776 0.09912-0.14014 0.05469-2.44384 1.18946-2.30371 1.13477-2.38575 1.18945-0.23926 0.14014-0.33838 0.40674-0.0957 0.2666-0.01367 0.54687 0.07178 0.22217 0.23242 0.38282 0.16064 0.16064 0.39649 0.23242 0.08545 0.01367 5.18164 0.01367 5.09619 0 5.18164-0.01367 0.2085-0.05811 0.37598-0.21192 0.30762-0.27686 0.28027-0.7041-0.02734-0.42725-0.3623-0.65283-0.11279-0.06836-2.04395-1.02197l-2.36865-1.14844q-0.43408-0.2085-0.52979-0.23584-0.35205-0.11279-0.71435-0.07178z m0.3623 1.17578q0.08545 0.02734 1.79444 0.86817l1.71923 0.84082-1.8457 0.01367q-1.84912 0-3.69824 0l-1.8457-0.01367 1.70556-0.84082q1.72266-0.84082 1.80811-0.86817 0.18115-0.05469 0.3623 0z m-3.78027 4.07422q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m2.32422 0q-0.12646 0.01367-0.2461 0.10596-0.11621 0.08887-0.17431 0.21533l-0.04102 0.09912 0 4.38184 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-2.10205q0.01367-2.09863 0-2.21142-0.05469-0.23584-0.24609-0.36914-0.18799-0.1333-0.44092-0.09229z m2.35156 0q-0.18115 0.01367-0.31445 0.14698-0.1333 0.1333-0.17432 0.31445-0.01367 0.11279 0 2.21142l0 2.10205 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-4.34082-0.04102-0.0957q-0.08545-0.19824-0.25293-0.30079-0.16748-0.10596-0.37939-0.06494z m2.32422 0q-0.0957 0.01367-0.17432 0.05127-0.07519 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m-8.79102 6.41211q-0.12646 0.02734-0.23925 0.1333-0.10938 0.10596-0.16749 0.23243-0.06836 0.2085 0.01368 0.42724 0.08545 0.21533 0.29394 0.31445l0.1128 0.04102 10.75292 0 0.1128-0.04102q0.2085-0.11279 0.29053-0.32129 0.08545-0.21191 0.00683-0.4204-0.0752-0.21192-0.28369-0.32471l-0.09912-0.04102-5.36279-0.01367q-5.3457 0-5.43116 0.01367z"
                      fill="#2563EB"
                    />
                  </svg>
                </div>
                <div
                  data-pencil-name="Texto Config Quadras cadastradas"
                  className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Config Quadras cadastradas"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.7px] text-left whitespace-nowrap"
                  >
                    QUADRAS CADASTRADAS
                  </div>
                  <div
                    data-pencil-name="Valor Config Quadras cadastradas"
                    className="text-[22px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
                  >
                    {quadras.length} / {planoInfo?.plano?.max_quadras && planoInfo.plano.max_quadras > 0 ? planoInfo.plano.max_quadras : planoInfo ? "∞" : "—"}
                  </div>
                  <div
                    data-pencil-name="Desc Config Quadras cadastradas"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    {planoInfo ? `Quadras cadastradas no plano ${planoInfo.plano.nome}` : "Quadras cadastradas no plano atual"}
                  </div>
                </div>
              </div>

              {/* Card 2: Horário Padrão */}
              <div
                data-pencil-name="Card Config Horário padrão"
                className="box-border w-full h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm"
              >
                <div
                  data-pencil-name="Ícone Config Horário padrão"
                  className="box-border w-[42px] shrink-0 h-[42px] flex flex-row justify-center items-center bg-[#F1EDE6] rounded-[14px]"
                >
                  <svg
                    data-pencil-name="Lucide Config Horário padrão"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[18px] shrink-0 h-[18px]"
                  >
                    <path
                      d="M6.69238 0.60156q-1.16211 0.04102-2.22851 0.50586-1.06299 0.46143-1.90381 1.26807-0.8374 0.80322-1.34326 1.85254-0.48877 1.0083-0.60157 2.15674-0.02734 0.19482-0.02734 0.61523 0 0.42041 0.02734 0.61523 0.11279 1.14844 0.60157 2.15674 0.65967 1.40137 1.89697 2.33789 1.24072 0.93652 2.75146 1.20313 0.5332 0.09912 1.13477 0.09912 0.75537 0 1.43213-0.15381 0.68018-0.15381 1.35351-0.4751 1.26123-0.61865 2.16358-1.70215 0.90234-1.0835 1.25439-2.44384 0.29395-1.11768 0.18116-2.25244-0.11279-1.13477-0.60157-2.17041-0.58789-1.20313-1.62011-2.08497-1.02881-0.88184-2.31397-1.2749-1.0083-0.30762-2.15674-0.25293z m0.96729 1.18946q1.07666 0.14014 1.99267 0.68017 0.91602 0.54004 1.56201 1.4082 0.82715 1.104 1.00831 2.54639 0.01367 0.16748 0.01367 0.57422 0 0.40674-0.01367 0.57422-0.14014 1.16211-0.7212 2.12939-0.58105 0.96387-1.53466 1.62354-0.4751 0.33496-1.04932 0.56055-0.57422 0.22217-1.18945 0.30761-0.25293 0.04102-0.72803 0.04102-0.4751 0-0.72803-0.04102-1.07666-0.15381-1.95849-0.68701-0.88184-0.5332-1.52784-1.3877-0.82715-1.104-1.0083-2.54638-0.01367-0.16748-0.01367-0.57422 0-0.40674 0.01367-0.57422 0.14014-1.12109 0.66993-2.05078 0.5332-0.92969 1.43212-1.58936 0.54346-0.40674 1.20655-0.66992 0.6665-0.2666 1.32617-0.3247l0.25293-0.02735q0.0957-0.01367 0.4751 0 0.37939 0.01367 0.51953 0.02735z m-0.81348 1.14843q-0.25293 0.08545-0.37939 0.30762l-0.04102 0.08545 0 3.83496 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.15381 0.12646l0.08545 0.04102 2.46435 0q0.18115 0 0.26319-0.03418 0.08545-0.0376 0.16748-0.11963 0.08545-0.08545 0.1333-0.18799 0.05127-0.10596 0.05127-0.23242 0-0.12646-0.04102-0.23926-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-1.91748 0 0-3.09326-0.04102-0.08545q-0.09912-0.18115-0.28027-0.2666-0.08545-0.04102-0.22559-0.04785-0.14014-0.00684-0.18115 0.00683z"
                      fill="#071915"
                    />
                  </svg>
                </div>
                <div
                  data-pencil-name="Texto Config Horário padrão"
                  className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Config Horário padrão"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.7px] text-left whitespace-nowrap"
                  >
                    HORÁRIO PADRÃO
                  </div>
                  <div
                    data-pencil-name="Valor Config Horário padrão"
                    className="text-[22px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
                  >
                    {horarioResumo.valor}
                  </div>
                  <div
                    data-pencil-name="Desc Config Horário padrão"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    {horarioResumo.nota}
                  </div>
                </div>
              </div>

              {/* Card 3: Status Operacional */}
              <div
                data-pencil-name="Card Config Status operacional"
                className="box-border w-full h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm"
              >
                <div
                  data-pencil-name="Ícone Config Status operacional"
                  className="box-border w-[42px] shrink-0 h-[42px] flex flex-row justify-center items-center bg-[#EAF8EF] rounded-[14px]"
                >
                  <svg
                    data-pencil-name="Lucide Config Status operacional"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[18px] shrink-0 h-[18px]"
                  >
                    <path
                      d="M6.69238 0.60156q-1.16211 0.04102-2.22851 0.50586-1.06299 0.46143-1.90381 1.26807-0.8374 0.80322-1.34326 1.85254-0.48877 1.0083-0.60157 2.15674-0.02734 0.19482-0.02734 0.61523 0 0.42041 0.02734 0.61523 0.11279 1.14844 0.60157 2.15674 0.65967 1.40137 1.89697 2.33789 1.24072 0.93652 2.75146 1.20313 0.5332 0.09912 1.13477 0.09912 0.75537 0 1.43213-0.15381 0.68018-0.15381 1.35351-0.4751 1.26123-0.61865 2.16358-1.70215 0.90234-1.0835 1.25439-2.44384 0.29395-1.11768 0.18116-2.25244-0.11279-1.13477-0.60157-2.17041-0.58789-1.20313-1.62011-2.08497-1.02881-0.88184-2.31397-1.2749-1.0083-0.30762-2.15674-0.25293z m0.96729 1.18946q1.07666 0.14014 1.99267 0.68017 0.91602 0.54004 1.56201 1.4082 0.82715 1.104 1.00831 2.54639 0.01367 0.16748 0.01367 0.57422 0 0.40674-0.01367 0.57422-0.14014 1.16211-0.7212 2.12939-0.58105 0.96387-1.53466 1.62354-0.4751 0.33496-1.04932 0.56055-0.57422 0.22217-1.18945 0.30761-0.25293 0.04102-0.72803 0.04102-0.4751 0-0.72803-0.04102-1.07666-0.15381-1.95849-0.68701-0.88184-0.5332-1.52784-1.3877-0.82715-1.104-1.0083-2.54638-0.01367-0.16748-0.01367-0.57422 0-0.40674 0.01367-0.57422 0.14014-1.12109 0.66993-2.05078 0.5332-0.92969 1.43212-1.58936 0.54346-0.40674 1.20655-0.66992 0.6665-0.2666 1.32617-0.3247l0.25293-0.02735q0.0957-0.01367 0.4751 0 0.37939 0.01367 0.51953 0.02735z m0.95019 3.47265q-0.06836 0.02734-0.12646 0.05127-0.05469 0.02051-1.06299 1.02539l-0.99463 0.99463-0.40674-0.40332q-0.2666-0.2666-0.3623-0.33838-0.12646-0.11279-0.19824-0.14013-0.06836-0.02734-0.19483-0.02735-0.12646 0-0.16748 0.01367-0.04102 0.01367-0.09912 0.04102-0.18115 0.09912-0.28027 0.2666-0.04102 0.08545-0.04102 0.25293l0 0.01367q0 0.14014 0.03418 0.21192 0.0376 0.06836 0.17774 0.22216 0.0957 0.11279 0.48876 0.50586l0.04102 0.04102q0.42041 0.42041 0.55371 0.54687 0.1333 0.12305 0.20166 0.15381 0.14014 0.06836 0.29395 0.05469 0.15381-0.01367 0.28027-0.09912 0.07178-0.05469 1.28857-1.27149 0.86816-0.86816 1.04932-1.06298 0.18457-0.19824 0.21192-0.27002 0.0957-0.27686-0.05811-0.52295-0.15381-0.24609-0.44775-0.25977-0.12646-0.01367-0.18116 0z"
                      fill="#138A4B"
                    />
                  </svg>
                </div>
                <div
                  data-pencil-name="Texto Config Status operacional"
                  className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Label Config Status operacional"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.7px] text-left whitespace-nowrap"
                  >
                    STATUS OPERACIONAL
                  </div>
                  <div
                    data-pencil-name="Valor Config Status operacional"
                    className="text-[22px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
                  >
                    {quadrasAtivas > 0 ? "Ativa" : "Inativa"}
                  </div>
                  <div
                    data-pencil-name="Desc Config Status operacional"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Quadra disponível para reservas
                  </div>
                </div>
              </div>
            </div>

            {/* Gestão de Quadras Configurações (Tabela de Quadras) */}
            <div
              data-pencil-name="Gestão de Quadras Configurações"
              className="box-border w-full flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] overflow-hidden shadow-sm"
            >
              {/* Header Quadras */}
              <div
                data-pencil-name="Header Quadras Configurações"
                className="box-border w-full h-[63.5px] shrink-0 flex flex-row px-[22px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
              >
                <div
                  data-pencil-name="Título Header Quadras Config"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Título Quadras Configurações"
                    className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Quadras
                  </div>
                  <div
                    data-pencil-name="Sub Quadras Configurações"
                    className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    {loadingPlano || loading ? "Carregando plano e quadras..." : planoInfo
                      ? `Plano ${planoInfo.plano.nome}: ${quadras.length}${planoInfo.plano.max_quadras > 0 ? `/${planoInfo.plano.max_quadras}` : " (sem limite)"} quadras cadastradas`
                      : `${quadras.length} quadras cadastradas · Plano indisponível`}
                  </div>
                </div>

                {/* Botão Nova Quadra */}
                <button
                  type="button"
                  onClick={openNewQuadraModal}
                  data-pencil-name="Nova Quadra Configurações"
                  className="cursor-pointer hover:bg-neutral-800 transition-colors box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[14px] justify-start items-center bg-[#071915] rounded-[10px] shadow-sm active:scale-95"
                >
                  <svg
                    data-pencil-name="Ícone Nova Quadra Config"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[15px] shrink-0 h-[15px]"
                  >
                    <path
                      d="M6.90088 2.35156q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.32812l0 3.40088-3.66748 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.33838 0.03418l3.40088 0 0 3.40088q0 0.25293 0.03418 0.33838 0.0376 0.08203 0.11963 0.16748 0.08545 0.08203 0.18799 0.1333 0.10596 0.04785 0.23242 0.04785 0.12646 0 0.229-0.04785 0.10596-0.05127 0.18799-0.1333 0.08545-0.08545 0.11963-0.16748 0.0376-0.08545 0.0376-0.33838l0-3.40088 3.40088 0q0.25293 0 0.33496-0.03418 0.08545-0.0376 0.16748-0.11963 0.08545-0.08545 0.1333-0.18799 0.05127-0.10596 0.05127-0.23242 0-0.12646-0.04102-0.23926-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-3.66748 0 0-3.38721q0-0.2666-0.02734-0.32128-0.07178-0.19824-0.25293-0.30079-0.18115-0.10596-0.39307-0.06494z"
                      fill="#C9FF3B"
                    />
                  </svg>
                  <div
                    data-pencil-name="Texto Nova Quadra Config"
                    className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Nova quadra
                  </div>
                </button>
              </div>

              {/* Tabela com Scroll Horizontal Seguro */}
              <div className="w-full overflow-x-hidden">
                <div className="w-full min-w-0">
                  {/* Colunas Cabeçalho */}
                  <div
                    data-pencil-name="Colunas Quadras Config"
                    className="box-border w-full h-[39.5px] shrink-0 flex flex-row gap-[14px] px-[22px] justify-start items-center border-b border-[#F0EBE4] bg-[#FFFFFF]"
                  >
                    <div
                      data-pencil-name="Coluna Quadras NOME"
                      className="text-[10px]/[normal] box-border w-[130px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                    >
                      NOME
                    </div>
                    <div
                      data-pencil-name="Coluna Quadras STATUS"
                      className="text-[10px]/[normal] box-border w-[80px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                    >
                      STATUS
                    </div>
                    <div
                      data-pencil-name="Coluna Quadras AÇÕES"
                      className="text-[10px]/[normal] box-border w-[150px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                    >
                      AÇÕES
                    </div>
                    <div
                      data-pencil-name="Coluna Quadras MODALIDADE"
                      className="text-[10px]/[normal] box-border flex-1 min-w-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                    >
                      MODALIDADE
                    </div>
                    <div
                      data-pencil-name="Coluna Quadras HORÁRIO"
                      className="text-[10px]/[normal] box-border w-[110px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                    >
                      HORÁRIO
                    </div>
                  </div>

                  {/* Linhas de Quadras */}
                  {loading && quadras.length === 0 ? (
                    <div className="p-8 text-center text-[#6F766F] text-sm">
                      Carregando quadras...
                    </div>
                  ) : (
                    quadras.map((quadra) => {
                      const isAtiva =
                        quadra.status === "Ativa" ||
                        (quadra.status !== "Inativa" && quadra.ativa !== false);

                      const modalidadesList: string[] = Array.isArray(quadra.modalidades)
                        ? quadra.modalidades.map((m) =>
                            typeof m === "string" ? m : m.nome
                          )
                        : ["Beach Tennis"];

                      const precoFormatado = formatCurrency(
                        quadra.preco_base || quadra.preco_hora || 80
                      );

                      const horarioFormatado =
                        quadra.hora_abertura && quadra.hora_fechamento
                          ? `${quadra.hora_abertura.slice(0, 5)} — ${quadra.hora_fechamento.slice(0, 5)}`
                          : "07:00 — 22:00";

                      return (
                        <div
                          key={quadra.id}
                          className="box-border w-full h-[69.5px] shrink-0 flex flex-row gap-[14px] px-[22px] justify-start items-center border-b border-[#F4EFE8] hover:bg-[#FAF7F2] transition-colors"
                        >
                          {/* Nome e Preço */}
                          <div className="order-1 box-border w-[130px] shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start">
                            <div className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-[125px]">
                              {quadra.nome}
                            </div>
                            <div className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap">
                              {precoFormatado}/h
                            </div>
                          </div>

                          {/* Modalidades Pills */}
                          <div className="order-4 box-border flex-1 min-w-0 h-fit flex flex-row flex-wrap gap-[4px] justify-start items-center">
                            {modalidadesList.slice(0, 3).map((mod, idx) => {
                              const style =
                                MODALITY_STYLES[mod] || {
                                  bg: "bg-[#F1EDE6]",
                                  text: "text-[#394236]",
                                  dot: "bg-[#394236]",
                                };
                              return (
                                <div
                                  key={idx}
                                  className={`box-border w-fit shrink-0 h-[22px] flex flex-row gap-[5px] px-[8px] justify-start items-center rounded-[11px] ${style.bg}`}
                                >
                                  <div
                                    className={`box-border w-[6px] shrink-0 h-[6px] rounded-full ${style.dot}`}
                                  ></div>
                                  <div
                                    className={`text-[10px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${style.text}`}
                                  >
                                    {mod}
                                  </div>
                                </div>
                              );
                            })}
                            {modalidadesList.length > 3 && (
                              <div className="box-border w-fit shrink-0 h-[22px] flex flex-row gap-[5px] px-[8px] justify-start items-center bg-[#F1EDE6] rounded-[11px]">
                                <div className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                                  +{modalidadesList.length - 3}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Horário */}
                          <div className="order-5 text-[12px]/[normal] box-border w-[110px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                            {horarioFormatado}
                          </div>

                          {/* Status */}
                          <div className="order-2 box-border w-[80px] shrink-0">
                            <div
                              className={`box-border w-[80px] h-[24px] flex flex-row justify-center items-center rounded-[12px] ${
                                isAtiva ? "bg-[#EAF8EF]" : "bg-[#F1EDE6]"
                              }`}
                            >
                              <div
                                className={`text-[10px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                  isAtiva ? "text-[#138A4B]" : "text-[#6F766F]"
                                }`}
                              >
                                {isAtiva ? "Ativa" : "Inativa"}
                              </div>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="order-3 box-border w-[150px] shrink-0 h-fit flex flex-row gap-[6px] justify-start items-center">
                            <button
                              type="button"
                              onClick={() => openEditQuadraModal(quadra)}
                              className="cursor-pointer hover:bg-neutral-800 transition-colors box-border w-fit shrink-0 h-[28px] flex flex-row px-[10px] justify-center items-center bg-[#071915] rounded-[8px]"
                            >
                              <span className="text-[11px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                                Editar
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={updatingStatusId !== null}
                              onClick={() =>
                                handleToggleStatus(quadra.id, isAtiva ? "Ativa" : "Inativa")
                              }
                              className="cursor-pointer hover:bg-neutral-100 transition-colors box-border w-fit shrink-0 h-[28px] px-[10px] flex flex-row justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px]"
                            >
                              <span
                                className={`box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                  isAtiva ? "text-[11px]" : "text-[10px]"
                                }`}
                              >
                                {isAtiva ? "Desativar" : "Ativar"}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer salvar quadras */}
            <div
              data-pencil-name="Footer quadras config"
              className="box-border w-full flex flex-row justify-end items-center -mt-[2px]"
            >
              <button
                type="button"
                onClick={() => showToast("Todas as alterações foram salvas!")}
                data-pencil-name="Salvar quadras config"
                className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[17px] justify-start items-center bg-[#071915] hover:bg-neutral-800 transition-colors rounded-[10px] cursor-pointer shadow-sm"
              >
                <Save className="box-border w-[15px] shrink-0 h-[15px] text-[#C9FF3B]" />
                <span
                  data-pencil-name="Texto salvar quadras"
                  className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                >
                  Salvar configurações
                </span>
              </button>
            </div>

            {/* Ajuda / Banner Inferior */}
            <div
              data-pencil-name="Ajuda Configurações"
              className="box-border w-full min-h-[58px] py-3 shrink-0 flex flex-row gap-[12px] px-[14px] justify-start items-center bg-[#071915] rounded-[16px] shadow-sm"
            >
              <svg
                data-pencil-name="Ícone Ajuda Configurações"
                viewBox="0 0 13.99993896484375 14"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
                className="box-border w-[18px] shrink-0 h-[18px]"
              >
                <path
                  d="M6.69238 0.60156q-1.16211 0.04102-2.22851 0.50586-1.06299 0.46143-1.90381 1.26807-0.8374 0.80322-1.34326 1.85254-0.48877 1.0083-0.60157 2.15674-0.02734 0.19482-0.02734 0.61523 0 0.42041 0.02734 0.61523 0.11279 1.14844 0.60157 2.15674 0.65967 1.40137 1.89697 2.33789 1.24072 0.93652 2.75146 1.20313 0.5332 0.09912 1.13477 0.09912 0.75537 0 1.43213-0.15381 0.68018-0.15381 1.35351-0.4751 1.26123-0.61865 2.16358-1.70215 0.90234-1.0835 1.25439-2.44384 0.29395-1.11768 0.18116-2.25244-0.11279-1.13477-0.60157-2.17041-0.58789-1.20313-1.62011-2.08497-1.02881-0.88184-2.31397-1.2749-1.0083-0.30762-2.15674-0.25293z m0.96729 1.18946q1.07666 0.14014 1.99267 0.68017 0.91602 0.54004 1.56201 1.4082 0.82715 1.104 1.00831 2.54639 0.01367 0.16748 0.01367 0.57422 0 0.40674-0.01367 0.57422-0.14014 1.16211-0.7212 2.12939-0.58105 0.96387-1.53466 1.62354-0.4751 0.33496-1.04932 0.56055-0.57422 0.22217-1.18945 0.30761-0.25293 0.04102-0.72803 0.04102-0.4751 0-0.72803-0.04102-1.07666-0.15381-1.95849-0.68701-0.88184-0.5332-1.52784-1.3877-0.82715-1.104-1.0083-2.54638-0.01367-0.16748-0.01367-0.57422 0-0.40674 0.01367-0.57422 0.14014-1.12109 0.66993-2.05078 0.5332-0.92969 1.43212-1.58936 0.54346-0.40674 1.20655-0.66992 0.6665-0.2666 1.32617-0.3247l0.25293-0.02735q0.0957-0.01367 0.4751 0 0.37939 0.01367 0.51953 0.02735z m-0.75879 2.31054q-0.18115 0.02734-0.32129 0.16748-0.2085 0.21191-0.15381 0.50586 0.05469 0.29395 0.32129 0.42041 0.09912 0.04102 0.25293 0.04102 0.25293 0 0.42041-0.16748 0.12646-0.12646 0.15381-0.30762 0.05469-0.29395-0.15723-0.50244-0.2085-0.21191-0.51611-0.15723z m-0.05469 2.33789q-0.25293 0.08545-0.37939 0.30762l-0.04102 0.08545 0 2.46436q0 0.18115 0.03418 0.2666 0.0376 0.08203 0.11963 0.16748 0.08545 0.08203 0.18799 0.1333 0.10596 0.04785 0.23242 0.04785 0.12646 0 0.229-0.04785 0.10596-0.05127 0.18799-0.1333 0.08545-0.08545 0.11963-0.16748 0.0376-0.08545 0.0376-0.2666l0-2.46436-0.04102-0.08545q-0.09912-0.18115-0.28027-0.2666-0.08545-0.04102-0.22559-0.04785-0.14014-0.00684-0.18115 0.00683z"
                  fill="#C9FF3B"
                />
              </svg>
              <div
                data-pencil-name="Texto Ajuda Configurações"
                className="text-[12px]/[normal] box-border flex-1 text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-normal text-left"
              >
                Alterações em quadras impactam horários disponíveis, preços e reservas futuras.
              </div>
            </div>
          </div>}

          <div hidden={activeTab !== "arena"} className="flex-1 w-full min-w-0">
            <AdminArenaConfiguracoes />
          </div>

          {/* Painel Usuários */}
          {activeTab === "usuarios" && (
            <div
              data-pencil-name="Painel Configurações Usuários"
              className="box-border flex-1 w-full min-w-0 flex flex-col gap-[14px] justify-start items-start font-[Inter,system-ui,sans-serif]"
            >
              {/* Gestão de Usuários */}
              <div
                data-pencil-name="Gestão de Usuários"
                className="box-border w-full h-fit shrink-0 flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-[0.5px] rounded-[18px] overflow-hidden"
              >
                {/* Header Usuários */}
                <div
                  data-pencil-name="Header Usuários"
                  className="box-border w-full h-[69.5px] shrink-0 flex flex-row gap-0 px-[22px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
                >
                  <div
                    data-pencil-name="Título Usuários"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Título Gestão Usuários"
                      className="text-[16px] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Usuários do sistema
                    </div>
                    <div
                      data-pencil-name="Nota Plano Usuários"
                      className="text-[11px] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                    >
                      {planoInfo
                        ? `Plano ${planoInfo.plano.nome} · ${planoInfo.uso.usuarios_usados} de ${
                            planoInfo.plano.max_usuarios > 0 ? planoInfo.plano.max_usuarios : "∞"
                          } usuários`
                        : `Plano Básico · ${usuarios.length} de 3 usuários`}
                    </div>
                  </div>
                  <div
                    data-pencil-name="Ações Usuários"
                    className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNovoAdminId("");
                        setTransferPassword("");
                        setTransferError("");
                        setModalTransferirOpen(true);
                      }}
                      disabled={currentUser?.perfil !== "Administrador" || loadingUsuarios}
                      data-pencil-name="Transferir administração"
                      className="cursor-pointer box-border w-fit shrink-0 h-[36px] flex flex-row gap-[7px] px-[12px] justify-start items-center outline outline-1 outline-[#E6DED2] -outline-offset-[0.5px] rounded-[9px] hover:bg-[#FAF8F4] transition-colors"
                    >
                      <svg
                        data-pencil-name="Ícone transferir"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[14px] shrink-0 h-[14px]"
                      >
                        <path
                          d="M9.12939 1.20313q-0.09912 0.04443-0.1914 0.12988-0.08887 0.08203-0.1333 0.17431-0.04102 0.08887-0.04102 0.22901l0 0.02734q0 0.12646 0.02735 0.19824 0.02734 0.06836 0.18457 0.23584 0.0957 0.11279 0.50244 0.50586l0.78271 0.79639-3.98877 0q-3.9751 0-4.06738 0.02051-0.09229 0.02051-0.18457 0.07861-0.08887 0.05469-0.15723 0.14014-0.12646 0.16748-0.11279 0.38623 0.01367 0.21533 0.18115 0.36914 0.12646 0.12646 0.29395 0.15381 0.11279 0.02734 4.06054 0.02734l3.96143 0-0.70068 0.68701q-0.44775 0.46143-0.58106 0.60157-0.12988 0.14014-0.16064 0.20849-0.10938 0.23926-0.01367 0.46485 0.09912 0.22217 0.32128 0.32128 0.22559 0.0957 0.46485-0.01367 0.06836-0.03076 0.29053-0.23926 0.22559-0.2085 1.05273-1.04931 1.23047-1.23389 1.27149-1.32276 0.04443-0.09229 0.04443-0.24609l0-0.04102q0.01367-0.11279-0.02735-0.19824-0.07178-0.0957-0.30761-0.34863-0.1709-0.16748-0.79981-0.81348l-0.19482-0.18115q-1.23389-1.24414-1.32617-1.28516-0.08887-0.04443-0.22901-0.04443-0.14014 0-0.22217 0.02734z m-4.60742 5.81054q-0.08545 0.02734-0.16748 0.08545-0.11279 0.08203-0.37939 0.36231l-0.89551 0.88183q-1.23047 1.23389-1.2749 1.32617-0.04102 0.08887-0.04102 0.24268l0 0.04102q-0.01367 0.11279 0.02735 0.19824 0.07178 0.0957 0.30761 0.34863 0.1709 0.18115 0.81348 0.81348l0.19482 0.19482q0.88184 0.88184 1.07666 1.07324 0.19824 0.18799 0.27002 0.21534 0.2085 0.06836 0.42383-0.01368 0.21875-0.08545 0.31787-0.28027 0.04102-0.09912 0.04102-0.23926l0-0.02734q0-0.12646-0.02735-0.19483-0.02734-0.07178-0.18457-0.23925-0.0957-0.11279-0.50244-0.50586l-0.78271-0.79639 7.14013 0q0.69726-0.01367 0.89551-0.02734 0.14014-0.01367 0.19483-0.05811l0.02734-0.02734q0.21191-0.14014 0.24609-0.36914 0.03418-0.23242-0.09912-0.43409-0.1333-0.20508-0.38281-0.23242-0.11279-0.02734-4.06055-0.02734l-3.94775 0 0.70068-0.68701q0.44775-0.46143 0.57764-0.60157 0.1333-0.14014 0.16406-0.20849 0.0957-0.22559 0.01026-0.44776-0.08203-0.22559-0.3042-0.3247-0.07178-0.04102-0.19141-0.04785-0.11963-0.00684-0.18799 0.00683z"
                          fill="#4F5550"
                        />
                      </svg>
                      <div
                        data-pencil-name="Texto transferir"
                        className="text-[11px] box-border text-[#4F5550] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        Transferir administração
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={openNovoUsuarioModal}
                      data-pencil-name="Novo Usuário"
                      className="cursor-pointer box-border w-fit shrink-0 h-[38px] flex flex-row gap-[7px] px-[14px] justify-start items-center bg-[#071915] hover:bg-neutral-800 transition-colors rounded-[10px] shadow-sm"
                    >
                      <svg
                        data-pencil-name="Ícone novo usuário"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[15px] shrink-0 h-[15px]"
                      >
                        <path
                          d="M4.84326 1.20313q-0.81006 0.11279-1.42871 0.61865-0.61523 0.50244-0.89551 1.24414-0.18115 0.48877-0.18115 1.02197 0 0.28027 0.04102 0.50586 0.04443 0.22217 0.14013 0.48877 0.15381 0.46143 0.46826 0.84766 0.31787 0.38281 0.7212 0.63574 0.36572 0.22559 0.73486 0.32471 0.37256 0.0957 0.80664 0.0957 0.22559 0 0.3623-0.01367 0.14014-0.01367 0.35206-0.05811 0.60156-0.15381 1.104-0.55713 0.50586-0.40674 0.7998-0.98096 0.19482-0.39307 0.26661-0.88183 0.02734-0.14014 0.02734-0.40674 0-0.2666-0.02734-0.40674-0.09912-0.65625-0.46485-1.20312-0.3623-0.54688-0.93652-0.89551-0.43408-0.2666-0.98096-0.36572-0.15381-0.02734-0.45459-0.03418-0.30078-0.00684-0.45459 0.02051z m0.60156 1.14843q0.40674 0.02734 0.78272 0.28711 0.37939 0.25977 0.58105 0.65967 0.20508 0.39648 0.18457 0.88184-0.02051 0.48193-0.28711 0.86132-0.15381 0.23584-0.37939 0.41358-0.22217 0.17432-0.46143 0.27002-0.19482 0.05811-0.2871 0.07861-0.08887 0.02051-0.32813 0.02051-0.23926 0-0.33154-0.02051-0.08887-0.02051-0.28369-0.07861-0.39307-0.14014-0.68018-0.46826-0.28711-0.32813-0.3999-0.73487-0.10938-0.46143 0.01367-0.90918 0.12646-0.44775 0.45459-0.76904 0.33154-0.32471 0.79297-0.45117 0.08545-0.02734 0.24609-0.04785 0.16064-0.02051 0.21533-0.00684l0.16748 0.01367z m5.53028 1.75q-0.12646 0.01367-0.2461 0.10596-0.11621 0.08887-0.17431 0.21533l-0.04102 0.09912-0.01367 1.30225-0.57422 0q-0.57422 0-0.68701 0.02734-0.24951 0.02734-0.38281 0.23242-0.1333 0.20166-0.09912 0.43409 0.03418 0.229 0.24609 0.36914 0.10938 0.08545 0.229 0.09912 0.11963 0.01367 0.63916 0.01367l0.62891 0 0 0.62891q0 0.51953 0.01367 0.63916 0.01367 0.11963 0.09912 0.229 0.15381 0.22559 0.417 0.24609 0.2666 0.02051 0.46484-0.17431 0.12646-0.11279 0.15381-0.2666 0.02734-0.15381 0.02734-0.71436l0-0.58789 1.30225-0.01367 0.09912-0.04102q0.08203-0.04443 0.15722-0.11279 0.07861-0.07178 0.1128-0.14014 0.0376-0.07178 0.05127-0.18115 0.04101-0.19824-0.05127-0.36572-0.08887-0.16748-0.28369-0.2666l-0.09913-0.04102-1.28857-0.01367 0-0.58789q0-0.57422-0.02734-0.67334-0.04102-0.23584-0.23242-0.36914-0.18799-0.1333-0.44092-0.09229z m-7.88184 4.10156q-0.96387 0.14014-1.65088 0.82715-0.54687 0.54688-0.75537 1.31592-0.07178 0.23926-0.08545 0.44092-0.01367 0.20166-0.01367 0.82031l0 0.76904 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-0.79639q0.01367-0.61865 0.02734-0.77246 0.01367-0.15381 0.07178-0.34863 0.14014-0.37939 0.46826-0.68018 0.32813-0.30078 0.73487-0.41357 0.15381-0.04102 0.53662-0.05469 0.38623-0.01367 1.66113-0.01367 1.2749 0 1.65771 0.01367 0.38623 0.01367 0.54004 0.05469 0.42041 0.11279 0.75538 0.43066 0.33838 0.31445 0.46142 0.71778 0.05811 0.16748 0.06494 0.3247 0.00684 0.15381 0.02051 0.7417l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-0.76904q0-0.61865-0.01367-0.82031-0.01367-0.20166-0.08545-0.44092-0.08203-0.32129-0.23584-0.61523-0.2666-0.51953-0.73828-0.90235-0.46826-0.38623-1.02539-0.54004l-0.04444-0.01367q-0.16748-0.05811-0.29394-0.07178-0.15381-0.01367-0.56055-0.01367l-1.60986-0.01367q-2.05762 0-2.21143 0.02734z"
                          fill="#C9FF3B"
                        />
                      </svg>
                      <div
                        data-pencil-name="Texto novo usuário"
                        className="text-[12px] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Novo usuário
                      </div>
                    </button>
                  </div>
                </div>

                {/* Colunas Usuários */}
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <div className="w-full min-w-[760px]">
                    <div
                      data-pencil-name="Colunas Usuários"
                      className="box-border w-full h-[39.5px] shrink-0 flex flex-row gap-[12px] px-[22px] justify-start items-center border-b border-[#F0EBE4]"
                    >
                      <div
                        data-pencil-name="Coluna NOME"
                        className="text-[10px] box-border w-[150px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        NOME
                      </div>
                      <div
                        data-pencil-name="Coluna E-MAIL"
                        className="text-[10px] box-border w-[180px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        E-MAIL
                      </div>
                      <div
                        data-pencil-name="Coluna PERFIL"
                        className="text-[10px] box-border w-[130px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        PERFIL
                      </div>
                      <div
                        data-pencil-name="Coluna ÚLTIMO ACESSO"
                        className="text-[10px] box-border w-[130px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        ÚLTIMO ACESSO
                      </div>
                      <div
                        data-pencil-name="Coluna STATUS"
                        className="text-[10px] box-border w-[80px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        STATUS
                      </div>
                      <div
                        data-pencil-name="Coluna AÇÕES"
                        className="text-[10px] box-border w-[70px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.5px] text-left"
                      >
                        AÇÕES
                      </div>
                    </div>

                    {/* Linhas de Usuários */}
                    {loadingUsuarios ? (
                      <div className="p-10 text-center text-[#6F766F] text-[13px]">
                        Carregando usuários...
                      </div>
                    ) : usuarios.length === 0 ? (
                      <div className="p-10 text-center text-[#6F766F] text-[13px]">
                        Nenhum usuário cadastrado.
                      </div>
                    ) : (
                      usuarios.map((u) => {
                        const ultimoAcessoStr = u.ultimo_acesso
                          ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR")
                          : u.criado_em
                          ? `Hoje, ${new Date(u.criado_em).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Hoje, 09:42";

                        const isGerente = u.perfil === "Gerente";
                        const isAdmin = u.perfil === "Administrador";

                        return (
                          <div
                            key={u.id}
                            data-pencil-name={`Usuário ${u.nome}`}
                            className="box-border w-full h-[65.5px] shrink-0 flex flex-row gap-[12px] px-[22px] justify-start items-center border-b border-[#F4EFE8] hover:bg-[#FBFAF7]/60 transition-colors"
                          >
                            <div
                              data-pencil-name={`Nome ${u.nome}`}
                              className="text-[12px] box-border w-[150px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left truncate"
                            >
                              {u.nome}
                            </div>
                            <div
                              data-pencil-name={`Email ${u.nome}`}
                              className="text-[12px] box-border w-[180px] shrink-0 text-[#4F5550] font-[Inter,system-ui,sans-serif] font-medium text-left truncate"
                            >
                              {u.email}
                            </div>
                            <div
                              data-pencil-name={`Perfil ${u.nome}`}
                              className="box-border w-[130px] shrink-0 h-fit flex flex-row gap-0 justify-start items-start"
                            >
                              <div
                                className={`box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[9px] py-[5px] justify-start items-start rounded-[999px] ${
                                  isAdmin
                                    ? "bg-[#EAF8EF]"
                                    : isGerente
                                    ? "bg-[#E9F1FF]"
                                    : "bg-[#F1EDE6]"
                                }`}
                              >
                                <div
                                  className={`text-[10px] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                    isAdmin
                                      ? "text-[#1F7A45]"
                                      : isGerente
                                      ? "text-[#2457C5]"
                                      : "text-[#7A7066]"
                                  }`}
                                >
                                  {u.perfil}
                                </div>
                              </div>
                            </div>
                            <div
                              data-pencil-name={`Acesso ${u.nome}`}
                              className="text-[11px] box-border w-[130px] shrink-0 text-[#4F5550] font-[Inter,system-ui,sans-serif] font-medium text-left truncate"
                            >
                              {ultimoAcessoStr}
                            </div>
                            <div
                              data-pencil-name={`Status ${u.nome}`}
                              className="box-border w-[80px] shrink-0 h-fit flex flex-row gap-[6px] justify-start items-center"
                            >
                              <div className="box-border w-[7px] shrink-0 h-[7px] bg-[#2BAE66] rounded-full" />
                              <div className="text-[11px] box-border text-[#31704A] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap">
                                Ativo
                              </div>
                            </div>
                            <div
                              data-pencil-name={`Editar ${u.nome}`}
                              className="box-border w-[70px] shrink-0 h-fit flex flex-row gap-0 justify-start items-center"
                            >
                              <button
                                type="button"
                                disabled={!canManageUser(u)}
                                onClick={() => openEditarUsuarioModal(u)}
                                className="box-border w-[70px] shrink-0 h-[30px] flex flex-row justify-center items-center outline outline-1 outline-[#D8D0C4] -outline-offset-[0.5px] rounded-[8px] text-[11px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-center whitespace-nowrap hover:bg-[#FAF8F4] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Capacidade da equipe */}
              {(() => {
                const maxVagas = planoInfo?.plano?.max_usuarios ?? 0;
                const usados = planoInfo ? planoInfo.uso.usuarios_usados : usuarios.length;
                const planoNome = planoInfo?.plano?.nome;
                const pct = maxVagas > 0 ? Math.min((usados / maxVagas) * 100, 100) : 100;
                return (
                  <div
                    data-pencil-name="Capacidade da equipe"
                    className="box-border w-full min-h-[116px] md:h-[116px] shrink-0 flex flex-col md:flex-row gap-[20px] px-[22px] py-4 md:py-0 justify-start items-center bg-[#071915] rounded-[18px]"
                  >
                    <div
                      data-pencil-name="Texto capacidade equipe"
                      className="box-border flex-1 md:[flex:1_1_0] w-full shrink-0 h-fit flex flex-row gap-[14px] justify-start items-center"
                    >
                      <div
                        data-pencil-name="Ícone capacidade equipe"
                        className="box-border w-[46px] shrink-0 h-[46px] flex flex-row justify-center items-center bg-[#C9FF3B] rounded-[14px]"
                      >
                        <svg
                          data-pencil-name="Símbolo capacidade equipe"
                          viewBox="0 0 13.99993896484375 14"
                          preserveAspectRatio="xMidYMid meet"
                          xmlns="http://www.w3.org/2000/svg"
                          className="box-border w-[21px] shrink-0 h-[21px]"
                        >
                          <path
                            d="M4.84326 1.20313q-0.81006 0.11279-1.42871 0.61865-0.61523 0.50244-0.89551 1.24414-0.18115 0.48877-0.18115 1.02197 0 0.28027 0.04102 0.50586 0.04443 0.22217 0.14013 0.48877 0.15381 0.46143 0.46826 0.84766 0.31787 0.38281 0.7212 0.63574 0.36572 0.22559 0.73486 0.32471 0.37256 0.0957 0.80664 0.0957 0.22559 0 0.3623-0.01367 0.14014-0.01367 0.35206-0.05811 0.60156-0.15381 1.104-0.55713 0.50586-0.40674 0.7998-0.98096 0.19482-0.39307 0.26661-0.88183 0.02734-0.14014 0.02734-0.40674 0-0.2666-0.02734-0.40674-0.09912-0.65625-0.46485-1.20312-0.3623-0.54688-0.93652-0.89551-0.43408-0.2666-0.98096-0.36572-0.15381-0.02734-0.45459-0.03418-0.30078-0.00684-0.45459 0.02051z m4.34082 0.0581q-0.14014 0.04102-0.25293 0.14014-0.11279 0.0957-0.15381 0.2666-0.04102 0.16748 0 0.32129 0.04102 0.15381 0.15381 0.25293 0.11279 0.0957 0.33838 0.18115 0.24951 0.08203 0.40332 0.17432 0.15381 0.08887 0.30762 0.25976 0.33838 0.33496 0.45459 0.76904 0.11963 0.43408 0.01367 0.86817-0.10254 0.43408-0.41699 0.76904-0.31445 0.33496-0.7793 0.48877-0.19482 0.07178-0.28711 0.14356-0.08887 0.06836-0.16064 0.20849-0.05469 0.09912-0.05469 0.23926 0 0.13672 0.05469 0.23584 0.08545 0.19482 0.28027 0.29395 0.12646 0.05811 0.25293 0.05126 0.12646-0.01025 0.33496-0.07861 0.35205-0.11279 0.6084-0.27344 0.25977-0.16064 0.5127-0.42724 0.78271-0.78271 0.85449-1.84912 0.09912-1.18945-0.70069-2.12598-0.48877-0.58789-1.2749-0.85449-0.33496-0.11279-0.48877-0.05469z m-3.73926 1.09033q0.40674 0.02734 0.78272 0.28711 0.37939 0.25977 0.58105 0.65967 0.20508 0.39648 0.18457 0.88184-0.02051 0.48193-0.28711 0.86132-0.15381 0.23584-0.37939 0.41358-0.22217 0.17432-0.46143 0.27002-0.19482 0.05811-0.2871 0.07861-0.08887 0.02051-0.32813 0.02051-0.23926 0-0.33154-0.02051-0.08887-0.02051-0.28369-0.07861-0.39307-0.14014-0.68018-0.46826-0.28711-0.32813-0.3999-0.73487-0.10938-0.46143 0.01367-0.90918 0.12646-0.44775 0.45459-0.76904 0.33154-0.32471 0.79297-0.45117 0.08545-0.02734 0.24609-0.04785 0.16064-0.02051 0.21533-0.00684l0.16748 0.01367z m-2.35156 5.85156q-0.96387 0.14014-1.65088 0.82715-0.54687 0.54688-0.75537 1.31592-0.07178 0.23926-0.08545 0.44092-0.01367 0.20166-0.01367 0.82031l0 0.76904 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-0.79639q0.01367-0.61865 0.02734-0.77246 0.01367-0.15381 0.07178-0.34863 0.14014-0.37939 0.46826-0.68018 0.32813-0.30078 0.73487-0.41357 0.15381-0.04102 0.53662-0.05469 0.38623-0.01367 1.66113-0.01367 1.2749 0 1.65771 0.01367 0.38623 0.01367 0.54004 0.05469 0.42041 0.11279 0.75538 0.43066 0.33838 0.31445 0.46142 0.71778 0.05811 0.16748 0.06494 0.3247 0.00684 0.15381 0.02051 0.7417l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-0.76904q0-0.61865-0.01367-0.82031-0.01367-0.20166-0.08545-0.44092-0.08203-0.32129-0.23584-0.61523-0.2666-0.51953-0.73828-0.90235-0.46826-0.38623-1.02539-0.54004l-0.04444-0.01367q-0.16748-0.05811-0.29394-0.07178-0.15381-0.01367-0.56055-0.01367l-1.60986-0.01367q-2.05762 0-2.21143 0.02734z m7.85449 0.05811q-0.23926 0.05469-0.36572 0.27344-0.12305 0.21533-0.05469 0.45459 0.05811 0.19482 0.21192 0.30761 0.06836 0.04102 0.28027 0.12647 0.24951 0.08203 0.40332 0.17432 0.15381 0.08887 0.32471 0.27343 0.33496 0.34863 0.44775 0.78272 0.02734 0.11279 0.03418 0.24609 0.00684 0.1333 0.02051 0.70752l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0.01367-0.64599q0-0.64258-0.02734-0.95703-0.02734-0.31445-0.12647-0.59473-0.14014-0.42041-0.42724-0.81006-0.28711-0.39307-0.64942-0.65967-0.31103-0.22559-0.69726-0.35888-0.38281-0.1333-0.5503-0.08887z"
                            fill="#071915"
                          />
                        </svg>
                      </div>
                      <div
                        data-pencil-name="Conteúdo capacidade equipe"
                        className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
                      >
                        <div
                          data-pencil-name="Título capacidade equipe"
                          className="text-[15px] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                        >
                          {planoInfo && maxVagas > 0 && usados >= maxVagas ? "Limite de usuários atingido" : "Capacidade da equipe"}
                        </div>
                        <div
                          data-pencil-name="Descrição capacidade equipe"
                          className="text-[11px] box-border text-[#A7B6AE] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                        >
                          {loadingPlano ? "Carregando plano..." : planoInfo
                            ? `Você utiliza ${usados} das ${maxVagas > 0 ? maxVagas : "∞"} vagas disponíveis no Plano ${planoNome}.`
                            : "Não foi possível consultar os limites do plano."}
                        </div>
                      </div>
                    </div>
                    <div
                      data-pencil-name="Uso plano usuários"
                      className="box-border w-fit shrink-0 h-fit flex flex-row gap-[16px] justify-start items-center"
                    >
                      <div
                        data-pencil-name="Indicador vagas"
                        className="box-border w-fit shrink-0 h-fit flex flex-col gap-[7px] justify-start items-end"
                      >
                        <div
                          data-pencil-name="Texto vagas"
                          className="text-[11px] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                        >
                          {loadingPlano || !planoInfo ? "—" : `${usados} de ${maxVagas > 0 ? maxVagas : "∞"} vagas`}
                        </div>
                        <div
                          data-pencil-name="Barra vagas"
                          className="box-border w-[170px] h-[7px] shrink-0 bg-[#284138] rounded-[4px] relative overflow-hidden"
                        >
                          <div
                            data-pencil-name="Progresso vagas"
                            className="box-border h-[7px] absolute left-0 top-0 bg-[#C9FF3B] rounded-[4px]"
                            style={{ width: `${loadingPlano || !planoInfo ? 0 : pct}%` }}
                          />
                        </div>
                      </div>
                      <a
                        href="/admin/assinatura"
                        data-pencil-name="Ver planos usuários"
                        className="box-border w-fit shrink-0 h-[38px] flex flex-row px-[14px] justify-start items-center bg-[#FFFFFF0D] outline outline-1 outline-[#41564A] -outline-offset-[0.5px] rounded-[10px] no-underline hover:bg-white/10 transition-colors"
                      >
                        <div
                          data-pencil-name="Texto ver planos usuários"
                          className="text-[11px] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                        >
                          Ver planos
                        </div>
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Detalhes de usuários (Perfis de Acesso + Atividade Recente) */}
              <div
                data-pencil-name="Detalhes de usuários"
                className="box-border w-full min-h-[220px] md:h-[220px] shrink-0 flex flex-col lg:flex-row gap-[14px] justify-start items-start"
              >
                {/* Perfis de acesso */}
                <div
                  data-pencil-name="Perfis de acesso"
                  className="box-border flex-1 md:[flex:1_1_0] w-full shrink-0 min-h-[220px] md:h-[220px] flex flex-col gap-[12px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-[0.5px] rounded-[16px]"
                >
                  <div
                    data-pencil-name="Cabeçalho perfis"
                    className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-center"
                  >
                    <div
                      data-pencil-name="Texto cabeçalho perfis"
                      className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título perfis"
                        className="text-[14px] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Perfis de acesso
                      </div>
                      <div
                        data-pencil-name="Subtítulo perfis"
                        className="text-[10px] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                      >
                        Distribuição atual da equipe
                      </div>
                    </div>
                    <svg
                      data-pencil-name="Ícone perfis"
                      viewBox="0 0 13.99993896484375 14"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                      className="box-border w-[18px] shrink-0 h-[18px]"
                    >
                      <path
                        d="M6.84619 0.60156q-0.34863 0.02734-0.68701 0.30762-0.51611 0.42041-1.00147 0.70068-0.48193 0.28027-1.01513 0.4751-0.30762 0.11279-0.58789 0.1709-0.28027 0.05469-0.66992 0.08203-0.23926 0.01367-0.36573 0.07178-0.19482 0.06836-0.37939 0.22217-0.18115 0.15381-0.26319 0.34863l-0.01367 0.03076q-0.07178 0.12646-0.08545 0.22217-0.01367 0.15381-0.02734 0.60156l0 1.78076q0 2.25244 0.01367 2.46094 0.14014 1.6543 1.10742 2.88477 0.14014 0.16748 0.43409 0.46142 0.29395 0.29394 0.48877 0.44775 0.92285 0.7417 2.2832 1.27491 0.46143 0.18115 0.65625 0.23926 0.23926 0.05469 0.43408 0.01367 0.16748-0.02734 0.5332-0.15381 1.35693-0.51953 2.27979-1.20313 0.37939-0.2666 0.71435-0.60498 1.37402-1.3706 1.54151-3.37353 0.01367-0.23584 0.01367-2.46094 0-2.22852-0.02734-2.35498-0.07178-0.32129-0.31787-0.56396-0.24268-0.24609-0.5503-0.31788-0.09912-0.02734-0.37939-0.04101-0.48877-0.02734-0.96387-0.18115-0.81348-0.2666-1.55518-0.77246-0.2666-0.18115-0.64257-0.48877-0.42041-0.33496-0.96729-0.28028z m0.43408 1.34326q0.64258 0.51953 1.32959 0.86817 1.2168 0.61865 2.25244 0.68701l0.21192 0-0.01367 4.31348q0 0.33496-0.02735 0.50244-0.22559 1.34326-1.1416 2.27637-0.91602 0.92969-2.66601 1.57226l-0.21192 0.08545-0.18115-0.05469q-2.32422-0.85449-3.2334-2.22851-0.47852-0.71436-0.63232-1.63721-0.02734-0.18115-0.02735-0.50244l-0.01367-4.32715 0.19483 0q0.86816-0.05469 1.84912-0.48193 0.98096-0.42725 1.83545-1.12793 0.16748-0.14014 0.19482-0.14014 0.02734 0 0.28027 0.19482z m1.32959 3.31885q-0.06836 0.02734-0.12646 0.05127-0.05469 0.02051-1.06299 1.02539l-0.99463 0.99463-0.40674-0.40332q-0.2666-0.2666-0.3623-0.33838-0.12646-0.11279-0.19824-0.14013-0.06836-0.02734-0.19483-0.02735-0.12646 0-0.16748 0.01367-0.04102 0.01367-0.09912 0.04102-0.18115 0.09912-0.28027 0.2666-0.04102 0.08545-0.04102 0.25293l0 0.01367q0 0.14014 0.03418 0.21192 0.0376 0.06836 0.17774 0.22216 0.0957 0.11279 0.48876 0.50586l0.04102 0.04102q0.42041 0.42041 0.55371 0.54687 0.1333 0.12305 0.20166 0.15381 0.14014 0.06836 0.29395 0.05469 0.15381-0.01367 0.28027-0.09912 0.07178-0.05469 1.28857-1.27149 0.86816-0.86816 1.04932-1.06298 0.18457-0.19824 0.21192-0.27002 0.0957-0.27686-0.05811-0.52295-0.15381-0.24609-0.44775-0.25977-0.12646-0.01367-0.18116 0z"
                        fill="#7A9128"
                      />
                    </svg>
                  </div>
                  {/* Linhas de perfis */}
                  {(() => {
                    const countAdmin = usuarios.filter((u) => u.perfil === "Administrador").length;
                    const countGerente = usuarios.filter((u) => u.perfil === "Gerente").length;
                    const countRecep = usuarios.filter((u) => u.perfil === "Recepcionista").length;

                    return (
                      <>
                        <div
                          data-pencil-name="Resumo perfil Administrador"
                          className="box-border w-full h-[36px] shrink-0 flex flex-row justify-between items-center px-[10px] bg-[#FAF8F4] rounded-[9px]"
                        >
                          <div
                            data-pencil-name="Nome perfil Administrador"
                            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
                          >
                            <div
                              data-pencil-name="Cor perfil Administrador"
                              className="box-border w-[8px] shrink-0 h-[8px] bg-[#1F7A45] rounded-full"
                            />
                            <div
                              data-pencil-name="Label perfil Administrador"
                              className="text-[11px] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              Administrador
                            </div>
                          </div>
                          <div
                            data-pencil-name="Quantidade Administrador"
                            className="box-border w-fit shrink-0 h-fit flex flex-row px-[8px] py-[4px] justify-start items-start bg-[#EAF8EF] rounded-[999px]"
                          >
                            <div
                              data-pencil-name="Texto quantidade Administrador"
                              className="text-[9px] box-border text-[#1F7A45] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              {countAdmin === 0 ? "Nenhum" : `${countAdmin} usuário${countAdmin > 1 ? "s" : ""}`}
                            </div>
                          </div>
                        </div>

                        <div
                          data-pencil-name="Resumo perfil Gerente"
                          className="box-border w-full h-[36px] shrink-0 flex flex-row justify-between items-center px-[10px] bg-[#FAF8F4] rounded-[9px]"
                        >
                          <div
                            data-pencil-name="Nome perfil Gerente"
                            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
                          >
                            <div
                              data-pencil-name="Cor perfil Gerente"
                              className="box-border w-[8px] shrink-0 h-[8px] bg-[#2457C5] rounded-full"
                            />
                            <div
                              data-pencil-name="Label perfil Gerente"
                              className="text-[11px] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              Gerente
                            </div>
                          </div>
                          <div
                            data-pencil-name="Quantidade Gerente"
                            className="box-border w-fit shrink-0 h-fit flex flex-row px-[8px] py-[4px] justify-start items-start bg-[#E9F1FF] rounded-[999px]"
                          >
                            <div
                              data-pencil-name="Texto quantidade Gerente"
                              className="text-[9px] box-border text-[#2457C5] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              {countGerente === 0 ? "Nenhum" : `${countGerente} usuário${countGerente > 1 ? "s" : ""}`}
                            </div>
                          </div>
                        </div>

                        <div
                          data-pencil-name="Resumo perfil Recepcionista"
                          className="box-border w-full h-[36px] shrink-0 flex flex-row justify-between items-center px-[10px] bg-[#FAF8F4] rounded-[9px]"
                        >
                          <div
                            data-pencil-name="Nome perfil Recepcionista"
                            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
                          >
                            <div
                              data-pencil-name="Cor perfil Recepcionista"
                              className="box-border w-[8px] shrink-0 h-[8px] bg-[#7A7066] rounded-full"
                            />
                            <div
                              data-pencil-name="Label perfil Recepcionista"
                              className="text-[11px] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              Recepcionista
                            </div>
                          </div>
                          <div
                            data-pencil-name="Quantidade Recepcionista"
                            className="box-border w-fit shrink-0 h-fit flex flex-row px-[8px] py-[4px] justify-start items-start bg-[#F1EDE6] rounded-[999px]"
                          >
                            <div
                              data-pencil-name="Texto quantidade Recepcionista"
                              className="text-[9px] box-border text-[#7A7066] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              {countRecep === 0 ? "Nenhum" : `${countRecep} usuário${countRecep > 1 ? "s" : ""}`}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Atividade recente de usuários */}
                <div
                  data-pencil-name="Atividade recente de usuários"
                  className="box-border flex-1 md:[flex:1_1_0] w-full shrink-0 min-h-[220px] md:h-[220px] flex flex-col gap-[12px] p-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-[0.5px] rounded-[16px]"
                >
                  <div
                    data-pencil-name="Cabeçalho atividade usuários"
                    className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-center"
                  >
                    <div
                      data-pencil-name="Texto cabeçalho atividade"
                      className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título atividade usuários"
                        className="text-[14px] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Atividade recente
                      </div>
                      <div
                        data-pencil-name="Subtítulo atividade usuários"
                        className="text-[10px] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                      >
                        Últimas ações da equipe
                      </div>
                    </div>
                    <svg
                      data-pencil-name="Ícone atividade usuários"
                      viewBox="0 0 13.99993896484375 14"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                      className="box-border w-[18px] shrink-0 h-[18px]"
                    >
                      <path
                        d="M1.59619 1.18945q-0.25293 0.08545-0.37939 0.30762l-0.04102 0.08545 0 3.26074 0.04102 0.07178q0.09912 0.19482 0.29394 0.28027l0.08545 0.04102 2.81299 0.01367q0.32129-0.01367 0.43408-0.02734 0.07178-0.01367 0.15381-0.07178l0.01367-0.01367q0.1709-0.12646 0.21875-0.31446 0.04785-0.18799-0.03076-0.37597-0.0752-0.19141-0.25635-0.28711-0.08545-0.05811-0.2666-0.07178-0.18115-0.01367-0.76904-0.01367l-0.7417 0 0.23584-0.22559q0.7417-0.72803 1.58252-1.09033 0.96729-0.42041 2.03027-0.42041 0.93994 0 1.76367 0.34863 1.17578 0.49219 1.93799 1.49366 0.76563 1.00146 0.91944 2.2456 0.02734 0.22559 0.02734 0.56738 0 0.3418-0.02734 0.56739-0.15381 1.2749-0.93995 2.29004-0.78271 1.01172-1.97216 1.49023-0.81348 0.32129-1.72266 0.32129-0.28027 0-0.46143-0.01367-0.18115-0.01367-0.46142-0.07178-0.88184-0.18115-1.64746-0.68359-0.76221-0.50586-1.28174-1.2544-0.51611-0.74854-0.71094-1.64404-0.08545-0.44775-0.09228-0.77588-0.00684-0.33154-0.0752-0.47168-0.08545-0.16748-0.2666-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04102 0.01367-0.09912 0.04102-0.18115 0.09912-0.28027 0.2666-0.06836 0.15381-0.03418 0.65283 0.03418 0.49561 0.14697 0.9878 0.29395 1.18945 1.03564 2.15673 0.7417 0.96387 1.80469 1.5586 1.06641 0.59473 2.29688 0.70752 0.18457 0.01367 0.5332 0.01367 0.34863 0 0.5332-0.01367 1.38428-0.12646 2.54639-0.86817 1.14844-0.71436 1.86279-1.86279 0.7417-1.16211 0.86817-2.54639 0.01367-0.18457 0.01367-0.5332 0-0.34863-0.01367-0.5332-0.14014-1.52441-1.01514-2.78223-0.875-1.26123-2.2627-1.93457-0.58789-0.28027-1.14843-0.42041-0.55713-0.14014-1.2168-0.15381-1.09033-0.02734-2.1123 0.30762-0.71436 0.23926-1.30225 0.60498-0.58789 0.3623-1.14844 0.90918l-0.28027 0.26318 0-1.67822-0.04102-0.08545q-0.09912-0.18115-0.28027-0.2666-0.08545-0.04102-0.22559-0.04785-0.14014-0.00684-0.18115 0.00683z m5.26367 2.32422q-0.12646 0.02734-0.23925 0.1333-0.10938 0.10596-0.16749 0.23242l-0.02734 0.09571 0 3.19238 0.04102 0.08545q0.05811 0.0957 0.12646 0.15381 0.08545 0.06836 0.36572 0.22217l0.90918 0.46142q1.20312 0.60498 1.30225 0.63233 0.23926 0.06836 0.45459-0.05469 0.21533-0.12646 0.27344-0.3794 0.04102-0.18115-0.04102-0.37939-0.04443-0.0957-0.11621-0.15039-0.06836-0.05811-0.31787-0.18457l-1.83545-0.93652-0.01367-2.70362-0.04102-0.09912q-0.04443-0.08203-0.12304-0.15723-0.0752-0.07861-0.15381-0.11279-0.0752-0.0376-0.19483-0.05127-0.11621-0.01367-0.20166 0z"
                        fill="#7A9128"
                      />
                    </svg>
                  </div>

                  {/* Lista de Atividades */}
                  <TeamRecentActivity refreshKey={usuarios} />
                </div>
              </div>
            </div>
          )}

          {/* Painel Configurações Pagamentos */}
          {activeTab === "pagamentos" && (
            <div
              data-pencil-name="Painel Configurações Pagamentos"
              className="box-border flex-1 md:[flex:1_1_0] w-full min-w-0 flex flex-col gap-0 justify-start items-start font-[Inter,system-ui,sans-serif]"
            >
              <div
                data-pencil-name="Configuração de pagamentos"
                className="box-border w-full flex-1 md:[flex:1_1_0] flex flex-col gap-[14px] p-[22px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] shadow-sm"
              >
                {/* Cabeçalho pagamentos config */}
                <div
                  data-pencil-name="Cabeçalho pagamentos config"
                  className="box-border w-full h-auto min-h-[48px] shrink-0 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center"
                >
                  <div
                    data-pencil-name="Texto pagamentos config"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
                  >
                    <h2
                      data-pencil-name="Título pagamentos config"
                      className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Pagamentos
                    </h2>
                    <p
                      data-pencil-name="Descrição pagamentos config"
                      className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left"
                    >
                      Configure como sua arena recebe Pix, cartão e pagamentos no balcão.
                    </p>
                  </div>

                  <div
                    data-pencil-name="Status conexão pagamentos"
                    className={`box-border w-fit shrink-0 h-fit flex flex-row gap-[6px] px-[10px] py-[6px] justify-start items-center rounded-full ${
                      gatewayConnected
                        ? "bg-[#EAF8EF] text-[#1F7A45]"
                        : "bg-[#FFF3DB] text-[#A85A00]"
                    }`}
                  >
                    {gatewayConnected ? (
                      <CheckCircle2 className="w-[13px] h-[13px] text-[#1F7A45] shrink-0" />
                    ) : (
                      <AlertTriangle className="w-[13px] h-[13px] text-[#A85A00] shrink-0" />
                    )}
                    <span
                      data-pencil-name="Texto status conexão"
                      className="text-[10px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      {gatewayConnected ? "Conectado · Mercado Pago ativo" : "Pendente · Não conectado"}
                    </span>
                  </div>
                </div>

                {/* Conexão Mercado Pago */}
                <div
                  data-pencil-name="Conexão Mercado Pago"
                  className={`box-border w-full min-h-[100px] shrink-0 flex flex-col md:flex-row gap-4 p-[16px] justify-between items-start md:items-center outline outline-1 -outline-offset-1 rounded-[14px] transition-colors ${
                    gatewayConnected
                      ? "bg-[#EAF8EF] outline-[#BFE5CC]"
                      : "bg-[#EAF7FB] outline-[#B9DFEC]"
                  }`}
                >
                  <div
                    data-pencil-name="Info Mercado Pago"
                    className="box-border w-fit shrink-0 h-fit flex flex-row gap-[12px] justify-start items-center"
                  >
                    <div
                      data-pencil-name="Ícone Mercado Pago"
                      className={`box-border w-[44px] shrink-0 h-[44px] flex flex-row justify-center items-center rounded-[13px] transition-colors ${gatewayConnected ? "bg-[#2BAE66]" : "bg-[#0AA5E8]"}`}
                    >
                      <LinkIcon className="box-border w-[20px] shrink-0 h-[20px] text-white" />
                    </div>
                    <div
                      data-pencil-name="Texto Mercado Pago"
                      className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título Mercado Pago"
                        className="text-[14px]/[normal] box-border text-[#09668F] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        {gatewayConnected ? "Mercado Pago conectado" : "Conexão automática Mercado Pago"}
                      </div>
                      <div
                        data-pencil-name="Descrição Mercado Pago"
                        className="text-[10px]/[normal] box-border text-[#4B7180] font-[Inter,system-ui,sans-serif] font-medium text-left"
                      >
                        {gatewayConnected
                          ? "Sua conta está conectada e pronta para receber Pix e cartão automaticamente."
                          : "Conecte sua conta bancária com segurança, sem copiar chaves manualmente."}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row gap-2 items-center">
                    {gatewayConnected && (
                      <button
                        type="button"
                        onClick={handleDesconectarMercadoPago}
                        className="box-border w-fit shrink-0 h-[38px] px-[12px] flex items-center justify-center bg-white hover:bg-neutral-100 outline outline-1 outline-[#B9DFEC] rounded-[9px] text-[11px] font-bold text-[#E02424] cursor-pointer transition-colors"
                      >
                        Desconectar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleConectarMercadoPago}
                      data-pencil-name="Botão conectar Mercado Pago"
                      className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[7px] px-[14px] justify-start items-center bg-[#0A9DDE] hover:bg-[#088ec9] transition-colors rounded-[9px] cursor-pointer shadow-sm"
                    >
                      <Plug className="box-border w-[14px] shrink-0 h-[14px] text-white" />
                      <div
                        data-pencil-name="Texto conectar Mercado Pago"
                        className="text-[11px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        {gatewayConnected ? "Reconectar conta" : "Conectar conta"}
                      </div>
                    </button>
                  </div>
                </div>

                {modalDesconectarOpen && (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-desconectar-mp"
                  >
                    <div className="w-full max-w-[400px] flex flex-col gap-4 p-[22px] bg-white rounded-[16px] shadow-xl">
                      <div id="titulo-desconectar-mp" className="text-[16px] font-extrabold text-[#071915]">
                        Desconectar Mercado Pago
                      </div>
                      <p className="text-[12px] text-[#4F5550] m-0">
                        Por segurança, confirme sua senha atual. Sem a conta conectada, novos pagamentos automáticos deixam de funcionar.
                      </p>
                      <input
                        type="password"
                        autoFocus
                        value={senhaDesconectar}
                        onChange={(e) => setSenhaDesconectar(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmarDesconectarMercadoPago(); }}
                        placeholder="Senha atual"
                        className="w-full h-[40px] px-3 rounded-[10px] outline outline-1 outline-[#DCD3C6] focus:outline-[#071915] text-[13px]"
                      />
                      <div className="flex flex-row gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setModalDesconectarOpen(false)}
                          disabled={desconectando}
                          className="h-[38px] px-[14px] rounded-[9px] bg-white outline outline-1 outline-[#DED6CA] text-[12px] font-bold text-[#071915] cursor-pointer hover:bg-neutral-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={confirmarDesconectarMercadoPago}
                          disabled={desconectando}
                          className="h-[38px] px-[14px] rounded-[9px] bg-[#E02424] hover:bg-[#c81e1e] text-[12px] font-bold text-white cursor-pointer disabled:opacity-60"
                        >
                          {desconectando ? "Desconectando..." : "Desconectar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Colunas credenciais e Pix */}
                <div
                  data-pencil-name="Colunas credenciais e Pix"
                  className="box-border w-full flex flex-col lg:flex-row gap-[14px] justify-start items-stretch"
                >
                  {/* Credenciais manuais */}
                  <div
                    data-pencil-name="Credenciais manuais"
                    className="box-border flex-1 md:[flex:1_1_0] w-full flex flex-col gap-[12px] p-[16px] justify-start items-start bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[14px]"
                  >
                    <div
                      data-pencil-name="Header credenciais manuais"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[10px] justify-start items-center"
                    >
                      <div
                        data-pencil-name="Ícone credenciais"
                        className="box-border w-[34px] shrink-0 h-[34px] flex flex-row justify-center items-center bg-[#F0EBE3] rounded-[10px]"
                      >
                        <KeyRound className="box-border w-[16px] shrink-0 h-[16px] text-[#635D55]" />
                      </div>
                      <div
                        data-pencil-name="Texto credenciais"
                        className="box-border w-fit shrink-0 h-fit flex flex-col gap-[2px] justify-start items-start"
                      >
                        <div
                          data-pencil-name="Título credenciais"
                          className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                        >
                          Credenciais manuais
                        </div>
                        <div
                          data-pencil-name="Sub credenciais"
                          className="text-[9px]/[normal] box-border text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                        >
                          Configuração avançada
                        </div>
                      </div>
                    </div>

                    {/* Access Token da arena */}
                    <div
                      data-pencil-name="Campo pagamento Access Token da arena"
                      className="box-border w-full h-fit shrink-0 flex flex-col gap-[6px] justify-start items-start"
                    >
                      <label
                        data-pencil-name="Label pagamento Access Token da arena"
                        className="text-[10px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        Access Token da arena
                      </label>
                      <div
                        data-pencil-name="Input pagamento Access Token da arena"
                        className="box-border w-full h-[38px] shrink-0 flex flex-row gap-0 px-[11px] justify-start items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          placeholder={gatewayConnected ? "•••••••••••••••• (já cadastrado)" : "APP_USR-1234567890..."}
                          className="w-full bg-transparent text-[11px] text-[#071915] font-medium outline-none placeholder:text-[#9A9E98]"
                        />
                      </div>
                      <div
                        data-pencil-name="Ajuda pagamento Access Token da arena"
                        className="text-[9px]/[12px] box-border w-full text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left"
                      >
                        Mercado Pago ou PagBank
                      </div>
                    </div>

                    {/* Chave pública */}
                    <div
                      data-pencil-name="Campo pagamento Chave pública"
                      className="box-border w-full h-fit shrink-0 flex flex-col gap-[6px] justify-start items-start"
                    >
                      <label
                        data-pencil-name="Label pagamento Chave pública"
                        className="text-[10px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        Chave pública
                      </label>
                      <div
                        data-pencil-name="Input pagamento Chave pública"
                        className="box-border w-full h-[38px] shrink-0 flex flex-row gap-0 px-[11px] justify-start items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                      >
                        <input
                          type="text"
                          value={publicKey}
                          onChange={(e) => setPublicKey(e.target.value)}
                          placeholder="APP_USR-9876543210..."
                          className="w-full bg-transparent text-[11px] text-[#071915] font-medium outline-none placeholder:text-[#9A9E98]"
                        />
                      </div>
                      <div
                        data-pencil-name="Ajuda pagamento Chave pública"
                        className="text-[9px]/[12px] box-border w-full text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left"
                      >
                        Opcional para formulários de cartão
                      </div>
                    </div>
                  </div>

                  {/* Pix direto da arena */}
                  <div
                    data-pencil-name="Pix direto da arena"
                    className="box-border flex-1 md:[flex:1_1_0] w-full flex flex-col gap-[12px] p-[16px] justify-start items-start bg-[#F4F9F0] outline outline-1 outline-[#DCE8D2] -outline-offset-1 rounded-[14px]"
                  >
                    <div
                      data-pencil-name="Header Pix direto"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[10px] justify-start items-center"
                    >
                      <div
                        data-pencil-name="Ícone Pix"
                        className="box-border w-[34px] shrink-0 h-[34px] flex flex-row justify-center items-center bg-[#C9FF3B] rounded-[10px]"
                      >
                        <QrCode className="box-border w-[16px] shrink-0 h-[16px] text-[#071915]" />
                      </div>
                      <div
                        data-pencil-name="Texto Pix"
                        className="box-border w-fit shrink-0 h-fit flex flex-col gap-[2px] justify-start items-start"
                      >
                        <div
                          data-pencil-name="Título Pix"
                          className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                        >
                          Pix direto da arena
                        </div>
                        <div
                          data-pencil-name="Sub Pix"
                          className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                        >
                          Receba sem intermediários
                        </div>
                      </div>
                    </div>

                    {/* Chave Pix */}
                    <div
                      data-pencil-name="Campo pagamento Chave Pix"
                      className="box-border w-full h-fit shrink-0 flex flex-col gap-[6px] justify-start items-start"
                    >
                      <label
                        data-pencil-name="Label pagamento Chave Pix"
                        className="text-[10px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        Chave Pix
                      </label>
                      <div
                        data-pencil-name="Input pagamento Chave Pix"
                        className="box-border w-full h-[38px] shrink-0 flex flex-row gap-0 px-[11px] justify-start items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                      >
                        <input
                          type="text"
                          value={chavePix}
                          onChange={(e) => setChavePix(e.target.value)}
                          placeholder="E-mail, CNPJ, telefone ou EVP"
                          className="w-full bg-transparent text-[11px] text-[#071915] font-medium outline-none placeholder:text-[#9A9E98]"
                        />
                      </div>
                      <div
                        data-pencil-name="Ajuda pagamento Chave Pix"
                        className="text-[9px]/[12px] box-border w-full text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left"
                      >
                        O QR Code será gerado com essa chave
                      </div>
                    </div>

                    {/* Titular e cidade Pix */}
                    <div
                      data-pencil-name="Titular e cidade Pix"
                      className="box-border w-full h-fit flex flex-row gap-[9px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Titular Pix"
                        className="box-border flex-1 md:[flex:1_1_0] h-fit flex flex-col gap-[6px] justify-start items-start"
                      >
                        <label
                          data-pencil-name="Label titular Pix"
                          className="text-[10px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                        >
                          Titular da conta
                        </label>
                        <div
                          data-pencil-name="Input titular Pix"
                          className="box-border w-full h-[38px] shrink-0 flex flex-row gap-0 px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#D8E3CF] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                        >
                          <input
                            type="text"
                            value={titularPix}
                            onChange={(e) => setTitularPix(e.target.value)}
                            placeholder="Arena Central Ltda"
                            className="w-full bg-transparent text-[10px] text-[#071915] font-medium outline-none placeholder:text-[#9A9E98]"
                          />
                        </div>
                      </div>
                      <div
                        data-pencil-name="Cidade Pix"
                        className="box-border flex-1 md:[flex:1_1_0] h-fit flex flex-col gap-[6px] justify-start items-start"
                      >
                        <label
                          data-pencil-name="Label cidade Pix"
                          className="text-[10px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                        >
                          Cidade
                        </label>
                        <div
                          data-pencil-name="Input cidade Pix"
                          className="box-border w-full h-[38px] shrink-0 flex flex-row gap-0 px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#D8E3CF] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                        >
                          <input
                            type="text"
                            value={cidadePix}
                            onChange={(e) => setCidadePix(e.target.value)}
                            placeholder="SÃO PAULO"
                            className="w-full bg-transparent text-[10px] text-[#4F5550] font-semibold outline-none placeholder:text-[#9A9E98]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Máquina física POS */}
                <div
                  data-pencil-name="Máquina física POS"
                  className="box-border w-full min-h-[94px] shrink-0 flex flex-col sm:flex-row gap-[14px] p-[15px] justify-start items-start sm:items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[14px]"
                >
                  <div
                    data-pencil-name="Ícone máquina POS"
                    className="box-border w-[42px] shrink-0 h-[42px] flex flex-row justify-center items-center bg-[#071915] rounded-[12px]"
                  >
                    <CreditCard className="box-border w-[19px] shrink-0 h-[19px] text-[#C9FF3B]" />
                  </div>
                  <div
                    data-pencil-name="Texto máquina POS"
                    className="box-border w-full sm:w-[220px] shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Título máquina POS"
                      className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Máquina física do balcão
                    </div>
                    <div
                      data-pencil-name="Descrição máquina POS"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                    >
                      POS Smart Cloud via Wi-Fi ou 4G
                    </div>
                  </div>
                  <div
                    data-pencil-name="Serial POS"
                    className="box-border flex-1 md:[flex:1_1_0] w-full h-fit flex flex-col gap-[5px] justify-start items-start"
                  >
                    <label
                      data-pencil-name="Label Serial POS"
                      className="text-[9px]/[normal] box-border text-[#394236] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      Número de série / ID do dispositivo
                    </label>
                    <div
                      data-pencil-name="Input Serial POS"
                      className="box-border w-full h-[36px] shrink-0 flex flex-row gap-0 px-[10px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                    >
                      <input
                        type="text"
                        value={maquinetaId}
                        onChange={(e) => setMaquinetaId(e.target.value)}
                        placeholder="Ex.: MP-POINT-12345"
                        className="w-full bg-transparent text-[11px] text-[#071915] font-medium outline-none placeholder:text-[#9A9E98]"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer pagamentos config */}
                <div
                  data-pencil-name="Footer pagamentos config"
                  className="box-border w-full flex flex-row justify-end items-center pt-2"
                >
                  <button
                    type="button"
                    onClick={handleSavePagamentos}
                    disabled={salvandoPagamentos}
                    data-pencil-name="Salvar pagamentos config"
                    className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[17px] justify-start items-center bg-[#071915] hover:bg-neutral-800 transition-colors rounded-[10px] cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Save className="box-border w-[15px] shrink-0 h-[15px] text-[#C9FF3B]" />
                    <span
                      data-pencil-name="Texto salvar pagamentos"
                      className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      {salvandoPagamentos ? "Salvando..." : "Salvar configurações"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Painel Configurações Notificações */}
          {activeTab === "notificacoes" && (
            <div
              data-pencil-name="Painel Configurações Notificações"
              className="box-border flex-1 md:[flex:1_1_0] w-full min-w-0 flex flex-col gap-[14px] p-[22px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] shadow-sm font-[Inter,system-ui,sans-serif]"
            >
              {loadingNotificacoes ? (
                <p className="text-sm text-[#6F766F]">Carregando notificações...</p>
              ) : erroNotificacoes ? (
                <div role="alert" className="flex flex-col gap-3 text-sm text-[#6F766F]">
                  <p>{erroNotificacoes}</p>
                  <button type="button" onClick={loadNotificacoes} className="w-fit rounded-lg bg-[#071915] px-4 py-2 font-semibold text-white">Tentar novamente</button>
                </div>
              ) : notificacoesLoaded && (
              <>
              {/* Cabeçalho notificações */}
              <div
                data-pencil-name="Cabeçalho notificações"
                className="box-border w-full h-auto min-h-[48px] shrink-0 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center"
              >
                <div
                  data-pencil-name="Texto cabeçalho notificações"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
                >
                  <h2
                    data-pencil-name="Título notificações"
                    className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Notificações
                  </h2>
                  <p
                    data-pencil-name="Descrição notificações"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left"
                  >
                    Escolha quando e como clientes e equipe devem ser avisados.
                  </p>
                </div>

                <div
                  data-pencil-name="Status notificações"
                  className={`box-border w-fit shrink-0 h-fit flex flex-row gap-[6px] px-[10px] py-[6px] justify-start items-center rounded-full ${
                    ((notifReservaEmail ? 1 : 0) + (notifCancelamentoEmail ? 1 : 0) + (notifPagamentoEmail ? 1 : 0)) > 0
                      ? "bg-[#EAF8EF]"
                      : "bg-[#F1EDE6]"
                  }`}
                >
                  <div
                    data-pencil-name="Ponto status notificações"
                    className={`box-border w-[7px] shrink-0 h-[7px] rounded-full ${
                      ((notifReservaEmail ? 1 : 0) + (notifCancelamentoEmail ? 1 : 0) + (notifPagamentoEmail ? 1 : 0)) > 0
                        ? "bg-[#2BAE66]"
                        : "bg-[#A7B6AE]"
                    }`}
                  />
                  <span
                    data-pencil-name="Texto status notificações"
                    className={`text-[10px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                      ((notifReservaEmail ? 1 : 0) + (notifCancelamentoEmail ? 1 : 0) + (notifPagamentoEmail ? 1 : 0)) > 0
                        ? "text-[#1F7A45]"
                        : "text-[#6F766F]"
                    }`}
                  >
                    {(() => {
                      const count = (notifReservaEmail ? 1 : 0) + (notifCancelamentoEmail ? 1 : 0) + (notifPagamentoEmail ? 1 : 0);
                      return count === 1 ? "1 automação ativa" : `${count} automações ativas`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Canais de notificação */}
              <div
                data-pencil-name="Canais de notificação"
                className="box-border w-full h-auto min-h-[82px] shrink-0 flex flex-col sm:flex-row gap-[12px] justify-start items-stretch"
              >
                {/* Canal E-mail */}
                <div
                  data-pencil-name="Canal E-mail"
                  className="box-border flex-1 w-full min-h-[82px] flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone canal E-mail"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row gap-0 justify-center items-center bg-[#E9F1FF] rounded-[11px]"
                  >
                    <svg
                      data-pencil-name="Símbolo canal E-mail"
                      viewBox="0 0 13.99993896484375 14"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                      className="box-border w-[17px] shrink-0 h-[17px]"
                    >
                      <path
                        d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 3.17871 0 3.17871q0.01367 0.56055 0.02734 0.66992 0.11279 0.5332 0.50245 0.90577 0.39307 0.36914 0.92627 0.46826 0.16748 0.02734 4.95605 0.02734 4.78857 0 4.95605-0.02734 0.5332-0.09912 0.92286-0.46826 0.39307-0.37256 0.50586-0.90577 0.01367-0.10938 0.02734-0.66992l0-3.17871 0-3.17871q-0.01367-0.56055-0.02734-0.66992-0.12647-0.54688-0.53321-0.92285-0.40674-0.37939-0.95019-0.46485-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.46436 1.58252q-2.46436 1.56543-2.53613 1.60303-0.06836 0.03418-0.16748 0.03418l-0.02734 0.01367q-0.0957 0.01367-0.2085-0.04102-0.15381-0.07178-0.65967-0.37939l-4.40918-2.81299 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m-5.63964 5.02783q0.22217 0.10938 0.46142 0.15381 0.09912 0.02734 0.30762 0.02734 0.2085 0 0.30762-0.02734 0.30762-0.05811 0.54687-0.19825 0.14014-0.08203 2.26612-1.42529l2.12939-1.36035-0.01367 5.50293-0.04102 0.09912q-0.11279 0.2085-0.3247 0.29395l-0.09571 0.02734-9.5498 0-0.09571-0.02734q-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.50293 2.17041 1.37402q2.17041 1.38428 2.31055 1.45606z"
                        fill="#2457C5"
                      />
                    </svg>
                  </div>
                  <div
                    data-pencil-name="Conteúdo canal E-mail"
                    className="box-border flex-1 h-fit flex flex-col gap-[3px] justify-start items-start min-w-0"
                  >
                    <div
                      data-pencil-name="Nome canal E-mail"
                      className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      E-mail
                    </div>
                    <div
                      data-pencil-name="Descrição canal E-mail"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                    >
                      Confirmações e comprovantes
                    </div>
                  </div>
                  <div
                    data-pencil-name="Estado canal E-mail"
                    className={`text-[9px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                      (notifReservaEmail || notifCancelamentoEmail || notifPagamentoEmail) ? "text-[#2457C5]" : "text-[#8A8F88]"
                    }`}
                  >
                    {(notifReservaEmail || notifCancelamentoEmail || notifPagamentoEmail) ? "Ativo" : "Inativo"}
                  </div>
                </div>

                {/* Canal WhatsApp */}
                <div
                  data-pencil-name="Canal WhatsApp"
                  className="box-border flex-1 w-full min-h-[82px] flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone canal WhatsApp"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row gap-0 justify-center items-center bg-[#EAF8EF] rounded-[11px]"
                  >
                    <svg
                      data-pencil-name="Símbolo canal WhatsApp"
                      viewBox="0 0 13.99993896484375 14"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                      className="box-border w-[17px] shrink-0 h-[17px]"
                    >
                      <path
                        d="M6.80518 0.58789q-0.5332 0.01367-1.10059 0.1333-0.56738 0.11963-1.06982 0.31445-1.3877 0.56055-2.396 1.67481-1.0083 1.11084-1.41162 2.55322-0.30762 1.09375-0.22559 2.21485 0.08545 1.11768 0.54688 2.15332l0.01367 0.04101q0.06836 0.14014 0.07519 0.22559 0.01025 0.08203-0.04785 0.29394-0.04102 0.15381-0.20849 0.66992l-0.05811 0.14014q-0.30762 0.98096-0.33496 1.1211-0.01367 0.16748 0.02734 0.37255 0.04443 0.20166 0.14014 0.35547 0.05811 0.09912 0.17432 0.21875 0.11963 0.11621 0.21875 0.17432 0.16748 0.0957 0.3623 0.14014 0.19824 0.04101 0.3794 0.02734 0.12646-0.02734 1.14843-0.32129l0.14014-0.04443q0.54688-0.15381 0.70068-0.19483 0.22217-0.05469 0.29737-0.04785 0.07861 0.00684 0.20508 0.06152l0.02734 0.01368q0.88184 0.37939 1.97559 0.50586 0.16748 0.02734 0.59472 0.02734 0.42725 0 0.62207-0.02734 0.85449-0.08545 1.64405-0.3794 0.79297-0.29395 1.47998-0.78271 0.93652-0.65967 1.5791-1.60987 0.646-0.95361 0.92627-2.05761 0.28027-1.10742 0.15381-2.23877-0.12647-1.13477-0.646-2.17383-0.66992-1.35693-1.90381-2.27979-1.23047-0.92627-2.72754-1.17578-0.63232-0.11279-1.30224-0.09912z m0.58789 1.17578q1.38428 0.11279 2.5122 0.86133 1.12793 0.74854 1.77051 1.98242 0.40674 0.79639 0.5332 1.75 0.02734 0.22217 0.02735 0.64258 0 0.42041-0.02735 0.65967-0.16748 1.24414-0.85449 2.26611-0.68701 1.02197-1.76367 1.63721-0.57422 0.32471-1.24756 0.50586-0.66992 0.18115-1.32959 0.18115-1.07666 0-2.12597-0.44775-0.19824-0.08545-0.31788-0.11963-0.11621-0.03418-0.28711-0.04785-0.23584-0.01367-0.45458 0.02734-0.21533 0.04102-1.04249 0.28027-1.0083 0.29395-1.01513 0.28711-0.00684-0.00684 0.30078-0.95703 0.30762-0.95361 0.32129-1.10742 0.07178-0.44775-0.14014-0.9126l-0.14014-0.34863q-0.38965-0.96729-0.3623-2.03711 0.02734-1.06982 0.46143-2.02344 0.44775-0.99463 1.25097-1.72265 0.80664-0.72803 1.82178-1.0835 1.01514-0.35547 2.10889-0.27344z"
                        fill="#1F7A45"
                      />
                    </svg>
                  </div>
                  <div
                    data-pencil-name="Conteúdo canal WhatsApp"
                    className="box-border flex-1 h-fit flex flex-col gap-[3px] justify-start items-start min-w-0"
                  >
                    <div
                      data-pencil-name="Nome canal WhatsApp"
                      className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      WhatsApp
                    </div>
                    <div
                      data-pencil-name="Descrição canal WhatsApp"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                    >
                      Compartilhamento manual
                    </div>
                  </div>
                  <div
                    data-pencil-name="Estado canal WhatsApp"
                    className="text-[9px]/[normal] box-border text-[#1F7A45] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Manual
                  </div>
                </div>

                {/* Canal Dashboard */}
                <div
                  data-pencil-name="Canal Dashboard"
                  className="box-border flex-1 w-full min-h-[82px] flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone canal Dashboard"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row gap-0 justify-center items-center bg-[#FFF3DB] rounded-[11px]"
                  >
                    <svg
                      data-pencil-name="Símbolo canal Dashboard"
                      viewBox="0 0 13.99993896484375 14"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                      className="box-border w-[17px] shrink-0 h-[17px]"
                    >
                      <path
                        d="M2.21143 0.60156q-0.15381 0.02734-0.2461 0.1128-0.08887 0.08203-0.25635 0.34863-0.51953 0.77246-0.78613 1.57226-0.26318 0.79639-0.33496 1.6919-0.01367 0.33496 0.01367 0.48193 0.02734 0.14697 0.15381 0.25977 0.19824 0.19482 0.46143 0.17431 0.2666-0.02051 0.42041-0.24609 0.11279-0.15381 0.11279-0.3623 0-0.39307 0.08203-0.8545 0.08545-0.46143 0.22559-0.85449 0.08545-0.22217 0.25976-0.57764 0.17432-0.35889 0.31446-0.5708l0.19482-0.29394q0.04443-0.06836 0.07178-0.18115 0.05469-0.19482-0.0376-0.37598-0.08887-0.18457-0.27002-0.27344-0.18115-0.09229-0.39307-0.05127l0.01368 0z m4.54931 0q-0.62891 0.02734-1.22363 0.25293-0.59473 0.22217-1.0835 0.62891-0.63232 0.50586-1.03222 1.22705-0.39648 0.72119-0.48194 1.51758-0.01367 0.16748-0.03418 0.70068-0.02051 0.52979-0.0581 0.86817-0.03418 0.33496-0.12988 0.68359-0.09912 0.43408-0.28028 0.78613-0.14014 0.30762-0.29394 0.51953-0.15381 0.2085-0.50586 0.58448-0.22217 0.25293-0.30762 0.38623-0.08203 0.1333-0.12647 0.31445-0.04102 0.14014-0.02734 0.32471 0.01367 0.18115 0.05469 0.30761 0.1709 0.46143 0.60498 0.66993l0.04101 0.02734q0.09912 0.0581 0.28028 0.07178 0.23584 0.01367 1.04931 0.02734l7.5879 0q0.81348-0.01367 1.04931-0.02734 0.18115-0.01367 0.28027-0.07178l0.04102-0.02734q0.43408-0.2085 0.60498-0.66993 0.04102-0.12646 0.05469-0.30761 0.01367-0.18457-0.02735-0.32471-0.04443-0.18115-0.12988-0.32129-0.08203-0.14014-0.3042-0.37939-0.35205-0.37598-0.50586-0.58448-0.15381-0.21191-0.29394-0.51953-0.16748-0.33496-0.2666-0.69726-0.0957-0.36572-0.14014-0.72803-0.04102-0.36572-0.06836-0.9126-0.01367-0.72803-0.08545-1.04932-0.2085-1.08008-0.93652-1.9038-0.72803-0.82715-1.76367-1.1792-0.7417-0.23584-1.54151-0.19483z m4.80225-0.01367q-0.23584 0.04102-0.37598 0.25977-0.14014 0.21533-0.08545 0.45459 0.02734 0.11279 0.07178 0.18115l0.19482 0.29394q0.14014 0.21191 0.31446 0.5708 0.17432 0.35547 0.25976 0.57764 0.14014 0.39307 0.22217 0.85449 0.08545 0.46143 0.08545 0.8545 0 0.2085 0.11279 0.3623 0.15381 0.22559 0.417 0.24609 0.2666 0.02051 0.46484-0.17431 0.12646-0.11279 0.15381-0.25977 0.02734-0.14697 0.01367-0.48193-0.07178-0.89551-0.34521-1.6919-0.27002-0.7998-0.77588-1.57226-0.16748-0.2666-0.26661-0.34863-0.0957-0.08545-0.24951-0.1128l-0.11279-0.02734-0.09912 0.02734 0-0.01367z m-4.11524 1.20313q0.46143 0.07178 0.88184 0.28369 0.42041 0.2085 0.7417 0.55713 0.46143 0.46143 0.67334 1.06298 0.0957 0.25293 0.12988 0.49219 0.0376 0.23584 0.05127 0.7417 0.01367 0.58789 0.06836 1.01514 0.05811 0.42725 0.15723 0.84765 0.16748 0.68359 0.46826 1.2168 0.30078 0.5332 0.84766 1.12109l0.19482 0.19483-9.32422 0 0.19482-0.19483q0.54688-0.58789 0.84766-1.12109 0.30078-0.5332 0.46826-1.2168 0.09912-0.42041 0.15381-0.84765 0.05811-0.42725 0.07861-1.01514 0.02051-0.58789 0.06836-0.875 0.05127-0.28711 0.21192-0.63574 0.16064-0.35205 0.46142-0.68701 0.30078-0.33838 0.63575-0.54688 0.60498-0.36572 1.333-0.42041 0.08203-0.01367 0.31104 0 0.23242 0.01367 0.34521 0.02735z m-1.6372 9.89843q-0.22559 0.08545-0.33155 0.28028-0.10254 0.19482-0.04785 0.42041 0.01367 0.08545 0.11963 0.24609 0.10596 0.16065 0.21875 0.27344 0.50244 0.50244 1.23047 0.50244 0.72803 0 1.23047-0.50244 0.11279-0.11279 0.21875-0.27344 0.10596-0.16064 0.11963-0.24609 0.05469-0.19482-0.0376-0.38282-0.08887-0.19141-0.27002-0.29052-0.08545-0.04102-0.25293-0.04102-0.11279 0-0.15381 0.01367-0.04102 0.01367-0.11279 0.04102-0.09912 0.05811-0.18115 0.15723-0.11279 0.15381-0.17774 0.20849-0.06152 0.05469-0.14697 0.09912-0.08203 0.04102-0.23584 0.04102-0.15381 0-0.23926-0.04102-0.08203-0.04443-0.14697-0.09912-0.06152-0.05469-0.17432-0.20849-0.15381-0.19824-0.43408-0.21192-0.14014 0-0.19482 0.01367z"
                        fill="#A85A00"
                      />
                    </svg>
                  </div>
                  <div
                    data-pencil-name="Conteúdo canal Dashboard"
                    className="box-border flex-1 h-fit flex flex-col gap-[3px] justify-start items-start min-w-0"
                  >
                    <div
                      data-pencil-name="Nome canal Dashboard"
                      className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Dashboard
                    </div>
                    <div
                      data-pencil-name="Descrição canal Dashboard"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                    >
                      Alertas operacionais
                    </div>
                  </div>
                  <div
                    data-pencil-name="Estado canal Dashboard"
                    className="text-[9px]/[normal] box-border text-[#A85A00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {alertaPagamentoMinutos} min
                  </div>
                </div>
              </div>

              {/* Lista automações de notificações */}
              <div
                data-pencil-name="Lista automações de notificações"
                className="box-border w-full flex-none flex flex-col gap-0 justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#EAE4DA] -outline-offset-1 rounded-[14px] overflow-hidden"
              >
                {/* 1. Confirmação de reserva por e-mail */}
                <div
                  data-pencil-name="Notificação Confirmação de reserva por e-mail"
                  className="box-border w-full min-h-[66.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-between items-center border-b border-[#EEE8DF]"
                >
                  <div className="flex flex-row gap-[12px] items-center flex-1 min-w-0">
                    <div
                      data-pencil-name="Ícone notificação Confirmação de reserva por e-mail"
                      className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1F6E8] rounded-[10px]"
                    >
                      <svg
                        data-pencil-name="Símbolo notificação Confirmação de reserva por e-mail"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[16px] shrink-0 h-[16px]"
                      >
                        <path
                          d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 6.11816q0 0.646 0.02734 0.8545 0.01367 0.14014 0.05811 0.2666l0.02734 0.05468q0.0957 0.28027 0.31104 0.53321 0.21875 0.25293 0.49902 0.3999 0.28027 0.14697 0.57422 0.18799 0.14014 0.01367 2.60449 0.01367l2.46436-0.01367 0.09912-0.04102q0.2666-0.12646 0.32129-0.42041 0.05469-0.29395-0.15381-0.50586-0.14014-0.14014-0.33496-0.16748-0.11279-0.02734-2.47803-0.02734l-2.08838 0q-0.32129 0-0.38965-0.02734-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.5166 0.18115 0.12646q4.17334 2.65918 4.34082 2.73096 0.32129 0.16748 0.72119 0.16748 0.3999 0 0.74854-0.16748 0.15381-0.08545 2.32422-1.45606l2.17041-1.38769 0.02734 2.57715 0.04102 0.09912q0.04443 0.08203 0.11279 0.16064 0.07178 0.0752 0.14014 0.1128 0.07178 0.03418 0.16748 0.04785 0.25293 0.04102 0.44092-0.09229 0.19141-0.1333 0.24609-0.38281 0.01367-0.08545 0-2.25586l0-1.67822q-0.01367-0.42041-0.02734-0.57422-0.01367-0.09912-0.05811-0.23926l-0.01367-0.02734q-0.18115-0.46143-0.56055-0.76221-0.37598-0.30078-0.85107-0.37256-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.4917 1.59619q-2.50537 1.58252-2.59082 1.60987-0.15381 0.04102-0.30762 0-0.08545-0.02734-2.59082-1.60987l-2.4917-1.59619 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m0.8545 6.39843q-0.0957 0.01367-0.17432 0.05811-0.0752 0.04102-1.06982 1.02197l-0.98096 0.97754-0.40674-0.38965q-0.40674-0.40674-0.50244-0.46484-0.19824-0.08203-0.3999-0.02393-0.20166 0.05469-0.32813 0.21533-0.12646 0.16064-0.11279 0.36914 0.01367 0.12647 0.04785 0.20508 0.0376 0.0752 0.20508 0.24268 0.10938 0.12646 0.50244 0.51953l0.04102 0.04102q0.39307 0.39307 0.50586 0.48876 0.15381 0.14014 0.22216 0.17774 0.07178 0.03418 0.21192 0.03418l0.01367 0q0.16748 0 0.24951-0.04102 0.08545-0.04443 1.32276-1.28174 1.24072-1.24072 1.28515-1.30908 0.08203-0.18115 0.05469-0.37939-0.05469-0.23584-0.24609-0.36914-0.18799-0.1333-0.44092-0.09229z"
                          fill="#637A20"
                        />
                      </svg>
                    </div>
                    <div
                      data-pencil-name="Texto notificação Confirmação de reserva por e-mail"
                      className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título notificação Confirmação de reserva por e-mail"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Confirmação de reserva por e-mail
                      </div>
                      <div
                        data-pencil-name="Descrição notificação Confirmação de reserva por e-mail"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                      >
                        Envia os detalhes assim que uma nova reserva é criada.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifReservaEmail}
                    aria-label={`${notifReservaEmail ? "Desativar" : "Ativar"} confirmação de reserva por e-mail`}
                    title={`${notifReservaEmail ? "Desativar" : "Ativar"} confirmação de reserva por e-mail`}
                    onClick={() => setNotifReservaEmail(!notifReservaEmail)}
                    data-pencil-name="Switch Confirmação de reserva por e-mail"
                    className={`box-border min-w-[88px] shrink-0 h-[30px] flex items-center justify-center px-2 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                      notifReservaEmail ? "bg-[#1F8A4C] text-white" : "bg-[#DED6CA] text-[#394236]"
                    }`}
                  >
                    {notifReservaEmail ? "Desativar" : "Ativar"}
                  </button>
                </div>

                {/* 2. Cancelamento por e-mail */}
                <div
                  data-pencil-name="Notificação Cancelamento por e-mail"
                  className="box-border w-full min-h-[66.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-between items-center border-b border-[#EEE8DF]"
                >
                  <div className="flex flex-row gap-[12px] items-center flex-1 min-w-0">
                    <div
                      data-pencil-name="Ícone notificação Cancelamento por e-mail"
                      className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1F6E8] rounded-[10px]"
                    >
                      <svg
                        data-pencil-name="Símbolo notificação Cancelamento por e-mail"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[16px] shrink-0 h-[16px]"
                      >
                        <path
                          d="M4.57666 0.60156q-0.12305 0.01367-0.24268 0.09912-0.11963 0.08203-0.1914 0.19483-0.04102 0.08545-0.05469 0.20508-0.01367 0.11621-0.01367 0.35546l0 0.29395-1.32959 0.01367q-0.14014 0.01367-0.23926 0.02735-0.50244 0.14014-0.85449 0.50586-0.34863 0.3623-0.44776 0.88183-0.02734 0.0957-0.02734 0.81006l0 7.99463 0.05469 0.15381q0.15723 0.51953 0.56055 0.86133 0.40674 0.3418 0.93994 0.3999 0.15381 0.02734 4.26904 0.02734 4.11523 0 4.26904-0.02734 0.30762-0.02734 0.58789-0.16748 0.32471-0.15381 0.56055-0.44092 0.23926-0.28711 0.35205-0.65283l0.05469-0.15381 0-7.99463q0-0.71436-0.02735-0.81006-0.09912-0.51953-0.45117-0.88183-0.34863-0.36572-0.85107-0.50586-0.09912-0.01367-0.23926-0.02735l-1.32959-0.01367 0-0.29395q0-0.32129-0.03418-0.45459-0.03418-0.1333-0.14697-0.24609-0.14014-0.14014-0.35889-0.16064-0.21533-0.02051-0.37597 0.09228-0.16064 0.10938-0.21875 0.29395-0.02734 0.05469-0.03418 0.1333-0.00684 0.0752-0.00684 0.30078l0 0.33496-3.5 0 0-0.34863q0-0.23926-0.00684-0.30762-0.00684-0.07178-0.03418-0.12646-0.08545-0.21191-0.25293-0.30762-0.16748-0.09912-0.37939-0.05811z m-0.50244 2.67285q0.01367 0.25293 0.02051 0.31788 0.00684 0.06152 0.03418 0.14697 0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445 0.02734-0.08545 0.03418-0.14014 0.00684-0.05811 0.02051-0.32129l0-0.36572 3.5 0 0 0.36572q0.01367 0.26318 0.02051 0.32129 0.00684 0.05469 0.03418 0.14014 0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115 0.02734-0.08545 0.03418-0.14697 0.00684-0.06494 0.02051-0.31788l0-0.34863 1.31592 0 0.08545 0.04102q0.08203 0.04443 0.15722 0.12304 0.07861 0.0752 0.11963 0.16065 0.04443 0.08203 0.05811 0.28027 0.01367 0.19482 0.01367 0.85108l0 0.86816-9.35156 0 0.01367-1.72266q0.01367-0.16748 0.02734-0.20849 0.09912-0.2666 0.35206-0.36572 0.05469-0.01367 0.16748-0.02735l1.18945 0 0 0.34863z m7.58789 5.82422q0 1.89014-0.00684 2.30371-0.00683 0.41357-0.0205 0.45459-0.09912 0.25293-0.35206 0.35205l-0.0957 0.04102-8.37402 0-0.0957-0.04102q-0.15381-0.0581-0.26661-0.19824l-0.02734-0.02734q-0.04443-0.05469-0.05811-0.15381-0.02734-0.14014-0.02734-0.60156l-0.01367-4.80225 9.35156 0-0.01367 2.67285z m-5.93701-1.49707q-0.23584 0.02734-0.37598 0.25977-0.14014 0.229-0.07178 0.46826 0.02734 0.09912 0.1128 0.20508 0.08545 0.10254 0.40673 0.41015l0.37598 0.39307-0.42041 0.42041q-0.26318 0.28027-0.34863 0.3623-0.09912 0.11279-0.11963 0.18458-0.02051 0.06836-0.02051 0.20849 0 0.14014 0.04102 0.23926 0.09912 0.19482 0.31445 0.28027 0.21875 0.08203 0.42725 0.01367 0.07178-0.02734 0.15381-0.10595 0.08545-0.07861 0.37939-0.35547l0.42041-0.42041 0.42041 0.42041q0.29395 0.27686 0.37598 0.35547 0.08545 0.07861 0.15722 0.10595 0.2085 0.06836 0.42383-0.01367 0.21875-0.08545 0.31787-0.28027 0.04102-0.09912 0.04102-0.23926 0-0.14014-0.02051-0.20849-0.02051-0.07178-0.11963-0.18458-0.08545-0.08203-0.34863-0.3623l-0.42041-0.42041 0.37597-0.39307q0.39307-0.37598 0.44776-0.44775 0.07178-0.12646 0.09228-0.2666 0.02051-0.14014-0.03759-0.27686-0.05469-0.14014-0.19483-0.25293-0.14014-0.11279-0.34863-0.11279-0.12646 0-0.19824 0.02734-0.06836 0.02734-0.18116 0.14014-0.0957 0.07178-0.3623 0.33496l-0.42041 0.42041-0.42041-0.42041q-0.43408-0.41699-0.51611-0.46142-0.15381-0.05469-0.33838-0.02735z"
                          fill="#637A20"
                        />
                      </svg>
                    </div>
                    <div
                      data-pencil-name="Texto notificação Cancelamento por e-mail"
                      className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título notificação Cancelamento por e-mail"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Cancelamento por e-mail
                      </div>
                      <div
                        data-pencil-name="Descrição notificação Cancelamento por e-mail"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                      >
                        Avisa o cliente quando uma reserva é cancelada.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifCancelamentoEmail}
                    aria-label={`${notifCancelamentoEmail ? "Desativar" : "Ativar"} cancelamento por e-mail`}
                    title={`${notifCancelamentoEmail ? "Desativar" : "Ativar"} cancelamento por e-mail`}
                    onClick={() => setNotifCancelamentoEmail(!notifCancelamentoEmail)}
                    data-pencil-name="Switch Cancelamento por e-mail"
                    className={`box-border min-w-[88px] shrink-0 h-[30px] flex items-center justify-center px-2 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                      notifCancelamentoEmail ? "bg-[#1F8A4C] text-white" : "bg-[#DED6CA] text-[#394236]"
                    }`}
                  >
                    {notifCancelamentoEmail ? "Desativar" : "Ativar"}
                  </button>
                </div>

                {/* 3. Comprovante de pagamento */}
                <div
                  data-pencil-name="Notificação Comprovante de pagamento"
                  className="box-border w-full min-h-[66.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-between items-center border-b border-[#EEE8DF]"
                >
                  <div className="flex flex-row gap-[12px] items-center flex-1 min-w-0">
                    <div
                      data-pencil-name="Ícone notificação Comprovante de pagamento"
                      className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F1F6E8] rounded-[10px]"
                    >
                      <svg
                        data-pencil-name="Símbolo notificação Comprovante de pagamento"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[16px] shrink-0 h-[16px]"
                      >
                        <path
                          d="M2.2251 0.58789q-0.29395 0.07178-0.42041 0.33496l-0.04102 0.09912 0 11.95606 0.04102 0.09912q0.04443 0.08203 0.11279 0.16064 0.07178 0.0752 0.14697 0.1128 0.07861 0.03418 0.18799 0.05468 0.11279 0.02051 0.19483 0 0.08545-0.02051 0.56396-0.25976l0.48877-0.23584 0.48877 0.23584q0.40674 0.19482 0.5332 0.24609 0.12646 0.04785 0.23584 0.02051 0.11279-0.02734 0.59131-0.2666l0.48877-0.23584 1.02197 0.50244 0.28028 0 1.02197-0.50244 0.48877 0.23584q0.47852 0.23926 0.58789 0.2666 0.11279 0.02734 0.23926-0.02051 0.12646-0.05127 0.5332-0.24609l0.48877-0.23584 0.48877 0.23584q0.42041 0.21191 0.55371 0.25293 0.1333 0.04101 0.25977 0 0.28027-0.08545 0.40673-0.33496l0.02735-0.08545 0.01367-11.91504-0.04102-0.0957q-0.0581-0.15381-0.19824-0.26661-0.14014-0.11279-0.34863-0.11279l-0.14014 0-1.02197 0.51953-1.02197-0.51953-0.12647 0q-0.14014 0-0.21191 0.02734-0.06836 0.02734-0.51611 0.25293l-0.46143 0.22217-1.0083-0.50244-0.30762 0-1.0083 0.50244-0.46143-0.22217q-0.44775-0.22559-0.51953-0.25293-0.06836-0.02734-0.20849-0.02734l-0.12647 0-1.02197 0.51953-0.51953-0.25293q-0.40332-0.21191-0.51611-0.24609-0.11279-0.03418-0.23926-0.00684l0-0.01367z m2.93945 1.4834l0.49219 0.25293 0.34863 0 0.99463-0.50586 0.99463 0.50586 0.34863 0 0.98096-0.50586 1.0083 0.50586 0.33496 0 0.40674-0.2085 0 4.88428q0 4.8877-0.00684 4.88769-0.00684 0-0.20508-0.09912l-0.19482-0.11279-0.33496 0-0.99463 0.50586-1.0083-0.50586-0.33496 0-0.99463 0.50586-0.99463-0.50586-0.33496 0-1.0083 0.50586-0.99463-0.50586-0.33496 0-0.19482 0.11279q-0.19824 0.09912-0.20508 0.09912-0.00684 0-0.00684-4.88769l0-4.88428 0.40674 0.2085 0.33496 0 0.99463-0.50586 0.50244 0.25293z m1.73633 1.14844q-0.18115 0.02734-0.32129 0.18115-0.09912 0.08545-0.12646 0.19141-0.02734 0.10254-0.02735 0.2871l0 0.19483-0.2666 0q-0.54688 0-0.81006 0.08545-0.43408 0.12305-0.75195 0.44092-0.31445 0.31445-0.4375 0.74853-0.18457 0.64258 0.10937 1.25781 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863 0.11279 0.02734 0.20166 0.04102 0.09229 0.01367 0.41358 0.01367l0.44775 0 0 1.17578-1.90381 0.01367-0.09912 0.04102q-0.08203 0.04443-0.16064 0.11621-0.0752 0.06836-0.11963 0.13672-0.12305 0.2666 0 0.5332 0.12646 0.2666 0.42041 0.30762 0.09912 0.02734 0.98096 0.02734l0.88183 0 0 0.19482q0 0.19824 0.02735 0.29737 0.02734 0.0957 0.12646 0.19482 0.18115 0.16748 0.42041 0.16748 0.23926 0 0.42041-0.16748 0.09912-0.09912 0.12647-0.19482 0.02734-0.09912 0.02734-0.29737l0-0.19482 0.42041-0.01367q0.34863 0 0.51611-0.02734 0.1709-0.02734 0.36572-0.12647 0.58789-0.25293 0.86817-0.84766 0.28027-0.59473 0.11279-1.20996-0.11279-0.39307-0.39306-0.70068-0.28027-0.30762-0.65967-0.46143-0.18115-0.07178-0.3418-0.09228-0.16064-0.02051-0.4956-0.02051l-0.39307 0 0-1.17578 1.90381-0.01367 0.09912-0.04102q0.08203-0.04443 0.15723-0.11279 0.07861-0.07178 0.11279-0.14014 0.0376-0.07178 0.05127-0.18115 0.04102-0.19824-0.05127-0.36572-0.08887-0.16748-0.28369-0.2666l-0.09912-0.04102-1.89014-0.01367 0-0.19483q0-0.21191-0.02734-0.29394-0.07178-0.19824-0.25293-0.29395-0.18115-0.09912-0.39307-0.07177z m-0.4751 2.61816l0 0.58789-0.29394 0q-0.33496 0-0.46143-0.03418-0.12646-0.03418-0.23926-0.14697-0.16748-0.15381-0.17431-0.38281-0.00684-0.23242 0.14697-0.417 0.09912-0.12646 0.28027-0.16748 0.08545-0.02734 0.40674-0.02734l0.33496 0 0 0.58789z m1.83545 1.76367q0.30762 0.04102 0.43408 0.32129 0.04102 0.09912 0.04102 0.23926 0 0.32129-0.23926 0.48877-0.0957 0.05811-0.20166 0.07861-0.10596 0.02051-0.38623 0.02051l-0.33496 0 0-1.17578 0.29394 0q0.28027 0 0.39307 0.02734z"
                          fill="#637A20"
                        />
                      </svg>
                    </div>
                    <div
                      data-pencil-name="Texto notificação Comprovante de pagamento"
                      className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título notificação Comprovante de pagamento"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Comprovante de pagamento
                      </div>
                      <div
                        data-pencil-name="Descrição notificação Comprovante de pagamento"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                      >
                        Envia o comprovante PDF após a confirmação do pagamento.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPagamentoEmail}
                    aria-label={`${notifPagamentoEmail ? "Desativar" : "Ativar"} comprovante de pagamento`}
                    title={`${notifPagamentoEmail ? "Desativar" : "Ativar"} comprovante de pagamento`}
                    onClick={() => setNotifPagamentoEmail(!notifPagamentoEmail)}
                    data-pencil-name="Switch Comprovante de pagamento"
                    className={`box-border min-w-[88px] shrink-0 h-[30px] flex items-center justify-center px-2 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                      notifPagamentoEmail ? "bg-[#1F8A4C] text-white" : "bg-[#DED6CA] text-[#394236]"
                    }`}
                  >
                    {notifPagamentoEmail ? "Desativar" : "Ativar"}
                  </button>
                </div>

                {/* 4. Compartilhamento por WhatsApp */}
                <div
                  data-pencil-name="Notificação Compartilhamento por WhatsApp"
                  className="box-border w-full min-h-[66.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-between items-center border-b border-[#EEE8DF]"
                >
                  <div className="flex flex-row gap-[12px] items-center flex-1 min-w-0">
                    <div
                      data-pencil-name="Ícone notificação Compartilhamento por WhatsApp"
                      className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F0ECE6] rounded-[10px]"
                    >
                      <svg
                        data-pencil-name="Símbolo notificação Compartilhamento por WhatsApp"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[16px] shrink-0 h-[16px]"
                      >
                        <path
                          d="M6.80518 0.58789q-0.5332 0.01367-1.10059 0.1333-0.56738 0.11963-1.06982 0.31445-1.3877 0.56055-2.396 1.67481-1.0083 1.11084-1.41162 2.55322-0.30762 1.09375-0.22559 2.21485 0.08545 1.11768 0.54688 2.15332l0.01367 0.04101q0.06836 0.14014 0.07519 0.22559 0.01025 0.08203-0.04785 0.29394-0.04102 0.15381-0.20849 0.66992l-0.05811 0.14014q-0.30762 0.98096-0.33496 1.1211-0.01367 0.16748 0.02734 0.37255 0.04443 0.20166 0.14014 0.35547 0.05811 0.09912 0.17432 0.21875 0.11963 0.11621 0.21875 0.17432 0.16748 0.0957 0.3623 0.14014 0.19824 0.04101 0.3794 0.02734 0.12646-0.02734 1.14843-0.32129l0.14014-0.04443q0.54688-0.15381 0.70068-0.19483 0.22217-0.05469 0.29737-0.04785 0.07861 0.00684 0.20508 0.06152l0.02734 0.01368q0.88184 0.37939 1.97559 0.50586 0.16748 0.02734 0.59472 0.02734 0.42725 0 0.62207-0.02734 0.85449-0.08545 1.64405-0.3794 0.79297-0.29395 1.47998-0.78271 0.93652-0.65967 1.5791-1.60987 0.646-0.95361 0.92627-2.05761 0.28027-1.10742 0.15381-2.23877-0.12647-1.13477-0.646-2.17383-0.66992-1.35693-1.90381-2.27979-1.23047-0.92627-2.72754-1.17578-0.63232-0.11279-1.30224-0.09912z m0.58789 1.17578q1.38428 0.11279 2.5122 0.86133 1.12793 0.74854 1.77051 1.98242 0.40674 0.79639 0.5332 1.75 0.02734 0.22217 0.02735 0.64258 0 0.42041-0.02735 0.65967-0.16748 1.24414-0.85449 2.26611-0.68701 1.02197-1.76367 1.63721-0.57422 0.32471-1.24756 0.50586-0.66992 0.18115-1.32959 0.18115-1.07666 0-2.12597-0.44775-0.19824-0.08545-0.31788-0.11963-0.11621-0.03418-0.28711-0.04785-0.23584-0.01367-0.45458 0.02734-0.21533 0.04102-1.04249 0.28027-1.0083 0.29395-1.01513 0.28711-0.00684-0.00684 0.30078-0.95703 0.30762-0.95361 0.32129-1.10742 0.07178-0.44775-0.14014-0.9126l-0.14014-0.34863q-0.38965-0.96729-0.3623-2.03711 0.02734-1.06982 0.46143-2.02344 0.44775-0.99463 1.25097-1.72265 0.80664-0.72803 1.82178-1.0835 1.01514-0.35547 2.10889-0.27344z"
                          fill="#7B746B"
                        />
                      </svg>
                    </div>
                    <div
                      data-pencil-name="Texto notificação Compartilhamento por WhatsApp"
                      className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título notificação Compartilhamento por WhatsApp"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Compartilhamento por WhatsApp
                      </div>
                      <div
                        data-pencil-name="Descrição notificação Compartilhamento por WhatsApp"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                      >
                        Abre uma mensagem pronta com o link da reserva.
                      </div>
                    </div>
                  </div>

                  <div
                    data-pencil-name="Badge manual Compartilhamento por WhatsApp"
                    className="box-border w-fit shrink-0 h-fit flex flex-row px-[9px] py-[5px] justify-start items-start bg-[#EAF8EF] rounded-full"
                  >
                    <span
                      data-pencil-name="Texto manual Compartilhamento por WhatsApp"
                      className="text-[9px]/[normal] box-border text-[#1F7A45] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      Disponível no portal
                    </span>
                  </div>
                </div>

                {/* 5. Alerta de pagamento pendente */}
                <div
                  data-pencil-name="Notificação Alerta de pagamento pendente"
                  className="box-border w-full min-h-[66.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-between items-center"
                >
                  <div className="flex flex-row gap-[12px] items-center flex-1 min-w-0">
                    <div
                      data-pencil-name="Ícone notificação Alerta de pagamento pendente"
                      className="box-border w-[36px] shrink-0 h-[36px] flex flex-row gap-0 justify-center items-center bg-[#F0ECE6] rounded-[10px]"
                    >
                      <svg
                        data-pencil-name="Símbolo notificação Alerta de pagamento pendente"
                        viewBox="0 0 13.99993896484375 14"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        className="box-border w-[16px] shrink-0 h-[16px]"
                      >
                        <path
                          d="M6.59326 0.60156q-0.99463 0.05811-1.92431 0.42383-0.92969 0.3623-1.7295 1.00488-0.16748 0.12646-0.47509 0.44092-0.30762 0.31445-0.43409 0.46826-0.95361 1.18945-1.28857 2.63184-0.37939 1.62354 0.11279 3.24707 0.46143 1.56885 1.6167 2.72412 1.15527 1.15527 2.72412 1.60303 1.97217 0.57422 3.91699-0.09912 0.37939-0.12305 0.52637-0.21534 0.14697-0.09228 0.21875-0.23242 0.08203-0.19482 0.04102-0.38965-0.08545-0.33838-0.40674-0.42041-0.11279-0.04101-0.21875-0.0205-0.10254 0.02051-0.31445 0.10253-1.71924 0.65967-3.4419 0.15381-1.32959-0.37598-2.30371-1.39111-0.97412-1.01514-1.30908-2.37207-0.23926-0.95361-0.11279-1.93115 0.12646-0.98096 0.60156-1.84912 0.57422-1.03564 1.52441-1.7295 0.95361-0.69385 2.11572-0.91601 0.43408-0.07178 0.98096-0.07178 0.30762 0 0.49561 0.01367 0.19141 0.01367 0.44433 0.05811 0.9502 0.18115 1.79785 0.70068 0.84766 0.51611 1.42188 1.28516 0.36231 0.49219 0.62891 1.06641 0.09912 0.19482 0.17431 0.29394 0.07861 0.0957 0.20508 0.13672 0.18115 0.07178 0.36914 0.02393 0.18799-0.05127 0.30762-0.20508 0.11963-0.15381 0.11963-0.34864 0-0.19824-0.22559-0.6289-0.78271-1.55518-2.21142-2.50537-1.42871-0.95361-3.16163-1.05274-0.39307-0.02734-0.78613 0z m0.25293 2.33789q-0.25293 0.08545-0.37939 0.30762l-0.04102 0.08545 0 3.83496 0.04102 0.08545q0.05811 0.0957 0.12646 0.15381 0.08545 0.06836 0.36572 0.22217l0.90918 0.46142q1.20312 0.60498 1.30225 0.63233 0.23926 0.06836 0.45459-0.05469 0.21533-0.12646 0.27344-0.3794 0.04102-0.18115-0.04102-0.37939-0.04443-0.0957-0.11621-0.15039-0.06836-0.05811-0.31787-0.18457l-1.83545-0.93652-0.01367-3.30518-0.04102-0.08545q-0.09912-0.18115-0.28027-0.2666-0.08545-0.04102-0.22559-0.04785-0.14014-0.00684-0.18115 0.00683z m4.63477 3.51368q-0.23926 0.08545-0.35205 0.33837l-0.04102 0.08204-0.01367 1.51416q0 1.18945 0.01367 1.44238 0.01367 0.24951 0.05469 0.3623 0.04443 0.06836 0.11963 0.14014 0.07861 0.06836 0.16064 0.11279 0.19824 0.08203 0.39307 0.03418 0.19482-0.04785 0.32129-0.21875l0.01367-0.01367q0.0581-0.08203 0.07178-0.15381 0.01367-0.11279 0.02734-0.43408l-0.01367-2.81299-0.04102-0.09912q-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.18115-0.11963-0.08887-0.0376-0.20849-0.0376-0.11963 0-0.18799 0.02735z m0 5.25q-0.18457 0.0581-0.29053 0.21191-0.10254 0.15381-0.10254 0.33496 0 0.23926 0.17432 0.41357 0.17432 0.17432 0.42041 0.16065 0.24609-0.01367 0.3999-0.16748 0.09912-0.09912 0.12646-0.18115 0.02734-0.08545 0.02735-0.23926 0-0.15381-0.04102-0.23926-0.08545-0.18115-0.2666-0.2666-0.08545-0.04102-0.23242-0.05469-0.14697-0.01367-0.21533 0.02735z"
                          fill="#7B746B"
                        />
                      </svg>
                    </div>
                    <div
                      data-pencil-name="Texto notificação Alerta de pagamento pendente"
                      className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Título notificação Alerta de pagamento pendente"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Alerta de pagamento pendente
                      </div>
                      <div
                        data-pencil-name="Descrição notificação Alerta de pagamento pendente"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left truncate w-full"
                      >
                        Exibe um alerta quando a reserva mantém saldo em aberto.
                      </div>
                    </div>
                  </div>

                  <div
                    data-pencil-name="Minutos Alerta de pagamento pendente"
                    className="box-border w-[80px] shrink-0 h-[34px] flex flex-row gap-[5px] px-[8px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#D8D0C4] -outline-offset-1 rounded-[8px] focus-within:outline-[#071915]"
                  >
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={alertaPagamentoMinutos}
                      onChange={(e) => setAlertaPagamentoMinutos(Math.min(180, Math.max(1, parseInt(e.target.value) || 0)))}
                      className="w-[34px] text-right bg-transparent text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold outline-none"
                    />
                    <span
                      data-pencil-name="Label minutos Alerta de pagamento pendente"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left select-none"
                    >
                      min
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer notificações */}
              <div
                data-pencil-name="Footer notificações"
                className="box-border w-full h-[44px] shrink-0 flex flex-row justify-end items-center"
              >
                <button
                  type="button"
                  onClick={handleSaveNotificacoes}
                  disabled={salvandoNotificacoes}
                  data-pencil-name="Salvar notificações"
                  className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[17px] justify-start items-center bg-[#071915] hover:bg-neutral-800 transition-colors rounded-[10px] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <svg
                    data-pencil-name="Ícone salvar notificações"
                    viewBox="0 0 13.99993896484375 14"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                    className="box-border w-[15px] shrink-0 h-[15px]"
                  >
                    <path
                      d="M2.60449 1.20313q-0.50586 0.08545-0.87842 0.43749-0.36914 0.34863-0.50927 0.86475-0.02734 0.08545-0.02735 0.71436l-0.01367 3.78027 0.01367 3.78027q0 0.62891 0.02735 0.71436 0.14014 0.48877 0.46826 0.82031 0.33154 0.32813 0.82031 0.46826 0.08545 0.02734 0.71436 0.02735l3.78027 0.01367 3.78027-0.01367q0.62891 0 0.71436-0.02735 0.48877-0.14014 0.81689-0.46826 0.33154-0.33154 0.47168-0.82031 0.02734-0.08545 0.02735-0.56055l0.01367-6.09082-0.05469-0.16748q-0.09912-0.32129-0.29394-0.57422-0.09912-0.14014-1.31592-1.34326l-0.92627-0.92285q-0.28027-0.28027-0.42041-0.3794-0.0957-0.06836-0.2666-0.14013-0.12305-0.05469-0.26319-0.09912l-0.14013-0.04102-3.20606 0q-3.21973 0-3.33252 0.02734z m0.89551 2.05761q0 0.93994 0.01367 1.03565 0.07178 0.35205 0.33496 0.61181 0.2666 0.25635 0.61866 0.32813 0.10938 0.01367 2.26611 0.01367l2.17041-0.01367 0.09912-0.04102q0.2666-0.12646 0.32129-0.42041 0.05469-0.29395-0.15381-0.50586-0.14014-0.14014-0.33496-0.16748-0.11279-0.02734-2.14307-0.02734l-2.0166 0 0-1.75 2.07129 0q2.07129 0 2.18408 0.01367l0.01367 0.01367q0.09912 0.01367 0.18457 0.05811 0.0957 0.06836 0.34864 0.32129l1.80468 1.79101q0.23926 0.25293 0.30762 0.36573 0.04443 0.06836 0.05811 0.18115l0.01367 0.01367q0.01367 0.11279 0 3.12061l0 3.01122-0.04102 0.09913q-0.09912 0.19482-0.2666 0.29394-0.08545 0.04102-0.20508 0.05469-0.11621 0.01367-0.35546 0.01367l-0.29395 0 0-1.80469q0-1.80811-0.01367-1.91748-0.05469-0.31104-0.28711-0.56054-0.23242-0.25293-0.55371-0.35205-0.06836-0.02734-0.44776-0.02735l-4.22802 0q-0.44775 0-0.58789 0.02735-0.11279 0.01367-0.2085 0.07177l-0.05811 0.02735q-0.12646 0.05469-0.28027 0.20849-0.15381 0.15381-0.2085 0.28028l-0.02734 0.0581q-0.04443 0.0957-0.0581 0.18115-0.02734 0.12646-0.02735 0.46143l-0.01367 3.34619-0.29395 0q-0.23926 0-0.35888-0.01367-0.11621-0.01367-0.20166-0.05469-0.16748-0.09912-0.2666-0.29394l-0.04102-0.09913 0-8.42871 0.04102-0.09912q0.07178-0.14014 0.18798-0.229 0.11963-0.09229 0.25977-0.11963 0.08545 0 0.37939-0.01367l0.29395 0 0 0.93652z m5.82422 6.66504l0 1.75-4.64844 0 0-3.5 4.64844 0 0 1.75z"
                      fill="#C9FF3B"
                    />
                  </svg>
                  <span
                    data-pencil-name="Texto salvar notificações"
                    className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    {salvandoNotificacoes ? "Salvando..." : "Salvar notificações"}
                  </span>
                </button>
              </div>
              </>
              )}
            </div>
          )}

          {/* Painel Motivos de Cancelamento */}
          {activeTab === "cancelamentos" && (
            <div
              data-pencil-name="Painel Motivos de Cancelamento"
              className="box-border flex-1 md:[flex:1_1_0] w-full min-w-0 flex flex-col gap-[16px] p-[22px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] shadow-sm font-[Inter,system-ui,sans-serif]"
            >
              {/* Cabeçalho motivos */}
              <div
                data-pencil-name="Cabeçalho motivos"
                className="box-border w-full h-[54px] shrink-0 flex flex-row gap-0 justify-between items-center"
              >
                <div
                  data-pencil-name="Texto cabeçalho motivos"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[5px] justify-start items-start"
                >
                  <h2
                    data-pencil-name="Título motivos"
                    className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Motivos de cancelamento
                  </h2>
                  <p
                    data-pencil-name="Descrição motivos"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                  >
                    Defina as opções exibidas ao cancelar uma reserva.
                  </p>
                </div>
                {canManageMotivos && <button
                  type="button"
                  onClick={handleOpenAdicionarMotivo}
                  data-pencil-name="Adicionar motivo"
                  className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[7px] px-[14px] justify-start items-center bg-[#071915] hover:bg-neutral-800 transition-colors rounded-[10px] cursor-pointer shadow-sm"
                >
                  <Plus className="w-[15px] h-[15px] text-[#C9FF3B]" />
                  <span
                    data-pencil-name="Texto adicionar motivo"
                    className="text-[11px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    Adicionar motivo
                  </span>
                </button>}
              </div>

              {/* Resumo motivos (3 Cards Métricas) */}
              <div
                data-pencil-name="Resumo motivos"
                className="box-border w-full h-auto sm:h-[82px] shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-[12px] justify-start items-stretch"
              >
                {/* 1. Motivos ativos */}
                <div
                  data-pencil-name="Resumo motivo motivos ativos"
                  className="box-border flex-1 h-full flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone resumo motivos ativos"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row justify-center items-center bg-[#E9F1FF] rounded-[11px]"
                  >
                    <ListChecks className="w-[17px] h-[17px] text-[#2457C5]" />
                  </div>
                  <div
                    data-pencil-name="Texto resumo motivos ativos"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Valor resumo motivos ativos"
                      className="text-[17px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      {estatisticasCancelamentos ? motivos.length : "—"}
                    </div>
                    <div
                      data-pencil-name="Label resumo motivos ativos"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                    >
                      motivos ativos
                    </div>
                  </div>
                </div>

                {/* 2. Cancelamentos no mês */}
                <div
                  data-pencil-name="Resumo motivo cancelamentos no mês"
                  className="box-border flex-1 h-full flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone resumo cancelamentos no mês"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row justify-center items-center bg-[#FFF3DB] rounded-[11px]"
                  >
                    <CalendarX className="w-[17px] h-[17px] text-[#A85A00]" />
                  </div>
                  <div
                    data-pencil-name="Texto resumo cancelamentos no mês"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Valor resumo cancelamentos no mês"
                      className="text-[17px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      {estatisticasCancelamentos?.mes.total ?? "—"}
                    </div>
                    <div
                      data-pencil-name="Label resumo cancelamentos no mês"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                    >
                      cancelamentos no mês
                    </div>
                  </div>
                </div>

                {/* 3. Por desistência */}
                <div
                  data-pencil-name="Resumo motivo por desistência"
                  className="box-border flex-1 h-full flex flex-row gap-[11px] p-[13px] justify-start items-center bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[13px]"
                >
                  <div
                    data-pencil-name="Ícone resumo por desistência"
                    className="box-border w-[38px] shrink-0 h-[38px] flex flex-row justify-center items-center bg-[#EAF8EF] rounded-[11px]"
                  >
                    <UserX className="w-[17px] h-[17px] text-[#1F7A45]" />
                  </div>
                  <div
                    data-pencil-name="Texto resumo por desistência"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[3px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Valor resumo por desistência"
                      className="text-[17px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      {estatisticasCancelamentos ? `${porcentagemDesistencia}%` : "—"}
                    </div>
                    <div
                      data-pencil-name="Label resumo por desistência"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                    >
                      por desistência
                    </div>
                  </div>
                </div>
              </div>

              {erroMotivos && (
                <div role="alert" className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
                  <span>{erroMotivos}</span>
                  <button type="button" onClick={loadMotivos} className="font-bold underline cursor-pointer">Tentar novamente</button>
                </div>
              )}

              {/* Conteúdo motivos (Grid/Flex 2 colunas) */}
              <div
                data-pencil-name="Conteúdo motivos"
                className="box-border w-full flex-1 flex flex-col lg:flex-row gap-[14px] justify-start items-start"
              >
                {/* Lista motivos (Coluna Esquerda) */}
                <div
                  data-pencil-name="Lista motivos"
                  className="box-border flex-1 w-full flex flex-col gap-0 justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#EAE4DA] -outline-offset-1 rounded-[14px] overflow-hidden"
                >
                  <div
                    data-pencil-name="Cabeçalho lista motivos"
                    className="box-border w-full h-[43.5px] shrink-0 flex flex-row gap-0 px-[16px] justify-start items-center bg-[#F5F1EA] border-b border-[#EAE4DA]"
                  >
                    <span
                      data-pencil-name="Título lista motivos"
                      className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-extrabold tracking-[0.7px] text-left whitespace-nowrap"
                    >
                      MOTIVOS CADASTRADOS
                    </span>
                  </div>

                  {/* Render lista de motivos */}
                  {loadingMotivos && motivos.length === 0 && <div className="p-4 text-sm text-[#6F766F]">Carregando motivos...</div>}
                  {motivosComUso.map((m) => {
                    const visual = getMotivoVisual(m.motivo);
                    const VisualIcon = visual.Icon;
                    return (
                      <div
                        key={m.id}
                        data-pencil-name={`Motivo ${m.motivo}`}
                        className="box-border w-full min-h-[69.5px] shrink-0 flex flex-row gap-[12px] px-[16px] justify-start items-center border-b border-[#EEE8DF] hover:bg-[#F7F2EA]/40 transition-colors"
                      >
                        <GripVertical
                          data-pencil-name={`Arrastar ${m.motivo}`}
                          className="box-border w-[14px] shrink-0 h-[14px] text-[#B3ADA4]"
                        />
                        <div
                          data-pencil-name={`Ícone motivo ${m.motivo}`}
                          className={`box-border w-[36px] shrink-0 h-[36px] flex flex-row justify-center items-center ${visual.bgIcon} rounded-[10px]`}
                        >
                          <VisualIcon className={`w-[16px] h-[16px] ${visual.colorIcon}`} />
                        </div>
                        <div
                          data-pencil-name={`Conteúdo motivo ${m.motivo}`}
                          className="box-border flex-1 min-w-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                        >
                          <div
                            data-pencil-name={`Linha nome motivo ${m.motivo}`}
                            className="box-border w-fit h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
                          >
                            <span
                              data-pencil-name={`Nome motivo ${m.motivo}`}
                              className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                            >
                              {m.motivo}
                            </span>
                            {m.id < 0 && <span className="text-[9px] text-[#6F766F]">Padrão do sistema</span>}
                            {m.contagem > 0 && m.contagem === maiorContagem && (
                              <div
                                data-pencil-name={`Padrão ${m.motivo}`}
                                className="box-border w-fit shrink-0 h-fit flex flex-row px-[7px] py-[3px] justify-start items-start bg-[#EAF8EF] rounded-full"
                              >
                                <span
                                  data-pencil-name={`Texto padrão ${m.motivo}`}
                                  className="text-[8px]/[normal] box-border text-[#1F7A45] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                                >
                                  Mais usado
                                </span>
                              </div>
                            )}
                          </div>
                          <div
                            data-pencil-name={`Uso motivo ${m.motivo}`}
                            className="text-[9px]/[normal] box-border text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                          >
                            {m.contagem ?? 0} cancelamentos nos últimos 30 dias
                          </div>
                        </div>

                        {canManageMotivos && <div
                          data-pencil-name={`Ações motivo ${m.motivo}`}
                          className="box-border w-fit shrink-0 h-fit flex flex-row gap-[6px] justify-start items-start"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEditarMotivo(m)}
                            title={m.id < 0 ? "Motivo padrão do sistema" : "Editar motivo"}
                            disabled={m.id < 0}
                            data-pencil-name={`Editar ${m.motivo}`}
                            className="box-border w-[32px] shrink-0 h-[32px] flex flex-row justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] hover:bg-[#FAF8F4] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            <Pencil className="w-[14px] h-[14px] text-[#4F5550]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirMotivo(m)}
                            title={m.id < 0 ? "Motivo padrão do sistema" : "Excluir motivo"}
                            disabled={m.id < 0}
                            data-pencil-name={`Remover ${m.motivo}`}
                            className={`box-border w-[32px] shrink-0 h-[32px] flex flex-row justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] transition-colors ${
                              m.id < 0 ? "opacity-35 cursor-not-allowed" : "hover:bg-red-50 cursor-pointer"
                            }`}
                          >
                            <Trash2 className="w-[14px] h-[14px] text-[#B63A2C]" />
                          </button>
                        </div>}
                      </div>
                    );
                  })}

                  {/* Distribuição de cancelamentos */}
                  <div
                    data-pencil-name="Distribuição de cancelamentos"
                    className="box-border w-full flex-1 flex flex-col gap-[10px] p-[16px] justify-start items-start bg-[#F8F5EF]"
                  >
                    <div
                      data-pencil-name="Cabeçalho distribuição"
                      className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-center"
                    >
                      <span
                        data-pencil-name="Título distribuição"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Distribuição nos últimos 30 dias
                      </span>
                      <span
                        data-pencil-name="Total distribuição"
                        className="text-[9px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                      >
                        {total30Dias} cancelamentos
                      </span>
                    </div>

                    {/* Barras de distribuição */}
                    {distribuicao.map((m) => {
                      const visual = getMotivoVisual(m.motivo);
                      const pct = m.porcentagem ?? 0;
                      return (
                        <div
                          key={`dist-${m.id}`}
                          data-pencil-name={`Barra ${m.motivo}`}
                          className="box-border w-full h-fit shrink-0 flex flex-row gap-[10px] justify-start items-center"
                        >
                          <div
                            data-pencil-name={`Nome barra ${m.motivo}`}
                            className="text-[9px]/[normal] box-border w-[150px] shrink-0 text-[#4F5550] font-[Inter,system-ui,sans-serif] font-semibold text-left truncate"
                          >
                            {m.motivo}
                          </div>
                          <div
                            data-pencil-name={`Trilho ${m.motivo}`}
                            className="box-border flex-1 h-[7px] bg-[#E7E1D8] rounded-[4px] relative overflow-hidden"
                          >
                            <div
                              data-pencil-name={`Progresso ${m.motivo}`}
                              style={{ width: `${pct}%` }}
                              className={`h-[7px] ${visual.barColor} rounded-[4px] transition-all duration-300`}
                            />
                          </div>
                          <div
                            data-pencil-name={`Percentual ${m.motivo}`}
                            className={`text-[9px]/[normal] box-border w-[28px] shrink-0 ${visual.textColor} font-[Inter,system-ui,sans-serif] font-extrabold text-right`}
                          >
                            {pct}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ajuda motivos (Coluna Direita - 245px) */}
                <div
                  data-pencil-name="Ajuda motivos"
                  className="box-border w-full lg:w-[245px] shrink-0 h-full flex flex-col gap-[12px] justify-start items-start"
                >
                  {/* Card Como funcionam */}
                  <div
                    data-pencil-name="Como funcionam motivos"
                    className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] p-[17px] justify-start items-start bg-[#071915] rounded-[14px]"
                  >
                    <div
                      data-pencil-name="Ícone ajuda motivos"
                      className="box-border w-[34px] h-[34px] shrink-0 flex flex-row justify-center items-center bg-[#C9FF3B] rounded-[10px]"
                    >
                      <Info className="w-[16px] h-[16px] text-[#071915]" />
                    </div>
                    <div
                      data-pencil-name="Título ajuda motivos"
                      className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Como funciona?
                    </div>
                    <div
                      data-pencil-name="Texto ajuda motivos"
                      className="text-[10px]/[15px] box-border w-full text-[#A7B6AE] font-[Inter,system-ui,sans-serif] font-medium text-left"
                    >
                      Essas opções aparecem para a equipe no momento de cancelar uma reserva e alimentam seus relatórios.
                      {' '}Os motivos padrão do sistema não podem ser editados ou excluídos. Você pode adicionar motivos próprios e editá-los.
                    </div>
                  </div>

                  {/* Card Dica */}
                  <div
                    data-pencil-name="Dica motivos"
                    className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] p-[15px] justify-start items-start bg-[#F4F9F0] outline outline-1 outline-[#DCE8D2] -outline-offset-1 rounded-[14px]"
                  >
                    <div
                      data-pencil-name="Título dica motivos"
                      className="text-[11px]/[normal] box-border text-[#3E542A] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Dica
                    </div>
                    <div
                      data-pencil-name="Texto dica motivos"
                      className="text-[9px]/[13px] box-border w-full text-[#6B7960] font-[Inter,system-ui,sans-serif] font-medium text-left"
                    >
                      Use nomes curtos e objetivos para manter o atendimento rápido.
                    </div>
                  </div>

                  {/* Card Impacto do mês */}
                  <div
                    data-pencil-name="Impacto dos cancelamentos"
                    className="box-border w-full min-h-[128px] shrink-0 flex flex-col gap-[9px] p-[15px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[14px] shadow-sm"
                  >
                    <div
                      data-pencil-name="Header impacto cancelamentos"
                      className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-center"
                    >
                      <span
                        data-pencil-name="Título impacto"
                        className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                      >
                        Impacto do mês
                      </span>
                      <TrendingDown className="box-border w-[16px] shrink-0 h-[16px] text-[#B63A2C]" />
                    </div>
                    <div
                      data-pencil-name="Métricas impacto"
                      className="box-border w-full h-fit shrink-0 flex flex-row gap-[10px] justify-start items-start"
                    >
                      <div
                        data-pencil-name="Impacto canceladas"
                        className="box-border flex-1 h-fit flex flex-col gap-[3px] justify-start items-start"
                      >
                        <div
                          data-pencil-name="Valor impacto canceladas"
                          className="text-[16px]/[normal] box-border text-[#B63A2C] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                        >
                          {estatisticasCancelamentos?.mes.total ?? "—"}
                        </div>
                        <div
                          data-pencil-name="Label impacto canceladas"
                          className="text-[8px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                        >
                          canceladas
                        </div>
                      </div>
                      <div
                        data-pencil-name="Impacto receita afetada"
                        className="box-border flex-1 h-fit flex flex-col gap-[3px] justify-start items-start"
                      >
                        <div
                          data-pencil-name="Valor impacto receita afetada"
                          className="text-[16px]/[normal] box-border text-[#A85A00] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                        >
                          {estatisticasCancelamentos ? formatCurrency(estatisticasCancelamentos.mes.valorTotal) : "—"}
                        </div>
                        <div
                          data-pencil-name="Label impacto receita afetada"
                          className="text-[8px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-semibold text-left whitespace-nowrap"
                        >
                          valor das reservas
                        </div>
                      </div>
                    </div>
                    <div
                      data-pencil-name="Nota impacto"
                      className="text-[9px]/[normal] box-border w-full text-[#8A8F88] font-[Inter,system-ui,sans-serif] font-medium text-left"
                    >
                      Acompanhe os motivos para reduzir perdas recorrentes.
                    </div>
                  </div>

                  {/* Card Boas práticas */}
                  <div
                    data-pencil-name="Boas práticas cancelamentos"
                    className="box-border w-full flex-1 flex flex-col gap-[10px] p-[15px] justify-start items-start bg-[#F5F1EA] rounded-[14px]"
                  >
                    <div
                      data-pencil-name="Título boas práticas"
                      className="text-[11px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      Boas práticas
                    </div>

                    <div
                      data-pencil-name="Prática Revise os motivos mensalmente"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] justify-start items-start"
                    >
                      <CheckCircle2 className="w-[13px] shrink-0 h-[13px] text-[#708E25] mt-[1px]" />
                      <div
                        data-pencil-name="Texto Revise os motivos mensalmente"
                        className="text-[9px]/[12px] box-border w-[180px] shrink-0 text-[#5F675B] font-[Inter,system-ui,sans-serif] font-semibold text-left"
                      >
                        Revise os motivos mensalmente
                      </div>
                    </div>

                    <div
                      data-pencil-name="Prática Evite opções com significado parecido"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] justify-start items-start"
                    >
                      <CheckCircle2 className="w-[13px] shrink-0 h-[13px] text-[#708E25] mt-[1px]" />
                      <div
                        data-pencil-name="Texto Evite opções com significado parecido"
                        className="text-[9px]/[12px] box-border w-[180px] shrink-0 text-[#5F675B] font-[Inter,system-ui,sans-serif] font-semibold text-left"
                      >
                        Evite opções com significado parecido
                      </div>
                    </div>

                    <div
                      data-pencil-name="Prática Use os dados nos relatórios da arena"
                      className="box-border w-fit h-fit shrink-0 flex flex-row gap-[8px] justify-start items-start"
                    >
                      <CheckCircle2 className="w-[13px] shrink-0 h-[13px] text-[#708E25] mt-[1px]" />
                      <div
                        data-pencil-name="Texto Use os dados nos relatórios da arena"
                        className="text-[9px]/[12px] box-border w-[180px] shrink-0 text-[#5F675B] font-[Inter,system-ui,sans-serif] font-semibold text-left"
                      >
                        Use os dados nos relatórios da arena
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar / Editar Usuário */}
      {modalUsuarioOpen && (
        <div
          data-pencil-name="Overlay Novo Usuário"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07191566] backdrop-blur-[2.5px] p-4 font-[Inter,system-ui,sans-serif]"
        >
          <div
            data-pencil-name="Modal Novo Usuário"
            className="box-border w-full max-w-[500px] max-h-[90vh] bg-[#FCFAF6] outline outline-1 outline-[#E3DBCF] -outline-offset-1 rounded-[22px] shadow-[0px_22px_52px_#0000003D] overflow-y-auto flex flex-col gap-[20px] p-[28px]"
          >
            {/* Cabeçalho refinado usuário */}
            <div
              data-pencil-name="Cabeçalho refinado usuário"
              className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-start"
            >
              <div
                data-pencil-name="Identidade modal usuário"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[12px] justify-start items-center"
              >
                <div
                  data-pencil-name="Ícone usuário novo"
                  className="box-border w-[44px] shrink-0 h-[44px] flex flex-row justify-center items-center bg-[#071915] rounded-[13px]"
                >
                  <UserPlus className="w-[20px] h-[20px] text-[#C9FF3B]" />
                </div>
                <div
                  data-pencil-name="Textos cabeçalho usuário"
                  className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                >
                  <h3
                    data-pencil-name="Título modal refinado"
                    className="text-[21px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap leading-tight"
                  >
                    {editingUsuario ? "Editar usuário" : "Novo usuário"}
                  </h3>
                  <p
                    data-pencil-name="Subtítulo modal refinado"
                    className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap"
                  >
                    {editingUsuario
                      ? "Atualize as informações do colaborador da sua arena"
                      : "Adicione alguém à equipe da sua arena"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalUsuarioOpen(false)}
                data-pencil-name="Fechar modal refinado"
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row justify-center items-center bg-[#F2EEE7] hover:bg-[#e8e2d8] transition-colors rounded-[10px] cursor-pointer"
                title="Fechar"
              >
                <X className="w-[17px] h-[17px] text-[#5F655F]" />
              </button>
            </div>

            {/* Formulário refinado usuário */}
            <form onSubmit={handleSaveUsuario} className="box-border w-full flex flex-col gap-[15px] justify-start items-start">
              {/* Campo Nome completo */}
              <div
                data-pencil-name="Campo refinado Nome completo *"
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
              >
                <label
                  data-pencil-name="Label refinado Nome completo *"
                  className="text-[11px]/[normal] box-border text-[#30362F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Nome completo *
                </label>
                <div
                  data-pencil-name="Input refinado Nome completo *"
                  className="box-border w-full h-[46px] shrink-0 flex flex-row gap-[10px] px-[13px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[11px] focus-within:outline-[#071915]"
                >
                  <User className="box-border w-[16px] shrink-0 h-[16px] text-[#8A9088]" />
                  <input
                    type="text"
                    required
                    value={formUsuarioNome}
                    onChange={(e) => setFormUsuarioNome(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    className="box-border flex-1 bg-transparent text-[12px] md:text-[13px] text-[#071915] font-medium outline-none placeholder:text-[#A0A39E]"
                  />
                </div>
              </div>

              {/* Campo E-mail */}
              <div
                data-pencil-name="Campo refinado E-mail *"
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
              >
                <label
                  data-pencil-name="Label refinado E-mail *"
                  className="text-[11px]/[normal] box-border text-[#30362F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  E-mail *
                </label>
                <div
                  data-pencil-name="Input refinado E-mail *"
                  className="box-border w-full h-[46px] shrink-0 flex flex-row gap-[10px] px-[13px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[11px] focus-within:outline-[#071915]"
                >
                  <Mail className="box-border w-[16px] shrink-0 h-[16px] text-[#8A9088]" />
                  <input
                    type="email"
                    required
                    value={formUsuarioEmail}
                    onChange={(e) => setFormUsuarioEmail(e.target.value)}
                    placeholder="nome@arena.com.br"
                    className="box-border flex-1 bg-transparent text-[12px] md:text-[13px] text-[#071915] font-medium outline-none placeholder:text-[#A0A39E]"
                  />
                </div>
              </div>

              {/* Campo Perfil de acesso */}
              <div
                data-pencil-name="Campo refinado Perfil de acesso *"
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
              >
                <label
                  data-pencil-name="Label refinado Perfil de acesso *"
                  className="text-[11px]/[normal] box-border text-[#30362F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                >
                  Perfil de acesso *
                </label>
                <div
                  data-pencil-name="Input refinado Perfil de acesso *"
                  className="relative box-border w-full h-[46px] shrink-0 flex flex-row gap-[10px] px-[13px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[11px] focus-within:outline-[#071915]"
                >
                  <ShieldCheck className="box-border w-[16px] shrink-0 h-[16px] text-[#8A9088]" />
                  <select
                    required
                    value={formUsuarioPerfil}
                    onChange={(e) => setFormUsuarioPerfil(e.target.value)}
                    style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                    className="box-border flex-1 bg-transparent text-[12px] md:text-[13px] text-[#30362F] font-medium outline-none cursor-pointer appearance-none pr-8"
                  >
                    <option value="">Selecione um perfil</option>
                    <option value="Recepcionista">Recepcionista</option>
                    {currentUser?.perfil === "Administrador" && <option value="Gerente">Gerente</option>}
                  </select>
                  <ChevronDown className="box-border w-[16px] shrink-0 h-[16px] text-[#6F766F] absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Aviso convite refinado */}
              <div
                data-pencil-name="Aviso convite refinado"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[11px] p-[13px] justify-start items-start bg-[#F1F6E8] outline outline-1 outline-[#DDE8C8] -outline-offset-1 rounded-[12px] mt-1"
              >
                <div
                  data-pencil-name="Ícone aviso convite"
                  className="box-border w-[30px] shrink-0 h-[30px] flex flex-row justify-center items-center bg-[#C9FF3B] rounded-[9px]"
                >
                  <MailCheck className="box-border w-[15px] shrink-0 h-[15px] text-[#071915]" />
                </div>
                <div
                  data-pencil-name="Texto aviso convite"
                  className="box-border [flex:1_1_0] h-fit flex flex-col gap-[3px] justify-start items-start"
                >
                  <div
                    data-pencil-name="Título aviso convite"
                    className="text-[11px]/[normal] box-border text-[#26351F] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                  >
                    {editingUsuario ? "Permissões de acesso" : "Convite automático"}
                  </div>
                  <div
                    data-pencil-name="Descrição aviso convite"
                    className="text-[10px]/[14px] box-border w-full text-[#65705D] font-[Inter,system-ui,sans-serif] font-medium text-left"
                  >
                    {editingUsuario
                      ? "As permissões e acessos do usuário às funcionalidades serão atualizadas imediatamente."
                      : "O colaborador receberá um e-mail seguro para definir a senha e acessar o sistema."}
                  </div>
                </div>
              </div>

              {/* Rodapé refinado usuário */}
              <div
                data-pencil-name="Rodapé refinado usuário"
                className="box-border w-full [flex:1_1_0] flex flex-row justify-between items-center gap-[10px] pt-2"
              >
                {editingUsuario ? (
                  <button
                    type="button"
                    onClick={handleDeleteUsuario}
                    className="box-border h-[42px] px-[16px] flex flex-row items-center justify-center bg-[#FFF3F3] outline outline-1 outline-[#F7CACA] -outline-offset-1 rounded-[10px] text-[12px] text-[#B01F24] font-bold hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    Excluir
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex flex-row gap-[10px] items-center">
                  <button
                    type="button"
                    onClick={() => setModalUsuarioOpen(false)}
                    data-pencil-name="Cancelar refinado"
                    className="box-border w-fit shrink-0 h-[42px] flex flex-row p-[0px_17px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#D5CCC0] -outline-offset-1 rounded-[10px] hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <div
                      data-pencil-name="Texto cancelar refinado"
                      className="text-[12px]/[normal] box-border text-[#51564F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      Cancelar
                    </div>
                  </button>
                  <button
                    type="submit"
                    data-pencil-name="Criar usuário refinado"
                    className="box-border w-fit shrink-0 h-[42px] shadow-[0px_6px_14px_#07191533] flex flex-row gap-[8px] p-[0px_18px] justify-start items-center bg-[#071915] rounded-[10px] hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-[15px] h-[15px] text-[#C9FF3B]" />
                    <div
                      data-pencil-name="Texto criar refinado"
                      className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap"
                    >
                      {editingUsuario ? "Salvar alterações" : "Criar usuário"}
                    </div>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferir Administração */}
      {modalTransferirOpen && (
        <div
          data-pencil-name="Overlay Transferir Administração"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07191566] backdrop-blur-[2.5px] p-4 font-[Inter,system-ui,sans-serif]"
        >
          <div
            data-pencil-name="Modal Transferir Administração"
            className="box-border w-full max-w-[500px] max-h-[90vh] bg-[#FCFAF6] outline outline-1 outline-[#E3DBCF] -outline-offset-1 rounded-[22px] shadow-[0px_22px_52px_#0000003D] overflow-y-auto flex flex-col gap-[20px] p-[28px]"
          >
            <div className="box-border w-full shrink-0 flex flex-row justify-between items-start">
              <div className="box-border w-fit shrink-0 h-fit flex flex-row gap-[12px] justify-start items-center">
                <div className="box-border w-[44px] shrink-0 h-[44px] flex flex-row justify-center items-center bg-[#071915] rounded-[13px]">
                  <ArrowRightLeft className="w-[20px] h-[20px] text-[#C9FF3B]" />
                </div>
                <div className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start">
                  <h3 className="text-[20px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-extrabold text-left whitespace-nowrap leading-tight">
                    Transferir administração
                  </h3>
                  <p className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-medium text-left whitespace-nowrap">
                    Transfira o controle principal da arena para outro membro
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={transferindo}
                  onClick={() => { setTransferPassword(""); setTransferError(""); setModalTransferirOpen(false); }}
                className="box-border w-[34px] shrink-0 h-[34px] flex flex-row justify-center items-center bg-[#F2EEE7] hover:bg-[#e8e2d8] transition-colors rounded-[10px] cursor-pointer"
                title="Fechar"
              >
                <X className="w-[17px] h-[17px] text-[#5F655F]" />
              </button>
            </div>

            <form onSubmit={handleTransferirAdmin} className="box-border w-full flex flex-col gap-[16px]">
              <label className="flex flex-col gap-2 text-sm text-[#30362F]">
                Sua senha atual
                <input type="password" autoComplete="current-password" required
                  value={transferPassword} disabled={transferindo}
                  onChange={e => setTransferPassword(e.target.value)}
                  className="h-[46px] rounded-[11px] border border-[#DED6CA] bg-white px-3" />
              </label>
              {transferError && <p role="alert" className="text-sm text-red-700">{transferError}</p>}
              <p className="text-xs text-[#6F766F]">Ao confirmar, você passará a Gerente e as duas contas precisarão entrar novamente.</p>
              <div className="box-border w-full flex flex-col gap-[7px]">
                <label className="text-[11px]/[normal] box-border text-[#30362F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap">
                  Novo Administrador *
                </label>
                <div className="relative box-border w-full h-[46px] shrink-0 flex flex-row gap-[10px] px-[13px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[11px] focus-within:outline-[#071915]">
                  <ShieldCheck className="box-border w-[16px] shrink-0 h-[16px] text-[#8A9088]" />
                  <select
                    required
                    aria-label="Novo Administrador"
                    disabled={transferindo}
                    value={novoAdminId}
                    onChange={(e) => setNovoAdminId(e.target.value ? Number(e.target.value) : "")}
                    style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                    className="box-border flex-1 bg-transparent text-[12px] md:text-[13px] text-[#30362F] font-medium outline-none cursor-pointer appearance-none pr-8"
                  >
                    <option value="">Selecione um colaborador</option>
                    {usuarios
                      .filter((u) => u.ativo === 1 && canManageUser(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({u.email}) - {u.perfil}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="box-border w-[16px] shrink-0 h-[16px] text-[#6F766F] absolute right-3 pointer-events-none" />
                </div>
              </div>

              <div className="box-border w-full flex flex-row gap-[11px] p-[13px] items-start bg-[#FFF9E8] outline outline-1 outline-[#F5E2B8] -outline-offset-1 rounded-[12px]">
                <div className="box-border w-[30px] shrink-0 h-[30px] flex items-center justify-center bg-[#FFDF7D] rounded-[9px] shrink-0">
                  <ArrowRightLeft className="w-[15px] h-[15px] text-[#7A5400]" />
                </div>
                <div className="flex-1 flex flex-col gap-[3px]">
                  <div className="text-[11px]/[normal] text-[#614200] font-extrabold whitespace-nowrap">
                    Ação irreversível de forma direta
                  </div>
                  <div className="text-[10px]/[14px] text-[#805B0F] font-medium">
                    Esta ação é imediata. Seu perfil passará a ser <strong>Gerente</strong> e apenas o novo Administrador poderá gerenciar planos, faturamento e usuários principais.
                  </div>
                </div>
              </div>

              <div className="box-border w-full flex flex-row justify-end items-center gap-[10px] pt-2">
                <button
                  type="button"
                  disabled={transferindo}
                  onClick={() => { setTransferPassword(""); setTransferError(""); setModalTransferirOpen(false); }}
                  className="box-border w-fit shrink-0 h-[42px] flex flex-row p-[0px_17px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#D5CCC0] -outline-offset-1 rounded-[10px] hover:bg-neutral-50 transition-colors cursor-pointer text-[12px] text-[#51564F] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferindo || !novoAdminId || !transferPassword}
                  className="box-border w-fit shrink-0 h-[42px] shadow-[0px_6px_14px_#07191533] flex flex-row gap-[8px] p-[0px_18px] justify-start items-center bg-[#071915] rounded-[10px] hover:bg-neutral-800 transition-colors cursor-pointer text-[12px] text-[#FFFFFF] font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRightLeft className="w-[15px] h-[15px] text-[#C9FF3B]" />
                  <span>{transferindo ? "Transferindo..." : "Confirmar transferência"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07191599] backdrop-blur-sm p-4 font-[Inter,system-ui,sans-serif]">
          <div className="w-full max-w-[468px] max-h-[90vh] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] rounded-[24px] shadow-2xl overflow-y-auto flex flex-col gap-[16px] p-[28px]">

            {/* Header */}
            <div className="flex flex-row justify-between items-start">
              <div className="flex flex-col gap-[6px]">
                <h3 className="text-[24px] font-bold text-[#071915] leading-tight whitespace-nowrap">
                  {editingQuadra ? "Editar quadra" : "Nova quadra"}
                </h3>
                <p className="text-[12px] text-[#6F766F] font-normal">
                  Atualize dados, modalidades, preços e horário de funcionamento.
                </p>
              </div>
              <button
                type="button"
                disabled={salvandoQuadra} onClick={() => setModalOpen(false)}
                className="w-[34px] h-[34px] shrink-0 rounded-full bg-[#F7F2EA] flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                <X size={16} color="#6F766F" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveQuadraForm} className="flex flex-col gap-[13px] w-full">

              {/* Nome da quadra */}
              <div className="flex flex-col gap-[7px]">
                <label className="text-[12px] font-bold text-[#071915]">Nome da quadra *</label>
                <div className="w-full h-[40px] flex flex-row gap-[9px] px-[12px] items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] rounded-[10px]">
                  <svg viewBox="0 0 14 14" className="w-[15px] h-[15px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.81885 0.60156q-0.25293 0.01367-0.44776 0.09912-0.14014 0.05469-2.44384 1.18946-2.30371 1.13477-2.38575 1.18945-0.23926 0.14014-0.33838 0.40674-0.0957 0.2666-0.01367 0.54687 0.07178 0.22217 0.23242 0.38282 0.16064 0.16064 0.39649 0.23242 0.08545 0.01367 5.18164 0.01367 5.09619 0 5.18164-0.01367 0.2085-0.05811 0.37598-0.21192 0.30762-0.27686 0.28027-0.7041-0.02734-0.42725-0.3623-0.65283-0.11279-0.06836-2.04395-1.02197l-2.36865-1.14844q-0.43408-0.2085-0.52979-0.23584-0.35205-0.11279-0.71435-0.07178z m0.3623 1.17578q0.08545 0.02734 1.79444 0.86817l1.71923 0.84082-1.8457 0.01367q-1.84912 0-3.69824 0l-1.8457-0.01367 1.70556-0.84082q1.72266-0.84082 1.80811-0.86817 0.18115-0.05469 0.3623 0z m-3.78027 4.07422q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m2.32422 0q-0.12646 0.01367-0.2461 0.10596-0.11621 0.08887-0.17431 0.21533l-0.04102 0.09912 0 4.38184 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-2.10205q0.01367-2.09863 0-2.21142-0.05469-0.23584-0.24609-0.36914-0.18799-0.1333-0.44092-0.09229z m2.35156 0q-0.18115 0.01367-0.31445 0.14698-0.1333 0.1333-0.17432 0.31445-0.01367 0.11279 0 2.21142l0 2.10205 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-4.34082-0.04102-0.0957q-0.08545-0.19824-0.25293-0.30079-0.16748-0.10596-0.37939-0.06494z m2.32422 0q-0.0957 0.01367-0.17432 0.05127-0.07519 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.36914l0 4.10156 0.04102 0.08545q0.04443 0.06836 0.12646 0.15381 0.08545 0.08203 0.16065 0.12646 0.07861 0.04102 0.24609 0.04102 0.16748 0 0.24268-0.04102 0.07861-0.04443 0.16064-0.12646 0.08545-0.08545 0.12988-0.15381l0.04102-0.08545 0-3.90674q0-0.38965-0.02735-0.51611-0.01367-0.08545-0.0581-0.15381l-0.02734-0.02734q-0.09912-0.12646-0.2461-0.18116-0.14697-0.05811-0.31445-0.03076z m-8.79102 6.41211q-0.12646 0.02734-0.23925 0.1333-0.10938 0.10596-0.16749 0.23243-0.06836 0.2085 0.01368 0.42724 0.08545 0.21533 0.29394 0.31445l0.1128 0.04102 10.75292 0 0.1128-0.04102q0.2085-0.11279 0.29053-0.32129 0.08545-0.21191 0.00683-0.4204-0.0752-0.21192-0.28369-0.32471l-0.09912-0.04102-5.36279-0.01367q-5.3457 0-5.43116 0.01367z" fill="#6F766F" />
                  </svg>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Quadra 1, areia..."
                    className="flex-1 bg-transparent text-[13px] text-[#071915] outline-none placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              {/* Tipo de piso */}
              <div className="flex flex-col gap-[7px]">
                <label className="text-[12px] font-bold text-[#071915]">Tipo principal de piso *</label>
                <div className="w-full h-[40px] flex flex-row gap-[9px] px-[12px] items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] rounded-[10px]">
                  <select
                    value={formTipoPiso}
                    onChange={(e) => setFormTipoPiso(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-[#071915] outline-none cursor-pointer"
                  >
                    {["Areia", "Saibro", "Cimento", "Grama", "Sintético", "Madeira"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modalidades */}
              <div className="flex flex-col gap-[9px]">
                <label className="text-[12px] font-bold text-[#071915]">Modalidades suportadas</label>

                {/* Chips selecionados */}
                {formModalidades.length > 0 && (
                  <div className="flex flex-row flex-wrap gap-[7px]">
                    {formModalidades.map((mod) => (
                      <div
                        key={mod}
                        className="w-fit h-[28px] flex flex-row gap-[6px] px-[10px] items-center bg-[#EEF3FF] outline outline-1 outline-[#BBD8FF] rounded-[14px]"
                      >
                        <svg viewBox="0 0 14 14" className="w-[13px] h-[13px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.48096 2.95313q-0.07178 0.01367-0.12989 0.0581-0.05469 0.04102-3.07617 3.06592l-3.0249 3.00781-1.28857-1.28857q-1.28857-1.28516-1.38086-1.32618-0.08887-0.04443-0.22217-0.04443-0.1333 0-0.23242 0.0376-0.0957 0.03418-0.18799 0.11279-0.08887 0.0752-0.1333 0.1709-0.02734 0.07178-0.03418 0.11279-0.00684 0.04102-0.00684 0.14014l0 0.04102q-0.01367 0.11279 0.04102 0.19824 0.07178 0.10938 0.36572 0.40332 0.19482 0.21191 0.96729 0.98096l1.49707 1.48339q0.28027 0.2666 0.38964 0.33838 0.07178 0.05469 0.18457 0.04102l0.09571 0.01367q0.07178 0 0.14013-0.02734 0.08545-0.07178 0.32129-0.28711 0.23926-0.21875 0.79981-0.76221l2.2832-2.2832q2.08496-2.09863 2.7002-2.71387 0.61524-0.61865 0.64599-0.68701 0.04102-0.08545 0.04102-0.23926 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.18115-0.11963-0.08887-0.0376-0.20849-0.0376-0.11963 0-0.18799 0.02734z" fill="#2563EB" />
                        </svg>
                        <span className="text-[12px] font-bold text-[#2563EB]">{mod}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveModalidade(mod)}
                          className="text-[#2563EB] hover:text-red-500 text-[14px] leading-none ml-0.5 cursor-pointer"
                          title="Remover"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar nova modalidade */}
                <div className="flex flex-row gap-[8px]">
                  <div className="flex-1 h-[38px] flex flex-row px-[12px] items-center bg-[#FBFAF7] outline outline-1 outline-[#DED6CA] rounded-[10px]">
                    <input
                      type="text"
                      value={formNovaModalidade}
                      onChange={(e) => setFormNovaModalidade(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddModalidade(); } }}
                      placeholder="Nova modalidade..."
                      className="flex-1 bg-transparent text-[13px] text-[#071915] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModalidade}
                    className="h-[38px] flex flex-row gap-[6px] px-[12px] items-center bg-[#EEF3FF] outline outline-1 outline-[#BBD8FF] rounded-[10px] cursor-pointer hover:bg-[#dce8ff] transition-colors"
                  >
                    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.90088 2.35156q-0.0957 0.01367-0.17432 0.05127-0.0752 0.03418-0.15381 0.12647-0.0752 0.08887-0.11279 0.16748-0.03418 0.0752-0.03418 0.32812l0 3.40088-3.66748 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.33838 0.03418l3.40088 0 0 3.40088q0 0.25293 0.03418 0.33838 0.0376 0.08203 0.11963 0.16748 0.08545 0.08203 0.18799 0.1333 0.10596 0.04785 0.23242 0.04785 0.12646 0 0.229-0.04785 0.10596-0.05127 0.18799-0.1333 0.08545-0.08545 0.11963-0.16748 0.0376-0.08545 0.0376-0.33838l0-3.40088 3.40088 0q0.25293 0 0.33496-0.03418 0.08545-0.0376 0.16748-0.11963 0.08545-0.08545 0.1333-0.18799 0.05127-0.10596 0.05127-0.23242 0-0.12646-0.04102-0.23926-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-3.66748 0 0-3.38721q0-0.2666-0.02734-0.32128-0.07178-0.19824-0.25293-0.30079-0.18115-0.10596-0.39307-0.06494z" fill="#2563EB" />
                    </svg>
                    <span className="text-[12px] font-bold text-[#2563EB]">Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Preço por hora por modalidade */}
              {formModalidades.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  <label className="text-[12px] font-bold text-[#071915]">Preço por hora</label>
                  {formModalidades.map((mod) => (
                    <div
                      key={mod}
                      className="w-full h-[48px] flex flex-row px-[12px] justify-between items-center bg-[#FBFAF7] outline outline-1 outline-[#E6DED2] rounded-[12px]"
                    >
                      <div className="flex flex-row gap-[8px] items-center">
                        <div className="w-[6px] h-[6px] bg-[#2563EB] rounded-full shrink-0" />
                        <span className="text-[13px] font-bold text-[#071915]">{mod}</span>
                      </div>
                      <div className="flex flex-row gap-[7px] items-center">
                        <span className="text-[12px] font-bold text-[#6F766F]">R$</span>
                        <div className="w-[96px] h-[34px] flex flex-row px-[10px] justify-end items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] rounded-[9px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Preço por hora de ${mod}`}
                            aria-invalid={!Number.isFinite(parseCourtPrice(formModalidadePrecos[mod] ?? ""))}
                            value={formModalidadePrecos[mod] ?? ""}
                            onChange={(e) =>
                              setFormModalidadePrecos((prev) => ({ ...prev, [mod]: formatCourtPriceInput(e.target.value) }))
                            }
                            onPaste={(event) => {
                              event.preventDefault();
                              const text = event.clipboardData.getData('text').trim();
                              const price = parseCourtPrice(text);
                              setFormModalidadePrecos(prev => ({ ...prev, [mod]: Number.isFinite(price) ? price.toFixed(2).replace('.', ',') : text }));
                            }}
                            className="w-full text-right bg-transparent text-[13px] font-bold text-[#071915] outline-none"
                          />
                        </div>
                        <span className="text-[12px] text-[#6F766F]">/h</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-[#6F766F]">Digite os números; a vírgula é automática. Ex.: 12550 vira 125,50. O valor deve ser maior que zero.</p>
                </div>
              )}

              {/* Horários */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-[16px]">
                  <CourtTimeSelect id="quadra-abertura" label="Horário de abertura" value={formHoraAbertura} onChange={setFormHoraAbertura} />
                  <CourtTimeSelect id="quadra-fechamento" label="Horário de fechamento" value={formHoraFechamento} onChange={setFormHoraFechamento} />
                </div>
                <p className="text-[11px] text-[#6F766F]">Selecione a hora. Formato de 24 horas.</p>
                {horarioQuadraInvalido && <p role="alert" className="text-[12px] text-[#B01F24]">O fechamento deve ser depois da abertura.</p>}
              </div>

              {/* Footer */}
              <div className="flex flex-row justify-between items-center pt-[4px]">
                {/* Excluir */}
                {editingQuadra ? (
                  <button
                    type="button"
                    disabled={salvandoQuadra} onClick={handleDeleteQuadra}
                    className="h-[40px] px-[14px] flex items-center justify-center bg-[#FFF3F3] outline outline-1 outline-[#F7CACA] rounded-[10px] text-[13px] text-[#B01F24] hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    Excluir
                  </button>
                ) : (
                  <div />
                )}

                {/* Cancelar + Salvar */}
                <div className="flex flex-row gap-[10px]">
                  <button
                    type="button"
                    disabled={salvandoQuadra} onClick={() => setModalOpen(false)}
                    className="h-[40px] px-[14px] flex items-center justify-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] rounded-[10px] text-[13px] text-[#071915] hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit" disabled={salvandoQuadra}
                    className="h-[40px] px-[16px] flex flex-row items-center gap-[8px] bg-[#071915] rounded-[10px] text-[13px] font-bold text-[#FFFFFF] hover:bg-neutral-800 transition-colors cursor-pointer shadow-sm"
                  >
                    <svg viewBox="0 0 14 14" className="w-[15px] h-[15px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.60449 1.20313q-0.50586 0.08545-0.87842 0.43749-0.36914 0.34863-0.50927 0.86475-0.02734 0.08545-0.02735 0.71436l-0.01367 3.78027 0.01367 3.78027q0 0.62891 0.02735 0.71436 0.14014 0.48877 0.46826 0.82031 0.33154 0.32813 0.82031 0.46826 0.08545 0.02734 0.71436 0.02735l3.78027 0.01367 3.78027-0.01367q0.62891 0 0.71436-0.02735 0.48877-0.14014 0.81689-0.46826 0.33154-0.33154 0.47168-0.82031 0.02734-0.08545 0.02735-0.56055l0.01367-6.09082-0.05469-0.16748q-0.09912-0.32129-0.29394-0.57422-0.09912-0.14014-1.31592-1.34326l-0.92627-0.92285q-0.28027-0.28027-0.42041-0.3794-0.0957-0.06836-0.2666-0.14013-0.12305-0.05469-0.26319-0.09912l-0.14013-0.04102-3.20606 0q-3.21973 0-3.33252 0.02734z m0.89551 2.05761q0 0.93994 0.01367 1.03565 0.07178 0.35205 0.33496 0.61181 0.2666 0.25635 0.61866 0.32813 0.10938 0.01367 2.26611 0.01367l2.17041-0.01367 0.09912-0.04102q0.2666-0.12646 0.32129-0.42041 0.05469-0.29395-0.15381-0.50586-0.14014-0.14014-0.33496-0.16748-0.11279-0.02734-2.14307-0.02734l-2.0166 0 0-1.75 2.07129 0q2.07129 0 2.18408 0.01367l0.01367 0.01367q0.09912 0.01367 0.18457 0.05811 0.0957 0.06836 0.34864 0.32129l1.80468 1.79101q0.23926 0.25293 0.30762 0.36573 0.04443 0.06836 0.05811 0.18115l0.01367 0.01367q0.01367 0.11279 0 3.12061l0 3.01122-0.04102 0.09913q-0.09912 0.19482-0.2666 0.29394-0.08545 0.04102-0.20508 0.05469-0.11621 0.01367-0.35546 0.01367l-0.29395 0 0-1.80469q0-1.80811-0.01367-1.91748-0.05469-0.31104-0.28711-0.56054-0.23242-0.25293-0.55371-0.35205-0.06836-0.02734-0.44776-0.02735l-4.22802 0q-0.44775 0-0.58789 0.02735-0.11279 0.01367-0.2085 0.07177l-0.05811 0.02735q-0.12646 0.05469-0.28027 0.20849-0.15381 0.15381-0.2085 0.28028l-0.02734 0.0581q-0.04443 0.0957-0.0581 0.18115-0.02734 0.12646-0.02735 0.46143l-0.01367 3.34619-0.29395 0q-0.23926 0-0.35888-0.01367-0.11621-0.01367-0.20166-0.05469-0.16748-0.09912-0.2666-0.29394l-0.04102-0.09913 0-8.42871 0.04102-0.09912q0.07178-0.14014 0.18798-0.229 0.11963-0.09229 0.25977-0.11963 0.08545 0 0.37939-0.01367l0.29395 0 0 0.93652z m5.82422 6.66504l0 1.75-4.64844 0 0-3.5 4.64844 0 0 1.75z" fill="#C9FF3B" />
                    </svg>
                    Salvar alterações
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Motivo de Cancelamento */}
      {modalMotivoOpen && (
        <div
          data-pencil-name="Overlay Motivo Cancelamento"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07191566] backdrop-blur-[2.5px] p-4 font-[Inter,system-ui,sans-serif]"
        >
          <div
            data-pencil-name="Modal Motivo Cancelamento"
            className="box-border w-full max-w-[460px] bg-[#FCFAF6] outline outline-1 outline-[#E3DBCF] -outline-offset-1 rounded-[22px] shadow-[0px_22px_52px_#0000003D] flex flex-col gap-[20px] p-[28px]"
          >
            {/* Header modal */}
            <div className="flex flex-row justify-between items-start">
              <div className="flex flex-row gap-[12px] items-center">
                <div className="w-[44px] h-[44px] flex items-center justify-center bg-[#071915] rounded-[13px]">
                  <CalendarX className="w-[20px] h-[20px] text-[#C9FF3B]" />
                </div>
                <div>
                  <h3 className="text-[20px] font-extrabold text-[#071915] leading-tight">
                    {editingMotivo ? "Editar motivo" : "Novo motivo"}
                  </h3>
                  <p className="text-[12px] text-[#6F766F] font-medium">
                    {editingMotivo ? "Atualize a descrição da opção" : "Cadastre uma nova opção de cancelamento"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMotivoOpen(false)}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-full hover:bg-[#EAE4DA] text-[#6F766F] hover:text-[#071915] transition-colors cursor-pointer"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSalvarMotivo} className="flex flex-col gap-[16px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold text-[#071915]">
                  Nome do motivo *
                </label>
                <div className="w-full h-[40px] px-[12px] flex items-center bg-[#FFFFFF] outline outline-1 outline-[#D8E3CF] -outline-offset-1 rounded-[10px] focus-within:outline-[#071915]">
                  <input
                    type="text"
                    required
                    value={formMotivoNome}
                    onChange={(e) => setFormMotivoNome(e.target.value)}
                    placeholder="Ex: Problema com transporte"
                    className="w-full bg-transparent text-[12px] text-[#071915] font-semibold outline-none placeholder:text-[#9A9E98]"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex flex-row gap-[10px] justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalMotivoOpen(false)}
                  className="h-[40px] px-[16px] rounded-[10px] text-[12px] font-bold text-[#071915] bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 hover:bg-[#FAF8F4] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoMotivo}
                  className="h-[40px] px-[18px] flex items-center gap-[8px] rounded-[10px] text-[12px] font-extrabold text-[#FFFFFF] bg-[#071915] hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Save className="w-[14px] h-[14px] text-[#C9FF3B]" />
                  <span>{salvandoMotivo ? "Salvando..." : (editingMotivo ? "Salvar alterações" : "Adicionar motivo")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
