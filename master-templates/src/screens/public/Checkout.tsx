import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../assets/css/landing.css';
import '../../assets/css/checkout.css';

const DEFAULT_PLANOS = [
  { id: 1, nome: 'Basic', max_quadras: 3, max_usuarios: 3, valor_mensal: 49.99 },
  { id: 2, nome: 'Pro', max_quadras: 10, max_usuarios: 10, valor_mensal: 79.99 },
  { id: 3, nome: 'Enterprise', max_quadras: 999, max_usuarios: 999, valor_mensal: 0 }
];

export function Checkout() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    arena_nome: '',
    arena_cidade: '',
    arena_quadras: '',
    resp_nome: '',
    resp_email: '',
    resp_telefone: '',
    resp_senha: '',
    plano: '2'
  });

  const [planosPublicos, setPlanosPublicos] = useState<any[]>(DEFAULT_PLANOS);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3000/api/auth/planos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlanosPublicos(data);
          const pro = data.find(p => p.nome.toLowerCase() === 'pro');
          setFormData(prev => ({ ...prev, plano: String(pro ? pro.id : data[0].id) }));
        }
      })
      .catch(err => console.error('Erro ao buscar planos públicos:', err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    let formatted = val;
    if (val.length > 0) {
      formatted = '(' + val.substring(0, 2);
      if (val.length > 2) {
        formatted += ') ' + val.substring(2, 7);
      }
      if (val.length > 7) {
        formatted += '-' + val.substring(7, 11);
      }
    }
    setFormData(prev => ({ ...prev, resp_telefone: formatted }));
    if (errors.resp_telefone) {
      setErrors(prev => ({ ...prev, resp_telefone: false }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    Object.keys(formData).forEach((key) => {
      if (key !== 'plano' && !formData[key as keyof typeof formData].trim()) {
        newErrors[key] = true;
        hasError = true;
      }
    });

    if (!hasError && formData.resp_nome.trim().split(/\s+/).length < 2) {
      newErrors.resp_nome = true;
      hasError = true;
      setErrorMsg('Por favor, informe seu nome completo (nome e sobrenome).');
    }

    if (hasError) {
      setErrors(newErrors);
      if (!formData.resp_nome.trim() || formData.resp_nome.trim().split(/\s+/).length >= 2) {
        setErrorMsg('Preencha todos os campos obrigatórios.');
      }
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.resp_nome,
          email: formData.resp_email,
          senha: formData.resp_senha,
          perfil: 'Administrador',
          arena_nome: formData.arena_nome,
          telefone: formData.resp_telefone,
          arena_cidade: formData.arena_cidade,
          arena_quadras: formData.arena_quadras,
          plano: formData.plano
        })
      });

      const data = await response.json();

      if (response.ok) {
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.resp_email, senha: formData.resp_senha })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          localStorage.setItem('courtmanager_token', loginData.token);
          localStorage.setItem('courtmanager_user', JSON.stringify(loginData.usuario));
          if (loginData.usuario.arena_nome) {
            localStorage.setItem('arena_nome', loginData.usuario.arena_nome);
          }
          navigate('/admin/dashboard');
        } else {
          navigate('/login');
        }
      } else {
        setErrorMsg(data.error || 'Erro ao criar conta. Verifique os dados.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setErrorMsg('Erro de conexão com o servidor.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="scope-checkout-page">
      <div className="onboard-page">
        <div className="onboard-left">
          <Link to="/" className="onboard-left-logo">
            <div className="nav-brand-icon">CM</div>
            <span className="nav-brand-name">CourtManager</span>
          </Link>
          <div className="onboard-pitch">
            <h2 className="onboard-pitch-title">
              Sua arena,<br />
              <span>organizada de verdade.</span>
            </h2>
            <div className="onboard-checks">
              <div className="onboard-check">
                <div className="onboard-check-icon">✓</div>
                <span>Grade de reservas visual, sem conflitos de horário</span>
              </div>
              <div className="onboard-check">
                <div className="onboard-check-icon">✓</div>
                <span>Controle financeiro completo — pago, parcial e pendente</span>
              </div>
              <div className="onboard-check">
                <div className="onboard-check-icon">✓</div>
                <span>Gestão de mensalistas e recorrência automatizada</span>
              </div>
              <div className="onboard-check">
                <div className="onboard-check-icon">✓</div>
                <span>Relatórios de faturamento e ocupação por quadra</span>
              </div>
              <div className="onboard-check">
                <div className="onboard-check-icon">✓</div>
                <span>14 dias gratuitos — sem cartão de crédito</span>
              </div>
            </div>
          </div>
          <div className="onboard-testimonial">
            <blockquote>
              "Antes eu controlava tudo no WhatsApp e numa planilha. Com o CourtManager, em 30 minutos já tinha tudo
              configurado e as reservas começaram a entrar sozinhas."
            </blockquote>
            <cite>— Rodrigo F., Arena Beach Sports, Campinas</cite>
          </div>
        </div>

        <div className="onboard-right">
          <div className="onboard-form-wrapper">
            <div style={{ "textAlign": "right", "marginBottom": "16px" }}>
              <Link to="/" style={{ "fontSize": "13px", "color": "var(--muted)", "textDecoration": "none", "fontWeight": "500", "transition": "color 0.2s" }}>← Voltar ao início</Link>
            </div>
            <h1 className="onboard-form-title">Criar conta da Arena</h1>
            <p className="onboard-form-sub">Preencha os dados da arena e do responsável. Em 2 minutos você acessa o sistema.</p>

            <form id="form-cadastro-arena" onSubmit={handleSubmit} className={shake ? 'shake-animation' : ''} noValidate>

              <div
                style={{ "fontSize": "12px", "fontWeight": "600", "color": "var(--charcoal)", "marginBottom": "12px", "borderBottom": "1px solid var(--border-warm)", "paddingBottom": "8px", "display": "flex", "alignItems": "center", "gap": "8px" }}>
                Dados da Arena
              </div>
              <div className="form-group">
                <label htmlFor="arena-nome" className="field-label">Nome da arena *</label>
                <input type="text" id="arena-nome" name="arena_nome" className={`field-input ${errors.arena_nome ? 'error' : ''}`} placeholder="Ex: Arena Beach Prime"
                  maxLength={100} required value={formData.arena_nome} onChange={handleChange} />
              </div>
              <div style={{ "display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": "12px", "marginBottom": "16px" }}>
                <div className="form-group">
                  <label htmlFor="arena-cidade" className="field-label">Cidade *</label>
                  <input type="text" id="arena-cidade" name="arena_cidade" className={`field-input ${errors.arena_cidade ? 'error' : ''}`} placeholder="Ex: Campinas"
                    maxLength={100} required value={formData.arena_cidade} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="arena-quadras" className="field-label">Nº de quadras *</label>
                  <select id="arena-quadras" name="arena_quadras" className={`field-input ${errors.arena_quadras ? 'error' : ''}`} required value={formData.arena_quadras} onChange={handleChange}>
                    <option value="">Selecione</option>
                    <option value="1">1 quadra</option>
                    <option value="2">2 quadras</option>
                    <option value="3">3 quadras</option>
                    <option value="4-6">4 a 6 quadras</option>
                    <option value="7-10">7 a 10 quadras</option>
                    <option value="10+">Mais de 10</option>
                  </select>
                </div>
              </div>

              <div
                style={{ "fontSize": "12px", "fontWeight": "600", "color": "var(--charcoal)", "margin": "16px 0 12px", "borderBottom": "1px solid var(--border-warm)", "paddingBottom": "8px", "display": "flex", "alignItems": "center", "gap": "8px" }}>
                Responsável
              </div>
              <div className="form-group">
                <label htmlFor="resp-nome" className="field-label">Nome completo *</label>
                <input type="text" id="resp-nome" name="resp_nome" className={`field-input ${errors.resp_nome ? 'error' : ''}`} placeholder="Seu nome"
                  maxLength={100} required value={formData.resp_nome} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="resp-email" className="field-label">E-mail *</label>
                <input type="email" id="resp-email" name="resp_email" className={`field-input ${errors.resp_email ? 'error' : ''}`} placeholder="seu@email.com"
                  autoComplete="email" maxLength={255} required value={formData.resp_email} onChange={handleChange} />
              </div>
              <div style={{ "display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": "12px", "marginBottom": "16px" }}>
                <div className="form-group">
                  <label htmlFor="resp-telefone" className="field-label">Telefone *</label>
                  <input type="tel" id="resp-telefone" name="resp_telefone" className={`field-input ${errors.resp_telefone ? 'error' : ''}`}
                    placeholder="(11) 99999-9999" maxLength={15} required value={formData.resp_telefone} onChange={handlePhoneChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="resp-senha" className="field-label">Senha *</label>
                  <div className="password-wrapper">
                    <input type="password" id="resp-senha" name="resp_senha" className={`field-input ${errors.resp_senha ? 'error' : ''}`}
                      placeholder="Mínimo 8 caracteres" autoComplete="new-password" required minLength={8}
                      maxLength={128} value={formData.resp_senha} onChange={handleChange} />
                    <svg className="password-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                </div>
              </div>

              <div
                style={{ "fontSize": "12px", "fontWeight": "600", "color": "var(--charcoal)", "margin": "16px 0 12px", "borderBottom": "1px solid var(--border-warm)", "paddingBottom": "8px", "display": "flex", "alignItems": "center", "gap": "8px" }}>
                Plano
              </div>
              <div className="plan-selector">
                {planosPublicos.length > 0 ? (
                  planosPublicos.map((p) => {
                    const isSelected = String(formData.plano) === String(p.id) || formData.plano === p.nome.toLowerCase();
                    const priceText = p.valor_mensal > 0
                      ? `R$ ${p.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
                      : 'Sob consulta';
                    return (
                      <label
                        key={p.id}
                        className={`plan-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, plano: String(p.id) }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <input type="radio" name="plano" value={p.id} checked={isSelected} readOnly />
                        <div className="plan-option-info">
                          <div className="plan-name">{p.nome}</div>
                          <div className="plan-desc">Até {p.max_quadras} quadras — Até {p.max_usuarios} usuários</div>
                        </div>
                        <span className="plan-option-price">{priceText}</span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ padding: '12px', fontSize: '13px', color: 'var(--muted)' }}>Carregando planos da plataforma...</div>
                )}
              </div>

              <p style={{ "fontSize": "11px", "color": "var(--muted)", "marginBottom": "16px" }}>
                Ao criar a conta, você concorda com os <Link to="#" style={{ "color": "var(--charcoal)" }}>Termos de Uso</Link> e a <Link to="#" style={{ "color": "var(--charcoal)" }}>Política de Privacidade</Link>. Seus dados são protegidos conforme a
                LGPD.
              </p>

              {errorMsg && (
                <div id="cadastro-error" role="alert"
                  style={{ "background": "#fef2f2", "color": "#991b1b", "fontSize": "13px", "padding": "10px 14px", "borderRadius": "var(--r-md)", "marginBottom": "var(--s-4)", "border": "1px solid rgba(153,27,27,0.2)" }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn btn-dark btn-full btn-lg" id="btn-criar-conta" disabled={isSubmitting}>
                {isSubmitting ? 'Criando conta...' : 'Criar conta e começar grátis'}
              </button>
            </form>

            <p className="auth-footer-text" style={{ "fontSize": "12px", "marginTop": "16px" }}>
              Já tem uma conta? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}