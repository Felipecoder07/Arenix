import { MASTER_NAV_ITEMS as NAV_ITEMS } from './navigation';
import { logout } from '../utils/apiFetch';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, LayoutGrid } from 'lucide-react';
import { type SidebarProps } from './SidebarShell';
import { clearSession, getStoredUser } from '../utils/session';





export function Sidebar({ collapsed, onToggle }: Readonly<SidebarProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const name = user?.nome || 'Administrador Master';
  const email = typeof user?.email === 'string' ? user.email : 'Painel Master';

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await logout();
    } catch {
      window.alert('Não foi possível encerrar a sessão. Tente novamente.');
      return;
    }
    clearSession();
    navigate('/master-login');
  };

  return (
    <aside className={`master-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="master-brand-row">
        <Link to="/master/dashboard" className="master-brand" aria-label="Courtly — Dashboard Master">
          <span className="master-monogram"><LayoutGrid size={18} /></span>
          {!collapsed && <span><strong>courtly</strong><small>PAINEL MASTER</small></span>}
        </Link>
        <button className="master-collapse" onClick={onToggle} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
      </div>
      <nav aria-label="Navegação Master">
        {NAV_ITEMS.filter(item => item.id !== 'arena-detalhe').map(item => {
          const active = location.pathname === item.path || (item.id === 'arenas' && location.pathname === '/master/arena-detalhe');
          const Icon = item.icon;
          return <Link key={item.id} to={item.path} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={active ? 'page' : undefined} onClick={() => { if (window.innerWidth < 768 && !collapsed) onToggle(); }}><Icon size={17} />{!collapsed && <span>{item.label}</span>}</Link>;
        })}
      </nav>
      <div className="master-profile">
        {!collapsed && <><span className="master-avatar">{name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{name}</strong><small>{email}</small></div></>}
        <button onClick={handleLogout} aria-label="Sair" title="Sair"><LogOut size={16} /></button>
      </div>
    </aside>
  );
}
