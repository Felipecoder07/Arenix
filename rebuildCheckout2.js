const fs = require('fs');

let html = fs.readFileSync('frontend/landing-cadastro.html', 'utf8');

// Strip html layout
let tsx = html.split('<body>')[1].split('</body>')[0];

// Remove original script tags
tsx = tsx.replace(/<script>[\s\S]*?<\/script>/, '');

// Basic HTML to JSX replacements
tsx = tsx.replace(/class=/g, 'className=')
         .replace(/<!--.*?-->/gs, '')
         .replace(/<img([^>]*)>/g, '<img$1 />')
         .replace(/<input([^>]*)>/g, (m, p) => p.endsWith('/') ? m : `<input${p} />`)
         .replace(/for="/g, 'htmlFor="');

// Fix inline styles
tsx = tsx.replace(/style="(.*?)"/g, (match, p1) => {
    const parts = p1.split(';').filter(x => x.trim());
    const obj = {};
    parts.forEach(p => {
        const [k, v] = p.split(':');
        if (k && v) {
            const camelK = k.trim().replace(/-([a-z])/g, (m, c) => c.toUpperCase());
            obj[camelK] = v.trim();
        }
    });
    return `style={${JSON.stringify(obj)}}`;
});

// Any other unclosed tags fix
tsx = tsx.replace(/autocomplete=/g, 'autoComplete=')
         .replace(/minlength=/g, 'minLength=')
         .replace(/maxlength=/g, 'maxLength=');
tsx = tsx.replace(/stroke-width=/g, 'strokeWidth=')
         .replace(/stroke-linecap=/g, 'strokeLinecap=')
         .replace(/stroke-linejoin=/g, 'strokeLinejoin=');

// Form attributes
tsx = tsx.replace('novalidate', 'noValidate')
         .replace('id="form-cadastro-arena"', 'id="form-cadastro-arena" onSubmit={handleSubmit} className={shake ? \'shake-animation\' : \'\'}');

// Inject state binding to inputs
const bindInput = (name) => `value={formData.${name}} onChange={handleChange} className={\`field-input \${errors.${name} ? 'error' : ''}\`}`;
tsx = tsx.replace(/<input(.*?)name="arena_nome"(.*?)className="field-input"(.*?)>/, `<input$1name="arena_nome"$2 ${bindInput('arena_nome')}$3>`);
tsx = tsx.replace(/<input(.*?)name="arena_cidade"(.*?)className="field-input"(.*?)>/, `<input$1name="arena_cidade"$2 ${bindInput('arena_cidade')}$3>`);
tsx = tsx.replace(/<select(.*?)name="arena_quadras"(.*?)className="field-input"(.*?)>/, `<select$1name="arena_quadras"$2 value={formData.arena_quadras} onChange={handleChange} className={\`field-input \${errors.arena_quadras ? 'error' : ''}\`}$3>`);
tsx = tsx.replace(/<input(.*?)name="resp_nome"(.*?)className="field-input"(.*?)>/, `<input$1name="resp_nome"$2 ${bindInput('resp_nome')}$3>`);
tsx = tsx.replace(/<input(.*?)name="resp_email"(.*?)className="field-input"(.*?)>/, `<input$1name="resp_email"$2 ${bindInput('resp_email')}$3>`);
tsx = tsx.replace(/<input(.*?)name="resp_telefone"(.*?)className="field-input"(.*?)>/, `<input$1name="resp_telefone"$2 value={formData.resp_telefone} onChange={handlePhoneChange} className={\`field-input \${errors.resp_telefone ? 'error' : ''}\`}$3>`);
tsx = tsx.replace(/<input(.*?)name="resp_senha"(.*?)className="field-input"(.*?)>/, `<input$1name="resp_senha"$2 ${bindInput('resp_senha')}$3>`);

// Fix routing and state logic
tsx = tsx.replace('href="index.html"', 'to="/"')
         .replace('href="#"', 'to="#"');
tsx = tsx.replace(/<a href="#" style.*?<\/a>/g, (m) => m.replace('href=', 'to='));

// Fix plan radio buttons state
tsx = tsx.replace(
  /<label className="plan-option selected">[\s\S]*?<input type="radio" name="plano" value="pro" checked \/>/g,
  '<label className={`plan-option ${formData.plano === \'pro\' ? \'selected\' : \'\'}`} onClick={() => setFormData({...formData, plano: \'pro\'})}>\n                <input type="radio" name="plano" value="pro" checked={formData.plano === \'pro\'} readOnly />'
);

tsx = tsx.replace(
  /<label className="plan-option">[\s\S]*?<input type="radio" name="plano" value="starter" \/>/g,
  '<label className={`plan-option ${formData.plano === \'starter\' ? \'selected\' : \'\'}`} onClick={() => setFormData({...formData, plano: \'starter\'})}>\n                <input type="radio" name="plano" value="starter" checked={formData.plano === \'starter\'} readOnly />'
);

tsx = tsx.replace(
  /<label className="plan-option">[\s\S]*?<input type="radio" name="plano" value="enterprise" \/>/g,
  '<label className={`plan-option ${formData.plano === \'enterprise\' ? \'selected\' : \'\'}`} onClick={() => setFormData({...formData, plano: \'enterprise\'})}>\n                <input type="radio" name="plano" value="enterprise" checked={formData.plano === \'enterprise\'} readOnly />'
);

// Fix error div
tsx = tsx.replace(/<div id="cadastro-error"[\s\S]*?<\/div>/, 
  `{errorMsg && (
            <div id="cadastro-error" role="alert" style={{ background: '#fef2f2', color: '#991b1b', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--r-md)', marginBottom: 'var(--s-4)', border: '1px solid rgba(153,27,27,0.2)' }}>
              {errorMsg}
            </div>
          )}`);

// Button logic
tsx = tsx.replace(/<button type="submit"(.*?)>(.*?)<\/button>/, '<button type="submit"$1 disabled={isSubmitting}>{isSubmitting ? \'Criando sua conta...\' : \'$2\'}</button>');


// Wrap in Component
let finalComponent = `import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../assets/css/landing.css';
import '../../assets/css/checkout.css';

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
    plano: 'pro'
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\\D/g, '');
    let formatted = val;
    if (val.length > 0) {
      formatted = '(' + val.substring(0,2);
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

    if (hasError) {
      setErrors(newErrors);
      setErrorMsg('Preencha todos os campos obrigatórios.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Cadastra o novo usuário (Administrador) e a Arena
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
        // 2. Se o cadastro for ok, já fazemos o Auto-login
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.resp_email, senha: formData.resp_senha })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('usuario', JSON.stringify(loginData.usuario));
          navigate('/master/dashboard');
        } else {
          // Se o auto-login falhar por algum motivo, manda pro login manual
          navigate('/login');
        }
      } else {
        setErrorMsg(data.error || 'Erro ao criar conta. Verifique os dados.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
${tsx}
    </>
  );
}`;

// Fix Links
finalComponent = finalComponent.replace(/<a to="/g, '<Link to="')
                               .replace(/<\/a>/g, '</Link>');
finalComponent = finalComponent.replace(/<Link href="login\.html">Entrar<\/Link>/, '<Link to="/login">Entrar</Link>');

fs.writeFileSync('master-templates/src/screens/public/Checkout.tsx', finalComponent);
