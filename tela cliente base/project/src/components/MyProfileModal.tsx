import { useState, useEffect } from 'react';
import { User, Phone, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, X, Shield, CreditCard } from 'lucide-react';
import { maskPhone, maskCPF } from '../lib/format';

const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? `http://${window.location.hostname}:3000`
  : 'http://localhost:3000';

interface Props {
  slug: string;
  athlete: { name: string; email: string; phone: string };
  open: boolean;
  onClose: () => void;
  onUpdate: (updated: { name: string; phone: string }) => void;
}

export default function MyProfileModal({ slug, athlete, open, onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<'dados' | 'senha'>('dados');
  const [name, setName] = useState(athlete.name);
  const [phone, setPhone] = useState(athlete.phone);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [open]);

  // Carrega os dados reais do atleta do backend ao abrir
  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('atleta_token');
    if (!token) return;

    fetch(`${BACKEND_URL}/api/public/tenant/${slug}/meu-perfil`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.perfil) {
          setName(data.perfil.nome || athlete.name);
          setPhone(data.perfil.telefone || athlete.phone);
          setCpf(data.perfil.cpf || '');
        }
      })
      .catch(() => {});
  }, [open, slug, athlete]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (tab === 'senha') {
      if (password.length < 6) {
        setError('A senha deve possuir no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('A confirmação de senha não coincide com a nova senha.');
        return;
      }
    }

    setLoading(true);
    const token = localStorage.getItem('atleta_token');

    try {
      const payload: any = {
        nome: name.trim(),
        telefone: phone.trim(),
        cpf: cpf.trim()
      };
      if (tab === 'senha' && password) {
        payload.nova_senha = password;
      }

      const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/meu-perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.usuario) {
        setSuccess('Dados salvos com sucesso!');
        onUpdate({
          name: data.usuario.nome,
          phone: data.usuario.telefone
        });
        if (tab === 'senha') {
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        setError(data.error || 'Erro ao atualizar informações.');
      }
    } catch {
      setError('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-cream rounded-3xl overflow-hidden shadow-sheet flex flex-col max-h-[90vh]">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-5 bg-card border-b border-edge">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-available-bg text-available-text flex items-center justify-center font-bold">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-charcoal">Meus Dados Pessoais</h2>
              <p className="text-xs text-muted">{athlete.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-edge text-charcoal/70 flex items-center justify-center active:scale-95 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-edge bg-cream px-5 pt-3 gap-3">
          <button
            onClick={() => { setTab('dados'); setError(null); setSuccess(null); }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tab === 'dados' ? 'border-charcoal text-charcoal' : 'border-transparent text-muted'
            }`}
          >
            <User size={14} /> Dados Pessoais
          </button>
          <button
            onClick={() => { setTab('senha'); setError(null); setSuccess(null); }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tab === 'senha' ? 'border-charcoal text-charcoal' : 'border-transparent text-muted'
            }`}
          >
            <Shield size={14} /> Cadastrar / Alterar Senha
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {tab === 'dados' ? (
            <>
              <div>
                <label className="text-xs font-bold text-charcoal/80 block mb-1">Nome Completo</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-edge bg-card px-3.5 h-12">
                  <User size={16} className="text-muted" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu Nome Completo"
                    className="flex-1 bg-transparent outline-none text-sm text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-charcoal/80 block mb-1">WhatsApp / Telefone</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-edge bg-card px-3.5 h-12">
                  <Phone size={16} className="text-muted" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(00) 900000000"
                    className="flex-1 bg-transparent outline-none text-sm text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-charcoal/80 block mb-1">CPF (Opcional para recibos Pix)</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-edge bg-card px-3.5 h-12">
                  <CreditCard size={16} className="text-muted" />
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="flex-1 bg-transparent outline-none text-sm text-charcoal"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-available-bg/60 p-3 rounded-2xl border border-available-border/40 text-xs text-available-text space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Shield size={14} /> Cadastre sua senha direta
                </p>
                <p className="opacity-90">
                  Cadastre uma senha para poder fazer login digitando seu e-mail e senha em qualquer celular ou computador.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-charcoal/80 block mb-1">Nova Senha</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-edge bg-card px-3.5 h-12">
                  <Lock size={16} className="text-muted" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 bg-transparent outline-none text-sm text-charcoal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="text-muted"
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-charcoal/80 block mb-1">Confirmar Nova Senha</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-edge bg-card px-3.5 h-12">
                  <Lock size={16} className="text-muted" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="flex-1 bg-transparent outline-none text-sm text-charcoal"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-error-bg px-3 py-2 text-xs text-error-text">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-xl bg-available-bg px-3 py-2 text-xs text-available-text font-semibold">
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-available-text text-white font-bold active:scale-[0.98] transition disabled:opacity-60 h-12 text-sm"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
