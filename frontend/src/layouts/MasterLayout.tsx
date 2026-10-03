import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import '../assets/css/master.css';
import '../assets/css/master-reference.css';

export function MasterLayout() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  return (
    <div className={`master-app ${collapsed ? 'master-menu-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="master-workspace">
        <button className="master-mobile-menu" onClick={() => setCollapsed(!collapsed)} aria-label="Alternar menu" aria-expanded={!collapsed}><Menu size={20} /> Painel Master</button>
        <main className="master-main">
          <div className="master-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
