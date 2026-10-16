import { useArenaPortal } from '../hooks/useArenaPortal';
import type { Announcement } from '../types/api';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { Menu, Bell, X, Globe, Copy, ExternalLink, Share2, Check } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ADMIN_NAV_ITEMS as NAV_ITEMS } from './navigation';
import { getStoredUser } from '../utils/session';

interface AdminTopbarProps {
  onToggleSidebar: () => void;
  customTitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function AdminTopbar({ onToggleSidebar, customTitle, actions }: Readonly<AdminTopbarProps>) {
  const location = useLocation();
  const item = NAV_ITEMS.find((n) => n.path === location.pathname);

  const { arenaName, clientPortalUrl } = useArenaPortal();
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPortalMenu, setShowPortalMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const user = getStoredUser();
  const userName = user?.nome || 'fefe';

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/auth/comunicados/ativos', { headers: {} });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Erro ao buscar notificações na Topbar:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const isReservasPage = location.pathname.startsWith('/admin/reservas');

  return (
    <header
      className={`box-border w-full ${
        isReservasPage ? 'min-h-[42px] pb-1' : 'min-h-[70px] pb-2'
      } shrink-0 flex flex-row justify-between items-center select-none`}
    >
      {/* Título & Breadcrumb Padronizado (Oculto na tela de Reservas, que já possui cabeçalho próprio) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-xl text-[#071915] hover:bg-[#F1EDE6] transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        {!isReservasPage && (
          customTitle ? customTitle : (
            <div className="box-border flex flex-col gap-[4px] justify-start items-start">
              <div className="text-[12px] leading-none text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
                Painel gestor / Visão geral
              </div>
              <h1 className="text-[28px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap m-0">
                {item?.label || 'Dashboard'}
              </h1>
            </div>
          )
        )}
      </div>

      {/* Ações Topbar */}
      <div className="box-border flex flex-row gap-[10px] items-center">
        {actions}
        {/* Portal do Cliente Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPortalMenu(!showPortalMenu)}
            className="box-border h-[34px] flex flex-row gap-[7px] px-[12px] items-center bg-[#ECFFF4] hover:bg-[#DCFCE7] transition-colors rounded-[17px] border-none cursor-pointer shadow-sm active:scale-95"
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

        {/* Arena Name (acessibilidade / sem duplicação visual com pill do usuário) */}
        <span className="sr-only">{arenaName}</span>

        {/* Usuário Logado Pill */}
        <div className="box-border h-[34px] flex flex-row gap-[7px] px-[11px] items-center bg-[#F1EDE6] rounded-[17px] shadow-sm">
          <div className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full" />
          <span className="text-[12px] text-[#071915] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap">
            {userName}
          </span>
        </div>

        {/* Notificações Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] relative flex items-center justify-center cursor-pointer hover:bg-[#F9F7F3] transition-colors shadow-sm border-none"
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell size={16} className="text-[#071915]" />
            {notifications.length > 0 && (
              <div className="box-border w-[7px] h-[7px] absolute right-[6px] top-[6px] bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] -outline-offset-1 rounded-full animate-pulse" />
            )}
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                role="presentation"
                onClick={() => setShowDropdown(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') setShowDropdown(false);
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
    </header>
  );
}
