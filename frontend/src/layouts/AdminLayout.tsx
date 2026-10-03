import type { Announcement } from '../types/api';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminTopbar } from '../components/AdminTopbar';
import { AdminSidebar } from '../components/AdminSidebar';
import { Megaphone, X, Wrench } from 'lucide-react';

export function AdminLayout() {
  const location = useLocation();
  const isReservasPage = location.pathname.startsWith('/admin/reservas');
  const isPagamentosPage = location.pathname.startsWith('/admin/pagamentos');
  const isClientesPage = location.pathname.startsWith('/admin/clientes');
  const isAssinaturaPage = location.pathname.startsWith('/admin/assinatura');
  const isAuditoriaPage = location.pathname.startsWith('/admin/auditoria');
  const isConfiguracoesPage = location.pathname.startsWith('/admin/configuracoes');
  const isRelatoriosPage = location.pathname.startsWith('/admin/relatorios');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState<Announcement[]>([]);
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);

  useEffect(() => {
    // 1. Verifica estado de manutenção global
    fetch('/api/auth/manutencao')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ativa) {
          setMaintenance({ active: true, message: data.mensagem });
        }
      })
      .catch(console.error);

    // 2. Busca comunicados e alertas da arena logada
    fetch('/api/auth/comunicados/ativos', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAlerts(data.filter((a) => a.channel === 'alerta'));
        }
      })
      .catch(console.error);
  }, []);

  const handleDismissAlert = (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (maintenance && maintenance.active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#fdfcf9] to-[#eae7e0] p-6 text-center select-none font-sans">
        <div className="max-w-md w-full p-8 bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-2xl shadow-xl animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF9ED] text-[#FFB545] flex items-center justify-center mx-auto mb-6 border border-[#FFB545]/20">
            <Wrench size={32} />
          </div>
          <h1 className="text-xl font-bold text-[#071915] mb-2">Sistema em Manutenção</h1>
          <p className="text-sm text-[#4F5550] mb-6 leading-relaxed">
            {maintenance.message}
          </p>
          <div className="border-t border-[#E6DED2] pt-5 text-xs text-[#6F766F]">
            Por favor, tente novamente mais tarde. Se precisar de assistência imediata, entre em contato com o suporte.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F7F2EA] flex relative overflow-hidden font-sans">
      {/* Glow Verde Dashboard */}
      <div
        className="pointer-events-none absolute right-[100px] top-0 w-[440px] h-[240px] rounded-full [background-image:radial-gradient(ellipse_50%_50%_at_50%_50%,_#c9ff3b38_0%,_#c9ff3b00_100%)] bg-no-repeat bg-[length:100%_100%] z-0"
        aria-hidden="true"
      />
      {/* Glow Azul Dashboard */}
      <div
        className="pointer-events-none absolute left-[260px] bottom-0 w-[520px] h-[230px] rounded-full [background-image:radial-gradient(ellipse_50%_50%_at_50%_50%,_#43b7ff1f_0%,_#43b7ff00_100%)] bg-no-repeat bg-[length:100%_100%] z-0"
        aria-hidden="true"
      />

      {/* Sidebar Desktop: Floating Pill (Fixa na tela) */}
      <div className="hidden md:flex flex-col shrink-0 my-6 ml-6 h-[calc(100vh-48px)] z-20">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 m-4 flex h-[calc(100vh-32px)]">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Área Principal Dashboard (Com scroll independente) */}
      <div className="flex-1 h-screen overflow-y-auto custom-scrollbar flex flex-col min-w-0 z-10 px-4 md:px-8 py-6">
        <div className="max-w-[1240px] mx-auto w-full flex-1 flex flex-col">
          {!isReservasPage && !isPagamentosPage && !isClientesPage && !isAssinaturaPage && !isAuditoriaPage && !isConfiguracoesPage && !isRelatoriosPage && (
            <AdminTopbar onToggleSidebar={() => setMobileOpen(!mobileOpen)} />
          )}

          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="my-3 bg-[#FFF9ED] outline outline-1 outline-[#FFB545] rounded-[14px] px-4 py-2.5 flex items-center justify-between gap-3 text-[#4F5550] shadow-sm select-none animate-fade-in"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Megaphone size={16} className="shrink-0 text-[#C8661A]" />
                <span>{alert.message}</span>
              </div>
              <button
                onClick={() => handleDismissAlert(alert.id)}
                className="p-1 rounded-md hover:bg-neutral-200/50 text-[#4F5550] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <main className="flex-1 w-full pb-8">
            <Outlet context={{ onToggleSidebar: () => setMobileOpen(!mobileOpen) }} />
          </main>
        </div>
      </div>
    </div>
  );
}
