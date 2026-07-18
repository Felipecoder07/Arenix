import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MasterDashboard } from './screens/MasterDashboard';
import { MasterArenas } from './screens/MasterArenas';
import { MasterArenaDetalhe } from './screens/MasterArenaDetalhe';
import { MasterFinanceiro } from './screens/MasterFinanceiro';
import { MasterUsuarios } from './screens/MasterUsuarios';
import { MasterComunicacao } from './screens/MasterComunicacao';
import { MasterAuditoria } from './screens/MasterAuditoria';
import { MasterConfiguracoes } from './screens/MasterConfiguracoes';

function App() {
  const [active, setActive] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // Sincronizar auth via URL params (porque estão em portas diferentes: 3000 vs 5173)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlUser = params.get('user');

    if (urlToken && urlUser) {
      localStorage.setItem('courtmanager_token', urlToken);
      try {
        const decodedUser = decodeURIComponent(atob(urlUser));
        localStorage.setItem('courtmanager_user', decodedUser);
      } catch(e) {}
      // Limpa a URL para não ficar suja
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('courtmanager_token');
    const userStr = localStorage.getItem('courtmanager_user');
    
    let isValid = false;
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.perfil === 'SuperAdmin') {
          isValid = true;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isValid) {
      window.location.href = 'http://localhost:3000/master-login.html';
    } else {
      setIsAuth(true);
    }
  }, []);

  if (!isAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-cream text-charcoal">Redirecionando para login...</div>;
  }

  const render = () => {
    switch (active) {
      case 'dashboard': return <MasterDashboard onNavigate={setActive} />;
      case 'arenas': return <MasterArenas onNavigate={setActive} />;
      case 'arena-detalhe': return <MasterArenaDetalhe onNavigate={setActive} />;
      case 'financeiro': return <MasterFinanceiro />;
      case 'usuarios': return <MasterUsuarios />;
      case 'comunicacao': return <MasterComunicacao />;
      case 'auditoria': return <MasterAuditoria />;
      case 'configuracoes': return <MasterConfiguracoes />;
      default: return <MasterDashboard onNavigate={setActive} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar active={active} onNavigate={setActive} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar active={active} onToggleSidebar={() => setCollapsed((c) => !c)} onNavigate={setActive} />
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto animate-fade-in" key={active}>
          {render()}
        </main>
      </div>
    </div>
  );
}

export default App;
