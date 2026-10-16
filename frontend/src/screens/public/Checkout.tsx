import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { safeStorage } from '../../utils/safeStorage';
import { errorMessage } from '../../utils/errorMessage';

const DEFAULT_PLANOS = [
  { id: 1, nome: 'Basic', max_quadras: 3, max_usuarios: 3, valor_mensal: 49.99 },
  { id: 2, nome: 'Pro', max_quadras: 10, max_usuarios: 10, valor_mensal: 79.99 },
  { id: 3, nome: 'Enterprise', max_quadras: 999, max_usuarios: 999, valor_mensal: 0 }
];

const formatPhoneNumber = (val: string) => {
  const digits = val.replace(/\D/g, '');
  let formatted = digits;
  if (digits.length > 0) {
    formatted = '(' + digits.substring(0, 2);
    if (digits.length > 2) {
      formatted += ') ' + digits.substring(2, 7);
    }
    if (digits.length > 7) {
      formatted += '-' + digits.substring(7, 11);
    }
  }
  return formatted;
};

const validateCheckoutForm = (formData: Record<string, string>) => {
  const newErrors: Record<string, boolean> = {};
  let hasError = false;
  let errorMsg = '';

  Object.keys(formData).forEach((key) => {
    if (key !== 'plano' && !formData[key].trim()) {
      newErrors[key] = true;
      hasError = true;
    }
  });

  if (!hasError && formData.resp_nome.trim().split(/\s+/).length < 2) {
    newErrors.resp_nome = true;
    hasError = true;
    errorMsg = 'Por favor, informe seu nome completo (nome e sobrenome).';
  } else if (!hasError && formData.resp_senha.length < 8) {
    newErrors.resp_senha = true;
    hasError = true;
    errorMsg = 'A senha deve conter no mínimo 8 caracteres.';
  } else if (hasError) {
    errorMsg = 'Preencha todos os campos obrigatórios.';
  }

  return { isValid: !hasError, errors: newErrors, errorMsg };
};

const performRegistrationAndLogin = async (
  formData: Record<string, string>,
  navigate: (path: string) => void
) => {
  const response = await fetch('/api/auth/register', {
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

  if (!response.ok) {
    throw new Error(data.error || 'Erro ao criar conta. Verifique os dados.');
  }

  const loginResponse = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: formData.resp_email, senha: formData.resp_senha })
  });

  if (loginResponse.ok) {
    const loginData = await loginResponse.json();
    safeStorage.setItem('courtmanager_user', JSON.stringify(loginData.usuario));
    if (loginData.usuario.arena_nome) {
      safeStorage.setItem('arena_nome', loginData.usuario.arena_nome);
    }
    if (loginData.usuario.arena_slug) {
      safeStorage.setItem('arena_slug', loginData.usuario.arena_slug);
    }
    navigate('/admin/dashboard');
  } else {
    navigate('/login');
  }
};

// Ícones SVG exportados do pen.dev
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

const IconBuilding = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.35449 1.20313q-0.43408 0.07178-0.77929 0.35205-0.3418 0.28027-0.50928 0.66992l-0.02735 0.04443q-0.05811 0.15381-0.07177 0.22217-0.02734 0.11279-0.02735 0.36572l-0.01367 2.39258-0.34863 0q-0.33838 0-0.47852 0.01367-0.4751 0.07178-0.85449 0.37256-0.37598 0.30078-0.55713 0.76221l-0.01367 0.02734q-0.04443 0.14014-0.05811 0.23926-0.01367 0.15381-0.02734 0.57422l0 1.67822q-0.01367 2.17041 0.01367 2.33789 0.02734 0.30762 0.16748 0.60156 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863l0.15381 0.05469 9.9668 0 0.15381-0.05469q0.36572-0.11279 0.65283-0.34863 0.28711-0.23926 0.44092-0.56397 0.14014-0.28027 0.18115-0.60156 0.01367-0.16748 0-3.20605l0-2.37891q0-0.54688-0.02734-0.72803-0.01367-0.12646-0.05811-0.25293l-0.02734-0.04101q-0.14014-0.37939-0.44092-0.66651-0.30078-0.28711-0.67676-0.39648-0.15723-0.05811-0.31787-0.07178-0.16065-0.01367-0.44092-0.01367l-0.34863 0 0-0.44775q0-0.29395-0.01367-0.38965-0.01367-0.09912-0.02735-0.18457-0.23926-0.81348-0.96728-1.14844-0.15381-0.06836-0.29395-0.11279l-0.14013-0.04102-2.57715 0q-2.5874 0-2.7002 0.02734z m5.20899 1.17578q0.2085 0.09912 0.30761 0.30761l0.04102 0.09912 0.01367 8.89014-1.17578 0 0-0.67334q0-0.55713-0.02051-0.74512-0.02051-0.19141-0.10595-0.3999-0.18115-0.43408-0.54004-0.72119-0.35547-0.28711-0.8169-0.35889-0.2666-0.04102-0.5332 0-0.46143 0.07178-0.82031 0.35889-0.35547 0.28711-0.53663 0.72119-0.08545 0.2085-0.10595 0.3999-0.02051 0.18799-0.02051 0.74512l0 0.67334-1.17578 0 0.01367-8.89014 0.04102-0.09912q0.07178-0.14014 0.18798-0.229 0.11963-0.09229 0.25977-0.11963 0.08545 0 2.47803 0l2.40967 0 0.09912 0.04102z m-3.83838 1.72265q-0.18115 0.02734-0.32129 0.18115-0.14014 0.15381-0.15381 0.35206 0 0.14014 0.06152 0.28027 0.06494 0.14014 0.19141 0.22217l0.01367 0.01367q0.06836 0.05811 0.15039 0.07178 0.08545 0.01367 0.35205 0.02734l1.96192 0q0.2666-0.01367 0.34863-0.02734 0.08545-0.01367 0.15381-0.07178l0.01367-0.01367q0.21191-0.14014 0.24609-0.36914 0.03418-0.23242-0.09912-0.43409-0.1333-0.20508-0.38281-0.23242-0.11279-0.02734-1.2749-0.02734-1.16211 0-1.26123 0.02734z m6.1455 0.60156q0.21192 0.08545 0.32471 0.29395l0.04102 0.09912 0 6.13184-0.04102 0.09912q-0.04443 0.08203-0.11621 0.16064-0.06836 0.0752-0.13672 0.11963-0.14014 0.06836-0.57422 0.06836l-0.29394 0 0-7 0.34863 0q0.23926 0 0.30762 0.00684 0.07178 0.00684 0.14013 0.0205z m-8.94482 4.34083l0 2.63183-0.29394 0q-0.43408 0-0.57422-0.06836-0.06836-0.04443-0.14014-0.11963-0.06836-0.07861-0.11279-0.16064l-0.04102-0.09912 0-4.38184 0.04102-0.09912q0.04443-0.08203 0.1333-0.16406 0.09229-0.08545 0.1914-0.12989 0.05469-0.01367 0.12989-0.0205 0.07861-0.00684 0.3042-0.00684l0.3623 0 0 2.61817z m2.70361-2.59083q-0.09912 0.04443-0.1914 0.12989-0.08887 0.08203-0.12647 0.16064-0.03418 0.0752-0.04101 0.11621-0.00684 0.04102-0.00684 0.14014 0 0.15381 0.04102 0.25293 0.11279 0.2085 0.3247 0.29394 0.06836 0.02734 0.24952 0.02735l1.12109 0 1.12109 0q0.18115 0 0.24952-0.02735 0.21191-0.08545 0.3247-0.29394 0.04102-0.09912 0.04102-0.25293 0-0.09912-0.00684-0.14014-0.00684-0.04102-0.03418-0.11279-0.04443-0.08203-0.13672-0.16406-0.08887-0.08545-0.17431-0.11963-0.08203-0.0376-0.26319-0.0376l-1.12109 0-1.12109 0q-0.19482 0.01367-0.24952 0.02734z m1.62354 3.52735q0.18115 0.08545 0.2666 0.2666l0.05469 0.08545 0 1.34326-1.14844 0 0-1.34326 0.05469-0.08545q0.11279-0.22217 0.36572-0.30762 0.04102-0.01367 0.18115-0.00683 0.14014 0.00684 0.22559 0.04785z"
      fill="#A39A90"
    />
  </svg>
);

const IconMapPin = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.71973 0.60156q-0.81006 0.02734-1.56885 0.31446-0.75537 0.28711-1.41162 0.80664-0.19824 0.15381-0.48535 0.44775-0.28711 0.29395-0.44092 0.48877-0.42041 0.57422-0.67334 1.17578-0.24951 0.60156-0.34863 1.31592-0.04102 0.23926-0.03418 0.68017 0.00684 0.44092 0.03418 0.69385 0.14014 0.88184 0.56054 1.79102 0.50586 1.07666 1.44922 2.27637 0.94678 1.19629 2.19092 2.31738 0.22559 0.19482 0.32129 0.27343 0.09912 0.0752 0.19824 0.11622 0.22217 0.11279 0.48877 0.11279 0.2666 0 0.48877-0.11279 0.11279-0.04101 0.19482-0.10254 0.08545-0.06494 0.31104-0.25977 0.96387-0.86816 1.79101-1.83203 0.82715-0.96728 1.37403-1.86621 0.75537-1.27148 0.98437-2.42676 0.23242-1.15527-0.06152-2.29004-0.35205-1.35693-1.35693-2.36523-0.36572-0.37939-0.74512-0.64258-0.37598-0.2666-0.8374-0.46484-1.12109-0.51611-2.42334-0.44776z m0.88183 1.18946q0.67334 0.09912 1.28174 0.42041 0.6084 0.32129 1.0835 0.82714 0.68701 0.71436 0.95361 1.66114 0.2666 0.94336 0.08203 1.90722-0.34863 1.72266-2.26611 3.92041-0.32129 0.36572-1.00147 1.03907-0.68018 0.66992-0.73486 0.66992-0.05469 0-0.73486-0.66992-0.68018-0.67334-1.00147-1.03907-1.79102-2.05762-2.21142-3.70849-0.08545-0.32129-0.1128-0.69385-0.02734-0.37256 0-0.69385 0.07178-0.66992 0.34864-1.29199 0.28027-0.62549 0.75879-1.11426 0.51611-0.54688 1.20312-0.875 0.68701-0.33154 1.44238-0.38623 0.12646-0.01367 0.44776 0 0.32129 0.01367 0.46142 0.02735z m-0.85449 1.72265q-0.7417 0.08545-1.28857 0.57422-0.5708 0.50244-0.7417 1.26123-0.04102 0.15381-0.04102 0.42041 0 0.26318 0.02734 0.43408 0.11279 0.72803 0.63233 1.25782 0.44775 0.46143 1.06299 0.62548 0.61523 0.16064 1.22363-0.00683 0.6084-0.1709 1.05957-0.63233 0.50244-0.5332 0.62891-1.24414 0.01367-0.1709 0.01367-0.43408 0-0.2666-0.04102-0.40674-0.1709-0.77246-0.7417-1.2749-0.46484-0.40674-1.0664-0.5332-0.15381-0.02734-0.3794-0.04102-0.22217-0.01367-0.34863 0z m0.51953 1.18946q0.29395 0.05811 0.54688 0.30761 0.18115 0.18457 0.26318 0.37256 0.08545 0.18799 0.08545 0.44092 0 0.5332-0.39307 0.88183-0.32129 0.29395-0.76904 0.29395-0.44775 0-0.76904-0.29395-0.44775-0.40674-0.3794-1.0083 0.01367-0.2085 0.09571-0.36914 0.08545-0.16406 0.25293-0.33154 0.1709-0.16748 0.35205-0.24268 0.18115-0.07861 0.43408-0.07861 0.16748 0 0.28027 0.02735z"
      fill="#A39A90"
    />
  </svg>
);

const IconGrid = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.03027 1.20313q-0.22559 0.07178-0.42724 0.23242-0.20166 0.16064-0.30078 0.36914l-0.02735 0.03076q-0.05811 0.12305-0.07177 0.2085-0.02734 0.12646-0.02735 0.44775l0 1.04932 0 1.66796q0 0.24951 0.02735 0.34864 0.07178 0.28027 0.32128 0.51953 0.11279 0.10938 0.22559 0.18115 0.11279 0.06836 0.2666 0.11279l0.12647 0.04102 3.06591 0q0.24951-0.01367 0.33497-0.02734 0.30762-0.08545 0.52978-0.30762 0.22559-0.22559 0.31104-0.5332 0.01367-0.08545 0.02734-0.33497l0-3.06591-0.04102-0.12647q-0.04443-0.16748-0.11621-0.27344-0.06836-0.10596-0.1914-0.23242-0.15381-0.15381-0.29395-0.22217l-0.01709-0.01367q-0.12305-0.05811-0.22217-0.07178-0.12646-0.02734-0.47509-0.02734l-1.14844 0-1.52783 0q-0.24951 0.01367-0.34864 0.02734z m6.43946-0.00001q-0.28027 0.05811-0.53321 0.30762-0.12305 0.12646-0.19482 0.23242-0.06836 0.10596-0.11279 0.27344l-0.04102 0.12647 0 3.06591q0.01367 0.2666 0.02734 0.33497 0.08545 0.30762 0.30762 0.5332 0.22559 0.22217 0.5332 0.30762 0.06836 0.01367 0.33497 0.02734l3.06591 0 0.12647-0.04102q0.16748-0.04443 0.27344-0.11279 0.10596-0.07178 0.23242-0.19482 0.23584-0.23926 0.30761-0.53321 0.02734-0.12646 0.03418-1.74316 0.00684-1.6167-0.03418-1.72949-0.07178-0.30762-0.30419-0.53662-0.229-0.23242-0.53663-0.31788-0.09912-0.02734-0.33496-0.02734l-1.41504 0q-1.62354 0-1.73632 0.02734z m-3.21973 2.59083l0 1.45605-2.92578 0 0-2.92578 2.92578 0 0 1.46973z m6.42578 0l0 1.45605-2.92578 0 0-2.92578 2.92578 0 0 1.46973z m-9.47803 3.79394q-0.39307 0.04102-0.68701 0.34863-0.23584 0.22559-0.30761 0.50586-0.02734 0.09912-0.02735 0.34864l0 1.41503 0 1.30225q0 0.32129 0.02735 0.44775 0.01367 0.08545 0.07177 0.2085l0.02735 0.03076q0.09912 0.22217 0.30761 0.38281 0.2085 0.16065 0.44776 0.21875 0.11279 0.04102 1.72949 0.03418 1.6167-0.00684 1.74316-0.03418 0.29395-0.07178 0.53321-0.30761 0.12305-0.12646 0.1914-0.23242 0.07178-0.10596 0.11621-0.27344l0.04102-0.12647 0-3.06591q-0.01367-0.24951-0.02734-0.33497-0.08545-0.30762-0.31788-0.52978-0.229-0.22559-0.52294-0.31104-0.06836-0.01367-0.34864-0.02734l-1.31592 0q-1.55518-0.01367-1.68164 0z m6.42579 0q-0.22217 0.02734-0.37598 0.11279-0.23926 0.11279-0.3999 0.30762-0.16064 0.19482-0.23243 0.44775-0.01367 0.06836-0.02734 0.33497l0 3.06591 0.04102 0.12647q0.04443 0.16748 0.11279 0.27344 0.07178 0.10596 0.19482 0.23242 0.23926 0.23584 0.53321 0.30761 0.12646 0.02734 1.74316 0.03418 1.6167 0.00684 1.72949-0.03418 0.23926-0.0581 0.44776-0.21875 0.2085-0.16065 0.30761-0.38281l0.02735-0.03076q0.05811-0.12305 0.07178-0.2085 0.02734-0.12646 0.02734-0.44775l0-2.59082q0-0.33496-0.02734-0.46143-0.01367-0.08545-0.07178-0.20849l-0.01367-0.03076q-0.06836-0.12646-0.22217-0.28028-0.15381-0.15381-0.29395-0.22216l-0.03076-0.01368q-0.12305-0.07178-0.2085-0.08545-0.11279-0.01367-0.4204-0.02734l-1.23047 0q-1.56885 0-1.68164 0.01367l0-0.01367z m-3.37354 2.61816l0 1.46973-2.92578 0 0-2.92578 2.92578 0 0 1.45605z m6.42578 0l0 1.46973-2.92578 0 0-2.92578 2.92578 0 0 1.45605z"
      fill="#A39A90"
    />
  </svg>
);

const IconChevronDown = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.34619 4.68945q-0.25293 0.08545-0.37939 0.30762-0.04102 0.08545-0.04102 0.25293 0 0.16748 0.04785 0.25977 0.05127 0.08887 1.8628 1.9038 1.81494 1.81152 1.9038 1.8628 0.09229 0.04785 0.25977 0.04785 0.16748 0 0.25635-0.04785 0.09229-0.05127 1.90381-1.8628 1.81494-1.81494 1.86279-1.9038 0.05127-0.09229 0.05127-0.25977 0-0.16748-0.04102-0.25293-0.09912-0.16748-0.28027-0.2666-0.05811-0.02734-0.09912-0.04102-0.04102-0.01367-0.15381-0.01367-0.11279 0-0.15381 0.01367-0.04101 0.01367-0.11279 0.04102-0.09912 0.05811-1.66455 1.62695l-1.56885 1.56543-2.82666-2.81299q-0.31104-0.29395-0.42041-0.37939-0.08545-0.05469-0.19824-0.05469l-0.02735 0q-0.14014 0-0.18115 0.01367z"
      fill="#A39A90"
    />
  </svg>
);

const IconUser = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.59326 1.20313q-0.81006 0.11279-1.42871 0.61865-0.61523 0.50244-0.89551 1.24414-0.18115 0.48877-0.18115 1.02197 0 0.28027 0.04102 0.50586 0.04443 0.22217 0.14013 0.48877 0.15381 0.46143 0.46826 0.84766 0.31787 0.38281 0.7212 0.63574 0.36572 0.22559 0.73486 0.32471 0.37256 0.0957 0.80664 0.0957 0.22559 0 0.3623-0.01367 0.14014-0.01367 0.35206-0.05811 0.60156-0.15381 1.104-0.55713 0.50586-0.40674 0.7998-0.98096 0.19482-0.39307 0.26661-0.88183 0.02734-0.14014 0.02734-0.40674 0-0.2666-0.02734-0.40674-0.09912-0.65625-0.46485-1.20312-0.3623-0.54688-0.93652-0.89551-0.43408-0.2666-0.98096-0.36572-0.15381-0.02734-0.45459-0.03418-0.30078-0.00684-0.45459 0.02051z m0.60156 1.14843q0.40674 0.02734 0.78272 0.28711 0.37939 0.25977 0.58105 0.65967 0.20508 0.39648 0.18457 0.88184-0.02051 0.48193-0.28711 0.86132-0.15381 0.23584-0.37939 0.41358-0.22217 0.17432-0.46143 0.27002-0.19482 0.05811-0.2871 0.07861-0.08887 0.02051-0.32813 0.02051-0.23926 0-0.33154-0.02051-0.08887-0.02051-0.28369-0.07861-0.39307-0.14014-0.68018-0.46826-0.28711-0.32813-0.3999-0.73487-0.10938-0.46143 0.01367-0.90918 0.12646-0.44775 0.45459-0.76904 0.33154-0.32471 0.79297-0.45117 0.08545-0.02734 0.24609-0.04785 0.16064-0.02051 0.21533-0.00684l0.16748 0.01367z m-2.35156 5.85156q-0.96387 0.14014-1.65088 0.82715-0.54688 0.54688-0.75537 1.31592-0.07178 0.23926-0.08545 0.44092-0.01367 0.20166-0.01367 0.82031l0 0.76904 0.04102 0.1128q0.05811 0.0957 0.14013 0.18115 0.21191 0.19482 0.50586 0.14697 0.29395-0.04785 0.42041-0.31445l0.04102-0.09912 0.01367-0.79639q0.01367-0.61865 0.02734-0.77246 0.01367-0.15381 0.07178-0.34863 0.14014-0.37939 0.46826-0.68018 0.32813-0.30078 0.73487-0.41357 0.15381-0.04102 0.53662-0.05469 0.38623-0.01367 1.66113-0.01367 1.2749 0 1.65771 0.01367 0.38623 0.01367 0.54004 0.05469 0.42041 0.11279 0.75538 0.43066 0.33838 0.31445 0.46142 0.71778 0.05811 0.16748 0.06494 0.3247 0.00684 0.15381 0.02051 0.7417l0.01367 0.79639 0.04102 0.09912q0.12646 0.2666 0.42041 0.31445 0.29395 0.04785 0.50586-0.14697 0.08203-0.08545 0.14013-0.18115l0.04102-0.1128 0-0.76904q0-0.61865-0.01367-0.82031-0.01367-0.20166-0.08545-0.44092-0.08203-0.32129-0.23584-0.61523-0.2666-0.51953-0.73828-0.90235-0.46826-0.38623-1.02539-0.54004l-0.04444-0.01367q-0.16748-0.05811-0.29394-0.07178-0.15381-0.01367-0.56055-0.01367l-1.60986-0.01367q-2.05762 0-2.21143 0.02734z"
      fill="#A39A90"
    />
  </svg>
);

const IconMail = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 3.17871 0 3.17871q0.01367 0.56055 0.02734 0.66992 0.11279 0.5332 0.50245 0.90577 0.39307 0.36914 0.92627 0.46826 0.16748 0.02734 4.95605 0.02734 4.78857 0 4.95605-0.02734 0.5332-0.09912 0.92286-0.46826 0.39307-0.37256 0.50586-0.90577 0.01367-0.10938 0.02734-0.66992l0-3.17871 0-3.17871q-0.01367-0.56055-0.02734-0.66992-0.12647-0.54688-0.53321-0.92285-0.40674-0.37939-0.95019-0.46485-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.46436 1.58252q-2.46436 1.56543-2.53613 1.60303-0.06836 0.03418-0.16748 0.03418l-0.02734 0.01367q-0.0957 0.01367-0.2085-0.04102-0.15381-0.07178-0.65967-0.37939l-4.40918-2.81299 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m-5.63964 5.02783q0.22217 0.10938 0.46142 0.15381 0.09912 0.02734 0.30762 0.02734 0.2085 0 0.30762-0.02734 0.30762-0.05811 0.54687-0.19825 0.14014-0.08203 2.26612-1.42529l2.12939-1.36035-0.01367 5.50293-0.04102 0.09912q-0.11279 0.2085-0.3247 0.29395l-0.09571 0.02734-9.5498 0-0.09571-0.02734q-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.50293 2.17041 1.37402q2.17041 1.38428 2.31055 1.45606z"
      fill="#A39A90"
    />
  </svg>
);

const IconPhone = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.15674 0.60156q-0.29395 0.02734-0.58789 0.16748-0.29395 0.14014-0.50586 0.36573-0.30762 0.32129-0.43408 0.78271-0.02734 0.12646-0.03418 0.21191-0.00684 0.08203-0.00684 0.36231 0.01367 1.65088 0.53662 3.26074 0.52637 1.60986 1.49365 2.98389 0.5332 0.7417 1.2168 1.42871 0.68701 0.68359 1.42871 1.2168 1.37402 0.96729 2.99072 1.49365 1.6167 0.52295 3.25391 0.53662 0.28027 0 0.3623-0.00684 0.08545-0.00683 0.21192-0.03418 0.25293-0.07178 0.44092-0.18115 0.18799-0.11279 0.36914-0.29394 0.18457-0.18457 0.29394-0.37256 0.11279-0.18799 0.18457-0.44092l0.04102-0.16748 0-1.0083q0.01367-0.67334 0-0.92627-0.01367-0.30762-0.05127-0.46826-0.03418-0.16064-0.11621-0.35547-0.18115-0.36572-0.50586-0.61524-0.32129-0.25293-0.72803-0.33838-0.10938-0.01367-0.29394-0.02734l-0.92285 0q-0.84082 0-1.0459 0.01367-0.20166 0.01367-0.38282 0.07178-0.28027 0.08203-0.49218 0.25293-0.2085 0.16748-0.417 0.44434l-0.14013 0.17089-0.11279-0.04443q-0.22217-0.10938-0.54688-0.31103-0.32129-0.20508-0.51611-0.35889-1.07666-0.81348-1.80469-1.91748-0.09912-0.15723-0.2666-0.45117-0.16748-0.29395-0.18457-0.32813-0.01367-0.03418 0.15722-0.16064 0.52979-0.39307 0.69727-0.93653 0.07178-0.18457 0.07861-0.3999 0.00684-0.21875 0.00684-1.10058l0-1.10401-0.05469-0.15381q-0.11279-0.36572-0.35205-0.64599-0.23584-0.28027-0.56055-0.44776-0.29395-0.14014-0.6289-0.16748-0.16748-0.02734-1.02881-0.02734-0.86133 0-1.04248 0.02734z m2.17041 1.20313q0.08203 0.04443 0.15722 0.12304 0.07861 0.0752 0.11963 0.16065 0.04443 0.08203 0.05811 0.30078 0.01367 0.21533 0 0.91602l0 0.71435q-0.01367 0.2085-0.03418 0.28027-0.02051 0.06836-0.07861 0.13672l-0.01368 0q-0.05469 0.08545-0.25976 0.23243-0.20166 0.14697-0.29395 0.25292-0.08887 0.10254-0.16064 0.24952-0.06836 0.14697-0.09912 0.25293-0.02734 0.10596-0.02735 0.27343 0 0.19482 0.06836 0.38623 0.07178 0.18799 0.29737 0.56739 1.20313 2.1123 3.30175 3.30175 0.36572 0.21191 0.55372 0.2837 0.19141 0.06836 0.38623 0.06836 0.28027-0.01367 0.5332-0.12647 0.12305-0.07178 0.229-0.16064 0.10596-0.09228 0.2461-0.27344 0.16748-0.22559 0.25293-0.28027l0-0.01368q0.08203-0.05811 0.14355-0.07861 0.06494-0.02051 0.27344-0.03418l0.72803 0q0.72803-0.01367 0.93652 0 0.21191 0.01367 0.29736 0.07178 0.16748 0.0957 0.25293 0.26318l0.04102 0.09912 0 1.02198q0 0.7417 0 0.88867 0 0.14697-0.02735 0.20508-0.12646 0.26318-0.37939 0.33496-0.15381 0.05469-0.74854 0.01367-0.59473-0.04102-1.1416-0.14014-0.96387-0.16748-1.90381-0.53662-0.93652-0.37256-1.75-0.89209-1.37061-0.89551-2.38574-2.16699-1.01514-1.2749-1.56885-2.81641-0.55371-1.5415-0.56738-3.13769 0-0.26318 0-0.31787 0-0.05811 0.04102-0.12989 0.08545-0.18115 0.22558-0.24951 0.08203-0.05811 0.16065-0.07178 0.07861-0.01367 0.30078-0.02734l1.73633 0.01367 0.09912 0.04102z"
      fill="#A39A90"
    />
  </svg>
);

const IconLock = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[15px] h-[15px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.77441 0.60156q-0.72803 0.02734-1.38769 0.3794-0.65625 0.34863-1.12451 0.92285-0.46826 0.57422-0.64942 1.28857-0.07178 0.29395-0.08545 0.46143-0.01367 0.16748-0.02734 0.7998l0 0.79639-0.42041 0q-0.43408 0.01367-0.57422 0.05469-0.50244 0.12646-0.85449 0.49218-0.34863 0.3623-0.44775 0.88184-0.02734 0.0957-0.02735 0.52979l0 4.7749 0.05469 0.15381q0.15723 0.51953 0.56055 0.86133 0.40674 0.3418 0.93994 0.3999 0.14014 0.02734 4.26904 0.02734 4.12891 0 4.26904-0.02734 0.30762-0.02734 0.58789-0.16748 0.32471-0.15381 0.56055-0.44092 0.23926-0.28711 0.35205-0.65283l0.05469-0.15381 0-4.7749q0-0.43408-0.02735-0.52979-0.09912-0.51953-0.45117-0.88183-0.34863-0.36572-0.85107-0.49219-0.14014-0.04102-0.57422-0.05469l-0.42041 0 0-0.79639q-0.01367-0.63232-0.02734-0.7998-0.01367-0.16748-0.08545-0.46143-0.18115-0.71436-0.66651-1.30224-0.48193-0.58789-1.15185-0.93653-0.82715-0.40674-1.79444-0.35205z m0.70069 1.20313q0.75537 0.15381 1.2749 0.7417 0.3623 0.40674 0.50244 0.92627 0.04443 0.19482 0.05811 0.37939 0.01367 0.18115 0.01367 0.71094l0 0.68701-4.64844 0 0-0.75537q0-0.61523 0.02051-0.76904 0.02051-0.15723 0.09228-0.3794 0.22217-0.64258 0.74854-1.06982 0.52637-0.42725 1.19629-0.5127 0.14014-0.01367 0.3623 0 0.22559 0.01367 0.3794 0.04102z m3.79394 4.64844q0.12646 0.04443 0.23243 0.15039 0.10596 0.10254 0.14697 0.229 0.01367 0.06836 0.01367 2.50537l0 2.09863q-0.01367 0.3794-0.02734 0.42041-0.09912 0.25293-0.35205 0.35205l-0.09571 0.04102-8.37402 0-0.0957-0.04102q-0.11279-0.04443-0.16407-0.08544-0.04785-0.04101-0.11279-0.12989-0.06152-0.09229-0.08203-0.16064-0.02051-0.07178-0.02051-2.49512 0-2.42334 0.01367-2.50537 0.04102-0.12646 0.14014-0.22217 0.09912-0.09912 0.22559-0.15722 0.05469-0.01367 0.69726-0.02735l3.57178 0 3.51367 0q0.71435 0 0.76904 0.02735z m-4.54931 1.75q-0.28027 0.05811-0.53321 0.30761-0.19482 0.19824-0.27343 0.38623-0.0752 0.18799-0.0752 0.44092 0 0.36572 0.18115 0.62891 0.23926 0.35205 0.6084 0.47851 0.37256 0.12305 0.7417 0 0.37256-0.12646 0.61182-0.47851 0.18115-0.26318 0.18115-0.62891 0-0.25293-0.07861-0.44092-0.0752-0.18799-0.27002-0.38623-0.25293-0.24951-0.54688-0.30761-0.11279-0.02734-0.27344-0.02735-0.16064 0-0.27343 0.02735z"
      fill="#A39A90"
    />
  </svg>
);

const IconEye = ({ open }: { open: boolean }) => (
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
);

const IconArrowRight = () => (
  <svg
    viewBox="0 0 14 14"
    className="w-[16px] h-[16px] shrink-0"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.90088 2.35156q-0.18115 0.02734-0.32129 0.16748-0.11279 0.11279-0.14697 0.28028-0.03418 0.16748 0.02051 0.32129 0.02734 0.08545 0.25976 0.3247 0.23242 0.23584 1.36377 1.37061 1.58252 1.58252 1.58252 1.59619 0 0.01367-3.45557 0.01367l-3.44531 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.53321 0.03418l3.01123 0q3.42822 0 3.42822 0.01367 0 0.01367-1.58252 1.59619-1.13135 1.13477-1.36377 1.37402-0.23242 0.23584-0.25976 0.3213-0.05469 0.15381-0.02051 0.32128 0.03418 0.16748 0.14697 0.28028 0.18115 0.18115 0.42041 0.18115l0.04102 0q0.11279 0 0.19824-0.05469 0.14014-0.09912 0.51611-0.46484l1.68164-1.67822q2.1123-2.10205 2.15332-2.18409 0.07178-0.12646 0.07178-0.28027 0-0.15381-0.07178-0.28027-0.04102-0.08203-2.1499-2.18067-2.10547-2.10205-2.17725-2.13623-0.06836-0.0376-0.23584-0.06494-0.04102 0-0.12646 0.01367z"
      fill="#C9FF3B"
    />
  </svg>
);

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

  const [planosPublicos, setPlanosPublicos] = useState(DEFAULT_PLANOS);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planoParam = params.get('plano');

    fetch('/api/auth/planos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlanosPublicos(data);
          if (planoParam && data.some(p => String(p.id) === planoParam || p.nome.toLowerCase() === planoParam.toLowerCase())) {
            const found = data.find(p => String(p.id) === planoParam || p.nome.toLowerCase() === planoParam.toLowerCase());
            setFormData(prev => ({ ...prev, plano: String(found ? found.id : planoParam) }));
          } else {
            const pro = data.find(p => p.nome.toLowerCase() === 'pro');
            setFormData(prev => ({ ...prev, plano: String(pro ? pro.id : data[0].id) }));
          }
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
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, resp_telefone: formatted }));
    if (errors.resp_telefone) {
      setErrors(prev => ({ ...prev, resp_telefone: false }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validation = validateCheckoutForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setErrorMsg(validation.errorMsg);
      return;
    }

    setIsSubmitting(true);

    try {
      await performRegistrationAndLogin(formData, navigate);
    } catch (err) {
      setErrorMsg(errorMessage(err) || 'Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F2EA]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* PAINEL ESCURO (ESQUERDA) */}
      <div className="w-full lg:w-[48%] xl:w-[46%] bg-[#171512] relative overflow-hidden lg:overflow-y-auto flex flex-col justify-between p-8 sm:p-10 lg:px-10 lg:py-[clamp(20px,4vh,48px)] xl:px-12 min-h-[640px] lg:min-h-0 lg:h-screen lg:sticky lg:top-0 lg:self-start shrink-0">
        {/* Glow Verde */}
        <div
          className="absolute -right-20 top-20 w-[420px] h-[360px] rounded-full pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(201, 255, 59, 0.18) 0%, rgba(201, 255, 59, 0) 100%)',
            backgroundSize: '100% 100%',
          }}
        />

        {/* Glow Azul */}
        <div
          className="absolute -left-20 bottom-28 w-[420px] h-[230px] rounded-full pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(67, 183, 255, 0.14) 0%, rgba(67, 183, 255, 0) 100%)',
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

        {/* Conteúdo Central: Headline e Benefícios */}
        <div className="relative z-10 flex flex-col my-auto py-4 max-w-[620px]" style={{ gap: 'clamp(12px, 2.6vh, 24px)' }}>
          <h1
            className="leading-[1.05] text-white font-normal tracking-[-2px]"
            style={{ fontSize: 'clamp(32px, min(6vh, 4vw), 54px)' }}
          >
            Sua arena, organizada de verdade.
          </h1>

          <div className="flex flex-col pt-1" style={{ gap: 'clamp(10px, 2vh, 16px)' }}>
            {[
              'Grade de reservas visual, sem conflitos de horário',
              'Controle financeiro completo — pago, parcial e pendente',
              'Gestão de clientes e histórico de reservas',
              'Relatórios de faturamento e ocupação por quadra',
              '14 dias gratuitos — sem cartão de crédito'
            ].map((text) => (
              <div key={text} className="flex items-center gap-3.5">
                <div className="w-6 h-6 shrink-0 flex items-center justify-center bg-[#2D2B27] rounded-[12px] outline outline-1 outline-[#4F4D47] -outline-offset-[0.5px]">
                  <IconCheck />
                </div>
                <span className="text-[15px] sm:text-[16px] text-[#E8E5DE] font-normal leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depoimento Rodapé */}
        <div className="relative z-10 border-t border-white/10 flex flex-col gap-3 max-w-[620px]" style={{ paddingTop: 'clamp(12px, 2.4vh, 20px)' }}>
          <p className="text-[15px] leading-[23px] text-[#C9C5BA] italic">
            “Antes eu controlava tudo no WhatsApp e numa planilha. Com o CourtManager, em 30 minutos já tinha tudo configurado e as reservas começaram a entrar sozinhas.”
          </p>
          <div className="text-[14px] text-[#A9A49A] font-normal">
            — Rodrigo F., Arena Beach Sports, Campinas
          </div>
        </div>
      </div>

      {/* ÁREA FORMULÁRIO (DIREITA) */}
      <div className="w-full lg:w-[52%] xl:w-[54%] bg-[#F7F2EA] flex flex-col justify-center items-center p-6 sm:p-8 lg:p-10 py-10 relative min-h-screen">
        <div className="w-full max-w-[510px] flex flex-col gap-2.5">
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
          <div className="flex flex-col gap-1.5 mb-1">
            <h2 className="text-[27px] leading-tight text-[#071915] font-normal tracking-[-0.6px]">
              Criar conta da Arena
            </h2>
            <p className="text-[13px] leading-[16px] text-[#8A8177] font-normal">
              Preencha os dados da arena e do responsável. Em 2 minutos você acessa o sistema.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 w-full">
            {/* SEÇÃO DADOS DA ARENA */}
            <div className="border-t border-[#E3DACE] pt-2 flex flex-col gap-2">
              <span className="text-[12px] font-extrabold text-[#071915]">Dados da Arena</span>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="arena_nome" className="text-[12px] font-extrabold text-[#071915]">
                  Nome da arena *
                </label>
                <div
                  className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                    errors.arena_nome ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                  } -outline-offset-[0.5px] transition-all`}
                >
                  <IconBuilding />
                  <input
                    id="arena_nome"
                    name="arena_nome"
                    type="text"
                    value={formData.arena_nome}
                    onChange={handleChange}
                    placeholder="Ex: Arena Beach Prime"
                    className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Cidade + Quadras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="arena_cidade" className="text-[12px] font-extrabold text-[#071915]">
                    Cidade *
                  </label>
                  <div
                    className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                      errors.arena_cidade ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                    } -outline-offset-[0.5px] transition-all`}
                  >
                    <IconMapPin />
                    <input
                      id="arena_cidade"
                      name="arena_cidade"
                      type="text"
                      value={formData.arena_cidade}
                      onChange={handleChange}
                      placeholder="Ex: Campinas"
                      className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                      required
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="arena_quadras" className="text-[12px] font-extrabold text-[#071915]">
                    Nº de quadras *
                  </label>
                  <div
                    className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                      errors.arena_quadras ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                    } -outline-offset-[0.5px] relative transition-all`}
                  >
                    <IconGrid />
                    <select
                      id="arena_quadras"
                      name="arena_quadras"
                      value={formData.arena_quadras}
                      onChange={handleChange}
                      style={{ backgroundImage: 'none' }}
                      className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] pr-6 cursor-pointer appearance-none [background-image:none]"
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="1">1 quadra</option>
                      <option value="2">2 quadras</option>
                      <option value="3">3 quadras</option>
                      <option value="4-6">4 a 6 quadras</option>
                      <option value="7-10">7 a 10 quadras</option>
                      <option value="10+">Mais de 10</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 flex items-center">
                      <IconChevronDown />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO RESPONSÁVEL */}
            <div className="border-t border-[#E3DACE] pt-2 flex flex-col gap-2">
              <span className="text-[12px] font-extrabold text-[#071915]">Responsável</span>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="resp_nome" className="text-[12px] font-extrabold text-[#071915]">
                  Nome completo *
                </label>
                <div
                  className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                    errors.resp_nome ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                  } -outline-offset-[0.5px] transition-all`}
                >
                  <IconUser />
                  <input
                    id="resp_nome"
                    name="resp_nome"
                    type="text"
                    value={formData.resp_nome}
                    onChange={handleChange}
                    placeholder="Seu nome"
                    className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="resp_email" className="text-[12px] font-extrabold text-[#071915]">
                  E-mail *
                </label>
                <div
                  className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                    errors.resp_email ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                  } -outline-offset-[0.5px] transition-all`}
                >
                  <IconMail />
                  <input
                    id="resp_email"
                    name="resp_email"
                    type="email"
                    value={formData.resp_email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                    required
                    maxLength={255}
                  />
                </div>
              </div>

              {/* Telefone + Senha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resp_telefone" className="text-[12px] font-extrabold text-[#071915]">
                    Telefone *
                  </label>
                  <div
                    className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                      errors.resp_telefone ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                    } -outline-offset-[0.5px] transition-all`}
                  >
                    <IconPhone />
                    <input
                      id="resp_telefone"
                      name="resp_telefone"
                      type="tel"
                      value={formData.resp_telefone}
                      onChange={handlePhoneChange}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                      required
                      maxLength={15}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resp_senha" className="text-[12px] font-extrabold text-[#071915]">
                    Senha *
                  </label>
                  <div
                    className={`w-full h-[37px] px-3.5 flex items-center gap-2 bg-white rounded-[10px] outline outline-1 ${
                      errors.resp_senha ? 'outline-red-500 bg-red-50/20' : 'outline-[#DCD3C6] focus-within:outline-[#071915]'
                    } -outline-offset-[0.5px] transition-all`}
                  >
                    <IconLock />
                    <input
                      id="resp_senha"
                      name="resp_senha"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.resp_senha}
                      onChange={handleChange}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-transparent border-none outline-none text-[14px] text-[#071915] placeholder-[#A39A90]"
                      required
                      minLength={8}
                      maxLength={128}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="bg-transparent border-none p-0 cursor-pointer text-[#6E86A8] hover:text-[#071915] flex items-center shrink-0"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      <IconEye open={showPassword} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO PLANO */}
            <div className="border-t border-[#E3DACE] pt-2 flex flex-col gap-2">
              <span className="text-[12px] font-extrabold text-[#071915]">Plano</span>

              <div className="flex flex-col gap-2 w-full">
                {planosPublicos.map((p) => {
                  const isSelected = String(formData.plano) === String(p.id) || formData.plano === p.nome.toLowerCase();
                  const priceText = p.valor_mensal > 0
                    ? `R$ ${p.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
                    : 'Sob consulta';

                  return (
                    <div
                      key={p.id}
                      onClick={() => setFormData(prev => ({ ...prev, plano: String(p.id) }))}
                      className={`box-border w-full h-[50px] shrink-0 flex flex-row gap-3 px-4 justify-start items-center rounded-[10px] cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#F1EDE6] outline outline-[1.5px] outline-[#171512] -outline-offset-[0.75px]'
                          : 'bg-white outline outline-1 outline-[#DDD4C8] -outline-offset-[0.5px] hover:outline-[#B6AEA4]'
                      }`}
                    >
                      <div
                        className={`w-[18px] shrink-0 h-[18px] rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#171512] outline outline-[1.5px] outline-[#171512]'
                            : 'bg-white outline outline-[1.5px] outline-[#B6AEA4]'
                        } -outline-offset-[0.75px]`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#F1EDE6]" />}
                      </div>

                      <div className="flex-1 flex flex-col gap-0.5 text-left">
                        <div className="text-[13px] text-[#171512] font-semibold">{p.nome}</div>
                        <div className="text-[11px] text-[#8A8177]">
                          Até {p.max_quadras} {p.max_quadras === 1 ? 'quadra' : 'quadras'} — Até {p.max_usuarios} {p.max_usuarios === 1 ? 'usuário' : 'usuários'}
                        </div>
                      </div>

                      <div className="text-[13px] text-[#171512] font-medium">{priceText}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Termos de Uso */}
            <p className="text-[11px] leading-[14px] text-[#8A8177] m-0">
              Ao criar a conta, você concorda com os Termos de Uso e a Política de Privacidade. Seus dados são protegidos conforme a LGPD.
            </p>

            {/* Mensagem de Erro */}
            {errorMsg && (
              <div className="p-2.5 bg-[#FDE8E8] border border-[#F87171] rounded-[10px] text-[13px] text-[#991B1B] flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botão Criar Conta */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-[#171512] hover:bg-[#2A2926] active:scale-[0.99] shadow-[0px_12px_24px_rgba(23,21,18,0.13)] flex items-center justify-center gap-2.5 rounded-[10px] border-none text-white text-[15px] font-normal cursor-pointer transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-1"
            >
              <span>{isSubmitting ? 'Criando conta...' : 'Criar conta e começar grátis'}</span>
              <IconArrowRight />
            </button>
          </form>

          {/* Link Já Tem Conta */}
          <div className="w-full flex justify-center items-center gap-1 text-[13px] mt-1">
            <span className="text-[#8A8177]">Já tem uma conta?</span>
            <Link to="/login" className="text-[#071915] font-semibold hover:underline no-underline">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
