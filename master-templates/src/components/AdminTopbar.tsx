import { useState, useEffect } from 'react';
import { Menu, Bell, ChevronRight, Megaphone, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './AdminSidebar';
import { formatDateTime } from '../data/mock';

interface AdminTopbarProps {
  onToggleSidebar: () => void;
}

export function AdminTopbar({ onToggleSidebar }: AdminTopbarProps) {
  const location = useLocation();
  const item = NAV_ITEMS.find((n) => n.path === location.pathname);

  const [arenaName, setArenaName] = useState(() => localStorage.getItem('arena_nome') || 'Arena Principal');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleChanged = () => {
      setArenaName(localStorage.getItem('arena_nome') || 'Arena Principal');
    };
    window.addEventListener('arena_nome_changed', handleChanged);
    return () => window.removeEventListener('arena_nome_changed', handleChanged);
  }, []);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('courtmanager_token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3000/api/auth/comunicados/ativos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

  const handleDismissNotification = (id: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-cream/85 backdrop-blur-md border-b border-border-passive flex items-center gap-3 px-4 md:px-6">
      <button onClick={onToggleSidebar} className="p-2 -ml-2 rounded-lg text-muted hover:text-charcoal hover:bg-cream-surface transition-colors" aria-label="Recolher menu">
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="text-muted hidden sm:inline">Painel Gestor</span>
        <ChevronRight size={13} className="text-muted/50 hidden sm:inline" />
        <span className="font-medium text-charcoal truncate">{item?.label || 'Dashboard'}</span>
      </div>

      <div className="flex-1" />

      {/* Arena Name Indicator */}
      <div className="topbar-arena">
        <span className="arena-dot" />
        {arenaName}
      </div>

      {/* Central de Notificações com Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`relative p-2 rounded-lg text-muted hover:text-charcoal hover:bg-cream-surface transition-colors ${showDropdown ? 'bg-cream-surface text-charcoal font-medium' : ''}`}
          aria-label="Notificações"
        >
          <Bell size={18} />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
          )}
        </button>

        {showDropdown && (
          <>
            {/* Overlay para fechar ao clicar fora */}
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

            {/* Card Dropdown */}
            <div className="absolute right-0 mt-2 w-80 bg-off-white border border-border-passive rounded-xl shadow-lg p-4 z-50 animate-scale-in">
              <div className="flex items-center justify-between border-b border-border-passive pb-2 mb-3">
                <span className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  Notificações
                  {notifications.length > 0 && (
                    <span className="bg-danger/10 text-danger text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {notifications.length}
                    </span>
                  )}
                </span>
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    className="text-[10px] text-muted hover:text-charcoal transition-colors font-medium"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-cream-surface transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-warning-soft text-warning flex items-center justify-center shrink-0 border border-warning/10">
                        <Megaphone size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-charcoal font-normal leading-relaxed break-words">
                          {n.message}
                        </p>
                        <span className="text-[9px] text-muted block mt-1">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDismissNotification(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-charcoal/5 text-muted hover:text-charcoal transition-all shrink-0"
                        title="Dispensar"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
