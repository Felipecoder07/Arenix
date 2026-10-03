import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { safeStorage } from '../../utils/safeStorage';

// SVGs fieis exportados do pen.dev
const IconCheck = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[14px] h-[14px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.48096 2.95313q-0.07178 0.01367-0.12989 0.0581-0.05469 0.04102-3.07617 3.06592l-3.0249 3.00781-1.28857-1.28857q-1.28857-1.28516-1.38086-1.32618-0.08887-0.04443-0.22217-0.04443-0.1333 0-0.23242 0.0376-0.0957 0.03418-0.18799 0.11279-0.08887 0.0752-0.1333 0.1709-0.02734 0.07178-0.03418 0.11279-0.00684 0.04102-0.00684 0.14014l0 0.04102q-0.01367 0.11279 0.04102 0.19824 0.07178 0.10938 0.36572 0.40332 0.19482 0.21191 0.96729 0.98096l1.49707 1.48339q0.28027 0.2666 0.38964 0.33838 0.07178 0.05469 0.18457 0.04102l0.09571 0.01367q0.07178 0 0.14013-0.02734 0.08545-0.07178 0.32129-0.28711 0.23926-0.21875 0.79981-0.76221l2.2832-2.2832q2.08496-2.09863 2.7002-2.71387 0.61524-0.61865 0.64599-0.68701 0.04102-0.08545 0.04102-0.23926 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.18115-0.11963-0.08887-0.0376-0.20849-0.0376-0.11963 0-0.18799 0.02734z"
      fill="#C9FF3B"
    />
  </svg>
);

const IconMail = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[17px] h-[17px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 3.17871 0 3.17871q0.01367 0.56055 0.02734 0.66992 0.11279 0.5332 0.50245 0.90577 0.39307 0.36914 0.92627 0.46826 0.16748 0.02734 4.95605 0.02734 4.78857 0 4.95605-0.02734 0.5332-0.09912 0.92286-0.46826 0.39307-0.37256 0.50586-0.90577 0.01367-0.10938 0.02734-0.66992l0-3.17871 0-3.17871q-0.01367-0.56055-0.02734-0.66992-0.12647-0.54688-0.53321-0.92285-0.40674-0.37939-0.95019-0.46485-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.46436 1.58252q-2.46436 1.56543-2.53613 1.60303-0.06836 0.03418-0.16748 0.03418l-0.02734 0.01367q-0.0957 0.01367-0.2085-0.04102-0.15381-0.07178-0.65967-0.37939l-4.40918-2.81299 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m-5.63964 5.02783q0.22217 0.10938 0.46142 0.15381 0.09912 0.02734 0.30762 0.02734 0.2085 0 0.30762-0.02734 0.30762-0.05811 0.54687-0.19825 0.14014-0.08203 2.26612-1.42529l2.12939-1.36035-0.01367 5.50293-0.04102 0.09912q-0.11279 0.2085-0.3247 0.29395l-0.09571 0.02734-9.5498 0-0.09571-0.02734q-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.50293 2.17041 1.37402q2.17041 1.38428 2.31055 1.45606z"
      fill="#A39A90"
    />
  </svg>
);

const IconLock = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[17px] h-[17px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.77441 0.60156q-0.72803 0.02734-1.38769 0.3794-0.65625 0.34863-1.12451 0.92285-0.46826 0.57422-0.64942 1.28857-0.07178 0.29395-0.08545 0.46143-0.01367 0.16748-0.02734 0.7998l0 0.79639-0.42041 0q-0.43408 0.01367-0.57422 0.05469-0.50244 0.12646-0.85449 0.49218-0.34863 0.3623-0.44775 0.88184-0.02734 0.0957-0.02735 0.52979l0 4.7749 0.05469 0.15381q0.15723 0.51953 0.56055 0.86133 0.40674 0.3418 0.93994 0.3999 0.14014 0.02734 4.26904 0.02734 4.12891 0 4.26904-0.02734 0.30762-0.02734 0.58789-0.16748 0.32471-0.15381 0.56055-0.44092 0.23926-0.28711 0.35205-0.65283l0.05469-0.15381 0-4.7749q0-0.43408-0.02735-0.52979-0.09912-0.51953-0.45117-0.88183-0.34863-0.36572-0.85107-0.49219-0.14014-0.04102-0.57422-0.05469l-0.42041 0 0-0.79639q-0.01367-0.63232-0.02734-0.7998-0.01367-0.16748-0.08545-0.46143-0.18115-0.71436-0.66651-1.30224-0.48193-0.58789-1.15185-0.93653-0.82715-0.40674-1.79444-0.35205z m0.70069 1.20313q0.75537 0.15381 1.2749 0.7417 0.3623 0.40674 0.50244 0.92627 0.04443 0.19482 0.05811 0.37939 0.01367 0.18115 0.01367 0.71094l0 0.68701-4.64844 0 0-0.75537q0-0.61523 0.02051-0.76904 0.02051-0.15723 0.09228-0.3794 0.22217-0.64258 0.74854-1.06982 0.52637-0.42725 1.19629-0.5127 0.14014-0.01367 0.3623 0 0.22559 0.01367 0.3794 0.04102z m3.79394 4.64844q0.12646 0.04443 0.23243 0.15039 0.10596 0.10254 0.14697 0.229 0.01367 0.06836 0.01367 2.50537l0 2.09863q-0.01367 0.3794-0.02734 0.42041-0.09912 0.25293-0.35205 0.35205l-0.09571 0.04102-8.37402 0-0.0957-0.04102q-0.11279-0.04443-0.16407-0.08544-0.04785-0.04101-0.11279-0.12989-0.06152-0.09229-0.08203-0.16064-0.02051-0.07178-0.02051-2.49512 0-2.42334 0.01367-2.50537 0.04102-0.12646 0.14014-0.22217 0.09912-0.09912 0.22559-0.15722 0.05469-0.01367 0.69726-0.02735l3.57178 0 3.51367 0q0.71435 0 0.76904 0.02735z m-4.54931 1.75q-0.28027 0.05811-0.53321 0.30761-0.19482 0.19824-0.27343 0.38623-0.0752 0.18799-0.0752 0.44092 0 0.36572 0.18115 0.62891 0.23926 0.35205 0.6084 0.47851 0.37256 0.12305 0.7417 0 0.37256-0.12646 0.61182-0.47851 0.18115-0.26318 0.18115-0.62891 0-0.25293-0.07861-0.44092-0.0752-0.18799-0.27002-0.38623-0.25293-0.24951-0.54688-0.30761-0.11279-0.02734-0.27344-0.02735-0.16064 0-0.27343 0.02735z"
      fill="#A39A90"
    />
  </svg>
);

const IconArrowRight = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[17px] h-[17px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.90088 2.35156q-0.18115 0.02734-0.32129 0.16748-0.11279 0.11279-0.14697 0.28028-0.03418 0.16748 0.02051 0.32129 0.02734 0.08545 0.25976 0.3247 0.23242 0.23584 1.36377 1.37061 1.58252 1.58252 1.58252 1.59619 0 0.01367-3.45557 0.01367l-3.44531 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.53321 0.03418l3.01123 0q3.42822 0 3.42822 0.01367 0 0.01367-1.58252 1.59619-1.13135 1.13477-1.36377 1.37402-0.23242 0.23584-0.25976 0.3213-0.05469 0.15381-0.02051 0.32128 0.03418 0.16748 0.14697 0.28028 0.18115 0.18115 0.42041 0.18115l0.04102 0q0.11279 0 0.19824-0.05469 0.14014-0.09912 0.51611-0.46484l1.68164-1.67822q2.1123-2.10205 2.15332-2.18409 0.07178-0.12646 0.07178-0.28027 0-0.15381-0.07178-0.28027-0.04102-0.08203-2.1499-2.18067-2.10547-2.10205-2.17725-2.13623-0.06836-0.0376-0.23584-0.06494-0.04102 0-0.12646 0.01367z"
      fill="#C9FF3B"
    />
  </svg>
);

const IconShield = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[17px] h-[17px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.84619 0.60156q-0.34863 0.02734-0.68701 0.30762-0.51611 0.42041-1.00147 0.70068-0.48193 0.28027-1.01513 0.4751-0.30762 0.11279-0.58789 0.1709-0.28027 0.05469-0.66992 0.08203-0.23926 0.01367-0.36573 0.07178-0.19482 0.06836-0.37939 0.22217-0.18115 0.15381-0.26319 0.34863l-0.01367 0.03076q-0.07178 0.12646-0.08545 0.22217-0.01367 0.15381-0.02734 0.60156l0 1.78076q0 2.25244 0.01367 2.46094 0.14014 1.6543 1.10742 2.88477 0.14014 0.16748 0.43409 0.46142 0.29395 0.29394 0.48877 0.44775 0.92285 0.7417 2.2832 1.27491 0.46143 0.18115 0.65625 0.23926 0.23926 0.05469 0.43408 0.01367 0.16748-0.02734 0.5332-0.15381 1.35693-0.51953 2.27979-1.20313 0.37939-0.2666 0.71435-0.60498 1.37402-1.3706 1.54151-3.37353 0.01367-0.23584 0.01367-2.46094 0-2.22852-0.02734-2.35498-0.07178-0.32129-0.31787-0.56396-0.24268-0.24609-0.5503-0.31788-0.09912-0.02734-0.37939-0.04101-0.48877-0.02734-0.96387-0.18115-0.81348-0.2666-1.55518-0.77246-0.2666-0.18115-0.64257-0.48877-0.42041-0.33496-0.96729-0.28028z m0.43408 1.34326q0.64258 0.51953 1.32959 0.86817 1.2168 0.61865 2.25244 0.68701l0.21192 0-0.01367 4.31348q0 0.33496-0.02735 0.50244-0.22559 1.34326-1.1416 2.27637-0.91602 0.92969-2.66601 1.57226l-0.21192 0.08545-0.18115-0.05469q-2.32422-0.85449-3.2334-2.22851-0.47852-0.71436-0.63232-1.63721-0.02734-0.18115-0.02735-0.50244l-0.01367-4.32715 0.19483 0q0.86816-0.05469 1.84912-0.48193 0.98096-0.42725 1.83545-1.12793 0.16748-0.14014 0.19482-0.14014 0.02734 0 0.28027 0.19482z m1.32959 3.31885q-0.06836 0.02734-0.12646 0.05127-0.05469 0.02051-1.06299 1.02539l-0.99463 0.99463-0.40674-0.40332q-0.2666-0.2666-0.3623-0.33838-0.12646-0.11279-0.19824-0.14013-0.06836-0.02734-0.19483-0.02735-0.12646 0-0.16748 0.01367-0.04102 0.01367-0.09912 0.04102-0.18115 0.09912-0.28027 0.2666-0.04102 0.08545-0.04102 0.25293l0 0.01367q0 0.14014 0.03418 0.21192 0.0376 0.06836 0.17774 0.22216 0.0957 0.11279 0.48876 0.50586l0.04102 0.04102q0.42041 0.42041 0.55371 0.54687 0.1333 0.12305 0.20166 0.15381 0.14014 0.06836 0.29395 0.05469 0.15381-0.01367 0.28027-0.09912 0.07178-0.05469 1.28857-1.27149 0.86816-0.86816 1.04932-1.06298 0.18457-0.19824 0.21192-0.27002 0.0957-0.27686-0.05811-0.52295-0.15381-0.24609-0.44775-0.25977-0.12646-0.01367-0.18116 0z"
      fill="#138A4B"
    />
  </svg>
);

export function TenantLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      if (data.usuario.perfil === 'Cliente') {
        setError('Acesso negado. Página exclusiva para a equipe de gestão.');
        setLoading(false);
        return;
      }

      if (data.usuario.perfil === 'SuperAdmin') {
        setError('Acesso Master não permitido por aqui.');
        setLoading(false);
        return;
      }

      const safeUser = data.usuario ? JSON.stringify(data.usuario).replace(/[<>\0]/g, '') : '';
      const sanitizeStr = (s: unknown): string => typeof s === 'string' ? s.replace(/[<>"'&]/g, '').trim() : '';

      safeStorage.setItem('courtmanager_user', safeUser);
      if (data.usuario.arena_nome) {
        safeStorage.setItem('arena_nome', sanitizeStr(data.usuario.arena_nome));
      }
      if (data.usuario.arena_slug) {
        safeStorage.setItem('arena_slug', sanitizeStr(data.usuario.arena_slug));
      }

      if (data.usuario.arena_status === 0) {
        navigate('/admin/assinatura');
      } else {
        navigate('/admin/dashboard');
      }

    } catch {
      setError('Erro de conexão com o servidor.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F2EA]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* PAINEL ESCURO (ESQUERDA) */}
      <div className="w-full lg:w-1/2 bg-[#171512] relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-14 min-h-[580px] lg:min-h-screen">
        {/* Glow Verde */}
        <div
          className="absolute -right-20 top-10 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(201, 255, 59, 0.2) 0%, rgba(201, 255, 59, 0) 100%)',
            backgroundSize: '100% 100%',
          }}
        />

        {/* Glow Azul */}
        <div
          className="absolute -left-20 bottom-10 w-[380px] h-[220px] rounded-full pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(67, 183, 255, 0.16) 0%, rgba(67, 183, 255, 0) 100%)',
            backgroundSize: '100% 100%',
          }}
        />

        {/* Marca Topo */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 no-underline group">
            <div className="w-[38px] h-[38px] shrink-0 flex items-center justify-center bg-[#2A2926] rounded-[10px] outline outline-1 outline-[#52504A] -outline-offset-[0.5px]">
              <span className="text-[15px] text-white font-normal">CM</span>
            </div>
            <span className="text-[20px] text-white font-normal tracking-tight">CourtManager</span>
          </Link>
        </div>

        {/* Conteúdo Central: Boas-vindas e Benefícios */}
        <div className="relative z-10 flex flex-col gap-6 my-auto py-8 max-w-[560px]">
          <h1 className="text-[38px] sm:text-[46px] lg:text-[54px] leading-[1.05] text-white font-normal tracking-[-2px]">
            Bem-vindo de volta ao seu portal
          </h1>

          <p className="text-[16px] sm:text-[17px] leading-[25px] text-[#B8B4AA] font-normal max-w-[500px]">
            Acompanhe reservas, pagamentos e ocupação das quadras em uma visão rápida, segura e pensada para gestores de arena.
          </p>

          <div className="flex flex-col gap-3.5 pt-2">
            {[
              'Reservas em tempo real',
              'Controle de caixa e pagamentos',
              'Gestão de clientes e recorrências'
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-6 h-6 shrink-0 flex items-center justify-center bg-[#2D2B27] rounded-[12px] outline outline-1 outline-[#4F4D47] -outline-offset-[0.5px]">
                  <IconCheck />
                </div>
                <span className="text-[15px] text-[#E8E5DE] font-normal">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depoimento Rodapé */}
        <div className="relative z-10 pt-5 border-t border-white/10 flex flex-col gap-4 max-w-[620px]">
          <p className="text-[15px] leading-[23px] text-[#C9C5BA] italic">
            “O sistema mudou a forma como lidamos com os agendamentos. Muito mais paz no dia a dia da arena.”
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#3A3833] outline outline-1 outline-[#59564F] -outline-offset-[0.5px] flex items-center justify-center text-xs text-[#E8E5DE] font-medium">
              RD
            </div>
            <span className="text-[13px] text-[#A9A49A] font-normal">
              Rafael D. — Arena Sunset
            </span>
          </div>
        </div>
      </div>

      {/* ÁREA FORMULÁRIO (DIREITA) */}
      <div className="w-full lg:w-1/2 bg-[#F7F2EA] flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 relative min-h-[580px] lg:min-h-screen">
        <div className="w-full max-w-[456px] flex flex-col gap-5">
          {/* Voltar */}
          <div>
            <Link
              to="/"
              className="text-[14px] text-[#8D8278] hover:text-[#071915] transition-colors no-underline inline-flex items-center gap-1.5"
            >
              ← Voltar ao início
            </Link>
          </div>

          {/* Cabeçalho */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[30px] leading-tight text-[#071915] font-normal tracking-[-0.5px]">
              Acesse sua conta
            </h2>
            <p className="text-[15px] text-[#8A8177] font-normal">
              Portal exclusivo para gestores de arena.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
            {/* Campo E-mail */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[13px] text-[#071915] font-normal">
                E-mail
              </label>
              <div className="w-full h-[48px] px-4 flex items-center gap-2.5 bg-white rounded-[10px] outline outline-1 outline-[#DCD3C6] -outline-offset-[0.5px] focus-within:outline-[#071915] focus-within:outline-2 transition-all">
                <IconMail />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="seu@email.com"
                  className="w-full bg-transparent border-none outline-none text-[15px] text-[#071915] placeholder-[#A39A90]"
                  required
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-[13px] text-[#071915] font-normal">
                  Senha
                </label>
                <Link
                  to="/esqueci-senha"
                  className="text-[13px] text-[#8A8177] hover:text-[#071915] transition-colors no-underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="w-full h-[48px] px-4 flex items-center gap-2.5 bg-white rounded-[10px] outline outline-1 outline-[#DCD3C6] -outline-offset-[0.5px] focus-within:outline-[#071915] focus-within:outline-2 transition-all">
                <IconLock />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent border-none outline-none text-[15px] text-[#071915] placeholder-[#A39A90]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[13px] text-[#70675E] hover:text-[#071915] transition-colors cursor-pointer select-none bg-transparent border-none p-0"
                >
                  {showPassword ? 'ocultar' : 'mostrar'}
                </button>
              </div>
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 bg-[#FDE8E8] border border-[#F87171] rounded-[10px] text-[13px] text-[#991B1B] flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[54px] mt-1 bg-[#171512] hover:bg-[#2A2926] active:scale-[0.99] text-white rounded-[12px] shadow-[0px_14px_26px_rgba(23,21,18,0.13)] flex items-center justify-center gap-2.5 cursor-pointer transition-all border-none font-normal text-[15px] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Entrando...' : 'Entrar'}</span>
              <IconArrowRight />
            </button>
          </form>

          {/* Divisor */}
          <div className="w-full flex items-center gap-3.5 my-1">
            <div className="flex-1 h-[1px] bg-[#DED6CA]" />
            <span className="text-[12px] font-bold text-[#8A8177]">OU</span>
            <div className="flex-1 h-[1px] bg-[#DED6CA]" />
          </div>

          {/* Link Cadastro */}
          <div className="w-full flex justify-center items-center gap-1.5 text-[14px]">
            <span className="text-[#8A8177]">Ainda não tem uma conta?</span>
            <Link
              to="/cadastro"
              className="text-[#071915] font-semibold hover:underline no-underline"
            >
              Cadastre sua arena
            </Link>
          </div>
        </div>

        {/* Selo de Segurança */}
        <div className="mt-8 lg:mt-0 lg:absolute lg:right-10 lg:bottom-10 h-[42px] px-3 flex items-center gap-2 bg-[#FFFFFFAA] backdrop-blur-sm rounded-[14px] outline outline-1 outline-[#E4DBCF] -outline-offset-[0.5px]">
          <IconShield />
          <span className="text-[13px] text-[#071915] font-normal">Acesso seguro</span>
        </div>
      </div>
    </div>
  );
}
