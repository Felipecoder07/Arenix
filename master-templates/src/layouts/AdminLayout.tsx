import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminTopbar } from '../components/AdminTopbar';
import { AdminSidebar } from '../components/AdminSidebar';

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-cream overflow-hidden font-sans">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
