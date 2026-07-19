import { useState, useEffect } from 'react';
import { Menu, Bell, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './AdminSidebar';

interface AdminTopbarProps {
  onToggleSidebar: () => void;
}

export function AdminTopbar({ onToggleSidebar }: AdminTopbarProps) {
  const location = useLocation();
  const item = NAV_ITEMS.find((n) => n.path === location.pathname);

  const [arenaName, setArenaName] = useState(() => localStorage.getItem('arena_nome') || 'Arena Principal');

  useEffect(() => {
    const handleChanged = () => {
      setArenaName(localStorage.getItem('arena_nome') || 'Arena Principal');
    };
    window.addEventListener('arena_nome_changed', handleChanged);
    return () => window.removeEventListener('arena_nome_changed', handleChanged);
  }, []);

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

      <button className="relative p-2 rounded-lg text-muted hover:text-charcoal hover:bg-cream-surface transition-colors" aria-label="Notificações">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
      </button>
    </header>
  );
}
