import type { MouseEventHandler } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';

export interface NavItem {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

interface SidebarShellProps extends SidebarProps {
  readonly variant: 'admin' | 'master';
  readonly items: readonly NavItem[];
  readonly userName: string;
  readonly initials: string;
  readonly subtitle?: string;
  readonly onLogout: MouseEventHandler<HTMLButtonElement>;
}

export function SidebarShell({
  collapsed,
  onToggle,
  variant,
  items,
  userName,
  initials,
  subtitle,
  onLogout,
}: Readonly<SidebarShellProps>) {
  const location = useLocation();

  if (variant === 'admin') {
    return (
      <aside
        className={`box-border ${
          collapsed ? 'w-[74px] p-[20px_10px]' : 'w-[232px] p-[22px_18px]'
        } shrink-0 h-full [box-shadow:0px_18px_42px_#06110F33] flex flex-col gap-[20px] justify-between items-start bg-[#071915] rounded-[28px] transition-[width,padding] duration-200 ease-out z-20 select-none`}
      >
        {/* Marca / Brand */}
        <div className="w-full flex items-center justify-between">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-[10px] min-w-0 text-decoration-none group"
            title="Courtly Dashboard"
          >
            <div className="w-[34px] shrink-0 h-[34px] bg-[#C9FF3B] rounded-[10px] flex items-center justify-center shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-[#071915] fill-none stroke-current"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3 C12 12, 12 12, 21 12" />
                <path d="M12 21 C12 12, 12 12, 3 12" />
              </svg>
            </div>
            {!collapsed && (
              <span className="text-[20px] leading-tight text-[#F7F2EA] font-[Inter,system-ui,sans-serif] font-bold tracking-tight whitespace-nowrap">
                courtly
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className="hidden md:flex p-1 rounded-md text-[#A7B6AE] hover:text-[#F7F2EA] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Alternar menu"
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navegação */}
        <nav className="w-full flex-1 flex flex-col gap-[4px] justify-start items-start overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`box-border w-full h-[34px] shrink-0 flex items-center gap-[10px] px-[10px] rounded-[10px] text-[12px] transition-colors ${
                  isActive
                    ? 'bg-[#C9FF3B] text-[#071915] font-bold shadow-sm'
                    : 'bg-transparent text-[#A7B6AE] hover:text-[#F7F2EA] hover:bg-white/5 font-normal'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 ${isActive ? 'text-[#071915]' : 'text-[#A7B6AE]'}`}
                />
                {!collapsed && (
                  <span className="truncate leading-none">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Perfil / Footer */}
        <div
          className={`box-border w-full h-fit shrink-0 flex items-center gap-[10px] p-[12px] bg-[#102620] rounded-[18px] ${
            collapsed ? 'justify-center p-2' : ''
          }`}
        >
          <div className="w-[34px] shrink-0 h-[34px] bg-[#C9FF3B] text-[#071915] rounded-full flex items-center justify-center font-bold text-xs select-none">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 flex flex-col gap-[2px] min-w-0">
              <span className="text-[13px] leading-tight text-[#F7F2EA] font-[Inter,system-ui,sans-serif] font-bold truncate">
                {userName}
              </span>
              <span className="text-[11px] leading-tight text-[#93A39B] font-[Inter,system-ui,sans-serif] font-normal truncate">
                {subtitle || 'Arena Central'}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onLogout}
              className="text-[#93A39B] hover:text-[#F7F2EA] p-1 rounded transition-colors cursor-pointer"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // Variant: Master
  return (
    <aside
      className={`${
        collapsed ? 'w-[68px]' : 'w-[248px]'
      } shrink-0 h-screen sticky top-0 bg-charcoal text-off-white flex flex-col transition-[width] duration-200 ease-out z-20`}
    >
      <button
        type="button"
        className="w-full px-4 h-16 flex items-center gap-2.5 border-b border-white/10 cursor-pointer text-left"
        onClick={onToggle}
        aria-label="Alternar menu"
        aria-expanded={!collapsed}
        title="Toggle Menu"
      >
        <span className="w-9 h-9 rounded-lg bg-off-white text-charcoal flex items-center justify-center font-bold text-sm shrink-0">
          CM
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight">
              CourtManager
            </span>
            <span className="text-[11px] text-off-white/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning pulse-dot" />
              Painel Master
            </span>
          </span>
        )}
      </button>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors group ${
                isActive
                  ? 'bg-white/10 text-off-white font-medium'
                  : 'text-off-white/65 hover:text-off-white hover:bg-white/5'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && isActive && (
                <ChevronRight size={14} className="ml-auto opacity-60" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-white/10">
        <div
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-warning text-charcoal flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{userName}</div>
              <button
                type="button"
                onClick={onLogout}
                className="text-[11px] text-off-white/50 flex items-center gap-1 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <LogOut size={11} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
