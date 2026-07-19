import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { MasterLayout } from './layouts/MasterLayout';
import { MasterDashboard } from './screens/MasterDashboard';
import { MasterArenas } from './screens/MasterArenas';
import { MasterArenaDetalhe } from './screens/MasterArenaDetalhe';
import { MasterFinanceiro } from './screens/MasterFinanceiro';
import { MasterUsuarios } from './screens/MasterUsuarios';
import { MasterComunicacao } from './screens/MasterComunicacao';
import { MasterAuditoria } from './screens/MasterAuditoria';
import { MasterConfiguracoes } from './screens/MasterConfiguracoes';
import { TenantLogin } from './screens/public/TenantLogin';
import { LandingPage } from './screens/public/LandingPage';
import { Checkout } from './screens/public/Checkout';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './screens/admin/AdminDashboard';
import { AdminReservas } from './screens/admin/AdminReservas';
import { AdminClientes } from './screens/admin/AdminClientes';
import { AdminPagamentos } from './screens/admin/AdminPagamentos';
import { AdminRelatorios } from './screens/admin/AdminRelatorios';
import { AdminConfiguracoes } from './screens/admin/AdminConfiguracoes';
import { AdminAuditoria } from './screens/admin/AdminAuditoria';

// Componente Wrapper para proteger as rotas do Admin da Arena
function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('courtmanager_token');
    const userStr = localStorage.getItem('courtmanager_user');
    
    let isValid = false;
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.perfil === 'Administrador' || user.perfil === 'Colaborador') isValid = true;
      } catch (e) {}
    }

    if (!isValid) {
      navigate('/login', { replace: true });
    } else {
      setIsAuth(true);
      setChecking(false);
    }
  }, [navigate]);

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-cream text-charcoal">Verificando...</div>;
  if (!isAuth) return null;
  return <>{children}</>;
}

// Componente Wrapper para proteger as rotas do Master
function MasterGuard({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlUser = params.get('user');

    if (urlToken && urlUser) {
      localStorage.setItem('courtmanager_token', urlToken);
      try {
        const decodedUser = decodeURIComponent(atob(urlUser));
        localStorage.setItem('courtmanager_user', decodedUser);
      } catch(e) {}
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('courtmanager_token');
    const userStr = localStorage.getItem('courtmanager_user');
    
    let isValid = false;
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.perfil === 'SuperAdmin') isValid = true;
      } catch (e) {}
    }

    if (!isValid) {
      // Por enquanto, envia para a porta antiga do login master até migrarmos
      window.location.href = 'http://localhost:3000/master-login.html';
    } else {
      setIsAuth(true);
      setChecking(false);
    }
  }, [navigate]);

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-cream text-charcoal">Verificando...</div>;
  if (!isAuth) return null;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Rotas Públicas Mockadas (Fase 2) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<TenantLogin />} />
      <Route path="/cadastro" element={<Checkout />} />

      {/* Rotas Inquilino (Fase 3/4) */}
      <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="reservas" element={<AdminReservas />} />
        <Route path="clientes" element={<AdminClientes />} />
        <Route path="pagamentos" element={<AdminPagamentos />} />
        <Route path="relatorios" element={<AdminRelatorios />} />
        <Route path="configuracoes" element={<AdminConfiguracoes />} />
        <Route path="auditoria" element={<AdminAuditoria />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Rotas Master Admin */}
      <Route path="/master" element={<MasterGuard><MasterLayout /></MasterGuard>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<MasterDashboard onNavigate={() => {}} />} />
        <Route path="arenas" element={<MasterArenas onNavigate={() => {}} />} />
        <Route path="arena-detalhe" element={<MasterArenaDetalhe onNavigate={() => {}} />} />
        <Route path="financeiro" element={<MasterFinanceiro />} />
        <Route path="usuarios" element={<MasterUsuarios />} />
        <Route path="comunicacao" element={<MasterComunicacao />} />
        <Route path="auditoria" element={<MasterAuditoria />} />
        <Route path="configuracoes" element={<MasterConfiguracoes />} />
      </Route>

      {/* Rota Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
