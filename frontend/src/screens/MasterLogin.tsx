import { apiFetch as fetch } from '../utils/apiFetch';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';
import { Card, Button, Input, Field } from '../components/ui';
import '../assets/css/master.css';
import '../assets/css/master-reference.css';

export function MasterLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha: password }),
      });

      const data = await res.json().catch(() => null);
      if (!data) {
        setErrorMsg('Servidor indisponível. Verifique se o backend está em execução.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      if (data.usuario.perfil !== 'SuperAdmin') {
        setErrorMsg('Acesso negado. Esta tela é exclusiva para o Administrador Master.');
        setLoading(false);
        return;
      }

      const safeUser = data.usuario ? JSON.stringify(data.usuario).replace(/[<>\0]/g, '') : '';

      safeStorage.setItem('courtmanager_user', safeUser);

      navigate('/master/dashboard', { replace: true });
    } catch (err) {
      const safeErr = String(err instanceof Error ? err.message : err).replace(/[\r\n]/g, '');
      console.error('Erro no login Master:', safeErr);
      setErrorMsg('Servidor indisponível. Verifique se o backend está em execução.');
      setLoading(false);
    }
  };

  return (
    <div className="master-login">
      <Card className="master-login-card">
        {/* Header / Logo */}
        <div className="master-brand master-login-brand">
          <span className="master-monogram">CM</span>
          <div><h1>courtly</h1><small>PAINEL MASTER</small></div>
        </div>

        {/* Card de Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div role="alert" className="master-login-error p-3 rounded-lg text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            <Field label="E-mail">
              <div className="relative">
                <Input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="master@courtmanager.com"
                  style={{ paddingLeft: '2.5rem' }}
                />
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted/60">
                  <Mail size={15} />
                </div>
              </div>
            </Field>

            <Field label="Senha">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                />
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted/60">
                  <Lock size={15} />
                </div>
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-charcoal focus:outline-none"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full justify-center py-2 shadow-sm mt-2 font-medium"
            >
              {loading ? 'Acessando...' : 'Entrar'}
            </Button>
          </form>
      </Card>
    </div>
  );
}
