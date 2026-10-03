import { useCallback, useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { errorMessage } from '../../utils/errorMessage';
import { apiFetch as fetch } from '../../utils/apiFetch';
import { safeStorage } from '../../utils/safeStorage';
import { getStoredUser } from '../../utils/session';
import type { Announcement } from '../../types/api';
import {
  Users,
  CalendarCheck,
  UserPlus,
  Archive,
  Plus,
  Globe,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  Check,
  User,
  Phone,
  Mail,
  Save,
  Pencil,
  Calendar,
  UserCheck,
} from 'lucide-react';

interface Reserva {
  id: number;
  data_reserva: string;
  hora_inicio: string;
  status: string;
  status_pagamento: string;
  quadra_nome: string;
  valor_total?: number;
}

interface Cliente {
  id: number;
  nome: string;
  email: string | null;
  telefone: string;
  ativo: number;
  criado_em: string;
  reservasCount?: number;
  reservas_count?: number;
  saldoDevedor?: number;
  ultima_visita?: string;
  ticket_medio?: number;
}

interface ClienteDetalhe extends Cliente {
  ultimasReservas: Reserva[];
}

interface ClientesKPIs {
  totalAtivos: number;
  comReservas: number;
  novosMes: number;
  arquivados: number;
}

const formatPhone = (val: string) => {
  const clean = val.replace(/\D/g, '');
  if (clean.length === 0) return '';
  if (clean.length <= 2) return `(${clean}`;
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
};

const formatCurrency = (val?: number | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return 'R$ ' + val.toFixed(2).replace('.', ',');
};

const formatDateBR = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  // Pega apenas a porção YYYY-MM-DD ignorando hora, 'T' ou espaço
  const dateOnly = dateStr.trim().split(/[T\s]/)[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

interface FormErrors {
  nome?: string;
  telefone?: string;
  email?: string;
}

const validarCamposCliente = (nome: string, telefone: string, email: string): FormErrors => {
  const errs: FormErrors = {};
  if (!nome.trim()) {
    errs.nome = 'O nome é obrigatório.';
  } else if (nome.trim().split(/\s+/).length < 2) {
    errs.nome = 'Informe pelo menos o nome e sobrenome.';
  }

  if (!telefone.trim()) {
    errs.telefone = 'O telefone é obrigatório.';
  } else if (!/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(telefone.trim())) {
    errs.telefone = 'Formato inválido. Use (99) 99999-9999.';
  }

  if (email.trim()) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      errs.email = 'E-mail inválido.';
    }
  }

  return errs;
};

// Modal de Criação / Edição de Cliente
interface ModalNovoClienteProps {
  isOpen: boolean;
  modoEdicao: boolean;
  ncNome: string;
  setNcNome: (v: string) => void;
  ncTelefone: string;
  setNcTelefone: (v: string) => void;
  ncEmail: string;
  setNcEmail: (v: string) => void;
  errors: FormErrors;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ModalNovoCliente: React.FC<ModalNovoClienteProps> = ({
  isOpen,
  modoEdicao,
  ncNome,
  setNcNome,
  ncTelefone,
  setNcTelefone,
  ncEmail,
  setNcEmail,
  errors,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const previewName = ncNome.trim() || (modoEdicao ? 'Cliente' : 'Cliente novo');
  const previewInitials = (() => {
    const parts = ncNome.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return modoEdicao ? 'CL' : 'CN';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <div
      data-pencil-name="Overlay Novo Cliente"
      className="fixed inset-0 bg-[#071915]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-pencil-name="Modal Novo Cliente"
        className="box-border w-full max-w-[440px] flex flex-col gap-[16px] p-[28px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[22px] overflow-hidden shadow-2xl animate-scale-in"
      >
        {/* Header Novo Cliente */}
        <div
          data-pencil-name="Header Novo Cliente"
          className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-start"
        >
          <div
            data-pencil-name="Título Novo Cliente Grupo"
            className="box-border flex-1 h-fit flex flex-col gap-[6px] justify-start items-start"
          >
            <div
              data-pencil-name="Título Novo Cliente"
              className="text-[24px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              {modoEdicao ? 'Editar cliente' : 'Novo cliente'}
            </div>
            <div
              data-pencil-name="Subtítulo Novo Cliente"
              className="text-[12px]/[normal] box-border w-full text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left"
            >
              {modoEdicao
                ? 'Atualize os dados cadastrais do cliente.'
                : 'Informe os dados básicos para cadastrar um cliente.'}
            </div>
          </div>
          <button
            data-pencil-name="Fechar Novo Cliente"
            type="button"
            onClick={onClose}
            className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#F7F2EA] hover:bg-[#EBE4D8] rounded-[17px] transition-colors cursor-pointer text-[#6F766F]"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Prévia Cliente Novo */}
        <div
          data-pencil-name="Prévia Cliente Novo"
          className="box-border w-full h-[47px] shrink-0 flex flex-row gap-[10px] p-[8px_10px] justify-start items-center bg-[#071915] outline outline-1 outline-[#071915] -outline-offset-1 rounded-[14px]"
        >
          <div
            data-pencil-name="Avatar Preview Novo Cliente"
            className="box-border w-[30px] shrink-0 h-[30px] bg-[#C9FF3B] text-[#071915] rounded-full flex items-center justify-center font-bold text-[11px]"
          >
            {previewInitials}
          </div>
          <div
            data-pencil-name="Nome Preview Novo Cliente"
            className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
            title={previewName}
          >
            {previewName}
          </div>
        </div>

        {/* Form Novo Cliente */}
        <form onSubmit={onSubmit} className="box-border w-full flex flex-col gap-[14px] justify-start items-start">
          <div
            data-pencil-name="Form Novo Cliente"
            className="box-border w-full h-fit shrink-0 flex flex-col gap-[14px] justify-start items-start"
          >
            {/* Campo Grupo Nome completo * */}
            <div
              data-pencil-name="Campo Grupo Nome completo *"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
            >
              <label
                htmlFor="nc-nome"
                data-pencil-name="Label Nome completo *"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Nome completo *
              </label>
              <div
                data-pencil-name="Input Nome completo *"
                className={`box-border w-full h-[42px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FBFAF7] outline outline-1 ${
                  errors.nome ? 'outline-red-500' : 'outline-[#DED6CA]'
                } -outline-offset-1 rounded-[11px] focus-within:outline-2 focus-within:outline-[#071915] transition-all`}
              >
                <User size={15} className="text-[#6F766F] shrink-0" />
                <input
                  type="text"
                  id="nc-nome"
                  placeholder="Nome do cliente"
                  value={ncNome}
                  onChange={(e) => setNcNome(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder:text-[#94A3B8] font-normal"
                  required
                />
              </div>
              {errors.nome && (
                <span className="text-[11px] text-red-500 font-medium">
                  {errors.nome}
                </span>
              )}
            </div>

            {/* Campo Grupo Telefone * */}
            <div
              data-pencil-name="Campo Grupo Telefone *"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
            >
              <label
                htmlFor="nc-telefone"
                data-pencil-name="Label Telefone *"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Telefone *
              </label>
              <div
                data-pencil-name="Input Telefone *"
                className={`box-border w-full h-[42px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FBFAF7] outline outline-1 ${
                  errors.telefone ? 'outline-red-500' : 'outline-[#DED6CA]'
                } -outline-offset-1 rounded-[11px] focus-within:outline-2 focus-within:outline-[#071915] transition-all`}
              >
                <Phone size={15} className="text-[#6F766F] shrink-0" />
                <input
                  type="text"
                  id="nc-telefone"
                  placeholder="(99) 99999-9999"
                  value={ncTelefone}
                  onChange={(e) => setNcTelefone(formatPhone(e.target.value))}
                  maxLength={15}
                  className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder:text-[#94A3B8] font-normal"
                  required
                />
              </div>
              {errors.telefone && (
                <span className="text-[11px] text-red-500 font-medium">
                  {errors.telefone}
                </span>
              )}
            </div>

            {/* Campo Grupo E-mail */}
            <div
              data-pencil-name="Campo Grupo E-mail"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[7px] justify-start items-start"
            >
              <label
                htmlFor="nc-email"
                data-pencil-name="Label E-mail"
                className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                E-mail
              </label>
              <div
                data-pencil-name="Input E-mail"
                className={`box-border w-full h-[42px] shrink-0 flex flex-row gap-[9px] px-[12px] justify-start items-center bg-[#FBFAF7] outline outline-1 ${
                  errors.email ? 'outline-red-500' : 'outline-[#DED6CA]'
                } -outline-offset-1 rounded-[11px] focus-within:outline-2 focus-within:outline-[#071915] transition-all`}
              >
                <Mail size={15} className="text-[#6F766F] shrink-0" />
                <input
                  type="email"
                  id="nc-email"
                  placeholder="cliente@email.com · opcional"
                  value={ncEmail}
                  onChange={(e) => setNcEmail(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder:text-[#94A3B8] font-normal"
                />
              </div>
              {errors.email && (
                <span className="text-[11px] text-red-500 font-medium">
                  {errors.email}
                </span>
              )}
            </div>
          </div>

          {/* Footer Novo Cliente */}
          <div
            data-pencil-name="Footer Novo Cliente"
            className="box-border w-full h-[52px] shrink-0 flex flex-row gap-[10px] justify-between items-center pt-2"
          >
            <button
              data-pencil-name="Cancelar Novo Cliente"
              type="button"
              onClick={onClose}
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-0 px-[16px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[10px] hover:bg-[#F7F2EA] transition-colors cursor-pointer"
            >
              <div
                data-pencil-name="Texto Cancelar Novo Cliente"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Cancelar
              </div>
            </button>
            <button
              data-pencil-name="Salvar Novo Cliente"
              type="submit"
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[16px] justify-center items-center bg-[#071915] hover:bg-[#122822] rounded-[10px] transition-colors cursor-pointer shadow-sm"
            >
              <Save size={15} className="text-[#C9FF3B]" />
              <div
                data-pencil-name="Texto Salvar Novo Cliente"
                className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                {modoEdicao ? 'Salvar alterações' : 'Salvar cliente'}
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal de Detalhe Completo do Cliente
interface ModalDetalheClienteProps {
  isOpen: boolean;
  loadingDetalhe: boolean;
  clienteDetalhe: ClienteDetalhe | null;
  onClose: () => void;
  onArquivar: () => void;
  onDesarquivar: () => void;
  onExcluir: () => void;
  onEditar: () => void;
  operadorNome?: string;
}

const ModalDetalheCliente: React.FC<ModalDetalheClienteProps> = ({
  isOpen,
  loadingDetalhe,
  clienteDetalhe,
  onClose,
  onArquivar,
  onDesarquivar,
  onExcluir,
  onEditar,
  operadorNome = 'fefe',
}) => {
  if (!isOpen) return null;

  const initials = (() => {
    if (!clienteDetalhe?.nome) return 'CL';
    const parts = clienteDetalhe.nome.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  const totalReservas =
    clienteDetalhe?.reservas_count ??
    clienteDetalhe?.reservasCount ??
    (clienteDetalhe?.ultimasReservas?.length || 0);

  const canceladas =
    clienteDetalhe?.ultimasReservas?.filter((r) => r.status === 'Cancelada').length || 0;

  const resumoTexto = `${totalReservas} reserva${totalReservas === 1 ? '' : 's'}${
    canceladas > 0 ? ` · ${canceladas} cancelada${canceladas === 1 ? '' : 's'}` : ''
  }`;

  return (
    <div
      data-pencil-name="Overlay Ver Cliente"
      className="fixed inset-0 bg-[#071915]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-pencil-name="Modal Ver Cliente"
        className="box-border w-full max-w-[600px] flex flex-col gap-[18px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[26px] overflow-hidden shadow-2xl animate-scale-in"
      >
        {/* Hero Ver Cliente Refinado */}
        <div
          data-pencil-name="Hero Ver Cliente Refinado"
          className="box-border w-full h-[132px] shrink-0 flex flex-row gap-[16px] p-[24px_26px] justify-start items-center bg-[#071915]"
        >
          <div
            data-pencil-name="Avatar Ver Cliente Refinado"
            className="box-border w-[58px] shrink-0 h-[58px] bg-[#C9FF3B] text-[#071915] rounded-full flex items-center justify-center font-bold text-xl select-none"
          >
            {initials}
          </div>
          <div
            data-pencil-name="Texto Hero Ver Cliente"
            className="box-border flex-1 h-fit flex flex-col gap-[6px] justify-start items-start min-w-0"
          >
            <div
              data-pencil-name="Nome Hero Ver Cliente"
              className="text-[25px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-full leading-tight"
              title={clienteDetalhe?.nome}
            >
              {loadingDetalhe ? 'Carregando...' : clienteDetalhe?.nome}
            </div>
            <div
              data-pencil-name="Contato Hero Ver Cliente"
              className="text-[13px]/[normal] box-border text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap truncate max-w-full"
            >
              {clienteDetalhe?.telefone || clienteDetalhe?.email || 'Sem contato'}
            </div>
            {clienteDetalhe?.ativo === 1 ? (
              <div
                data-pencil-name="Tag Cliente Ativo"
                className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] px-[8px] py-[4px] justify-start items-center bg-[#C9FF3B] rounded-[11px]"
              >
                <div
                  data-pencil-name="Ponto Tag Cliente Ativo"
                  className="box-border w-[6px] shrink-0 h-[6px] bg-[#071915] rounded-full"
                />
                <div
                  data-pencil-name="Texto Tag Cliente Ativo"
                  className="text-[10px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Cliente ativo
                </div>
              </div>
            ) : (
              <div
                data-pencil-name="Tag Cliente Arquivado"
                className="box-border w-fit h-fit shrink-0 flex flex-row gap-[6px] px-[8px] py-[4px] justify-start items-center bg-[#FFF3D9] rounded-[11px]"
              >
                <div
                  data-pencil-name="Ponto Tag Cliente Arquivado"
                  className="box-border w-[6px] shrink-0 h-[6px] bg-[#A85B00] rounded-full"
                />
                <div
                  data-pencil-name="Texto Tag Cliente Arquivado"
                  className="text-[10px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Cliente arquivado
                </div>
              </div>
            )}
          </div>
          <button
            data-pencil-name="Fechar Ver Cliente Refinado"
            type="button"
            onClick={onClose}
            className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#FFFFFF1A] hover:bg-white/20 rounded-[17px] transition-colors cursor-pointer text-white"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo Ver Cliente Refinado */}
        <div
          data-pencil-name="Conteúdo Ver Cliente Refinado"
          className="box-border w-full flex-1 flex flex-col gap-[14px] px-[24px] justify-start items-start"
        >
          {loadingDetalhe ? (
            <div className="w-full py-16 text-center text-xs text-[#6F766F]">
              Carregando dados do cliente...
            </div>
          ) : !clienteDetalhe ? (
            <div className="w-full py-16 text-center text-xs text-red-500">
              Não foi possível carregar as informações do cliente.
            </div>
          ) : (
            <>
              {/* Resumo Ver Cliente Refinado (Cards Mini) */}
              <div
                data-pencil-name="Resumo Ver Cliente Refinado"
                className="box-border w-full h-[92px] shrink-0 flex flex-row gap-[12px] justify-start items-start"
              >
                {/* Card Mini Cliente E-mail */}
                <div
                  data-pencil-name="Card Mini Cliente E-mail"
                  className="box-border flex-1 h-full flex flex-col gap-[8px] p-[14px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
                >
                  <div
                    data-pencil-name="Label Mini Cliente E-mail"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.6px] text-left whitespace-nowrap"
                  >
                    E-MAIL
                  </div>
                  <div
                    data-pencil-name="Valor Mini Cliente E-mail"
                    className={`text-[16px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-full ${
                      clienteDetalhe.email ? 'text-[#071915]' : 'text-[#6F766F]'
                    }`}
                    title={clienteDetalhe.email || ''}
                  >
                    {clienteDetalhe.email || '—'}
                  </div>
                </div>

                {/* Card Mini Cliente Reservas */}
                <div
                  data-pencil-name="Card Mini Cliente Reservas"
                  className="box-border flex-1 h-full flex flex-col gap-[8px] p-[14px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
                >
                  <div
                    data-pencil-name="Label Mini Cliente Reservas"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.6px] text-left whitespace-nowrap"
                  >
                    RESERVAS
                  </div>
                  <div
                    data-pencil-name="Valor Mini Cliente Reservas"
                    className="text-[18px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {totalReservas}
                  </div>
                </div>

                {/* Card Mini Cliente Saldo */}
                <div
                  data-pencil-name="Card Mini Cliente Saldo"
                  className="box-border flex-1 h-full flex flex-col gap-[8px] p-[14px] justify-start items-start bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
                >
                  <div
                    data-pencil-name="Label Mini Cliente Saldo"
                    className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.6px] text-left whitespace-nowrap"
                  >
                    SALDO
                  </div>
                  <div
                    data-pencil-name="Valor Mini Cliente Saldo"
                    className={`text-[18px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                      (clienteDetalhe.saldoDevedor || 0) > 0 ? 'text-[#B01F24]' : 'text-[#138A4B]'
                    }`}
                  >
                    {formatCurrency(clienteDetalhe.saldoDevedor || 0)}
                  </div>
                </div>
              </div>

              {/* Histórico de Reservas Cliente */}
              <div
                data-pencil-name="Histórico de Reservas Cliente"
                className="box-border w-full h-[230px] shrink-0 flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] overflow-hidden"
              >
                {/* Header Histórico Reservas Cliente */}
                <div
                  data-pencil-name="Header Histórico Reservas Cliente"
                  className="box-border w-full h-[51.5px] shrink-0 flex flex-row gap-0 px-[16px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
                >
                  <div
                    data-pencil-name="Título Histórico Reservas Cliente"
                    className="text-[16px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Histórico de reservas
                  </div>
                  <div
                    data-pencil-name="Resumo Histórico Reservas Cliente"
                    className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {resumoTexto}
                  </div>
                </div>

                {/* Colunas Histórico Reservas Cliente */}
                <div
                  data-pencil-name="Colunas Histórico Reservas Cliente"
                  className="box-border w-full h-[31.5px] shrink-0 flex flex-row gap-[10px] px-[16px] justify-start items-center border-b border-[#F0EBE4]"
                >
                  <div
                    data-pencil-name="Coluna Hist Cliente DATA"
                    className="text-[10px]/[normal] box-border w-[118px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    DATA
                  </div>
                  <div
                    data-pencil-name="Coluna Hist Cliente QUADRA"
                    className="text-[10px]/[normal] box-border w-[86px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    QUADRA
                  </div>
                  <div
                    data-pencil-name="Coluna Hist Cliente VALOR"
                    className="text-[10px]/[normal] box-border w-[80px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    VALOR
                  </div>
                  <div
                    data-pencil-name="Coluna Hist Cliente STATUS"
                    className="text-[10px]/[normal] box-border w-[96px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    STATUS
                  </div>
                  <div
                    data-pencil-name="Coluna Hist Cliente PAG."
                    className="text-[10px]/[normal] box-border w-[76px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    PAG.
                  </div>
                </div>

                {/* Linhas do Histórico */}
                <div className="w-full flex-1 overflow-y-auto">
                  {!clienteDetalhe.ultimasReservas || clienteDetalhe.ultimasReservas.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6F766F]">
                      Nenhuma reserva encontrada para este cliente.
                    </div>
                  ) : (
                    clienteDetalhe.ultimasReservas.map((r) => {
                      const isCancelada = r.status === 'Cancelada';
                      const isConcluida = r.status === 'Confirmada' || r.status === 'Concluída';
                      const isPago = r.status_pagamento === 'Pago';

                      return (
                        <div
                          key={r.id}
                          data-pencil-name={`Linha Histórico Reserva Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                          className="box-border w-full h-[33.5px] shrink-0 flex flex-row gap-[10px] px-[16px] justify-start items-center border-b border-[#F7F2EA] hover:bg-[#FAF8F5] transition-colors"
                        >
                          <div
                            data-pencil-name={`Data Hist Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                            className="text-[11px]/[normal] box-border w-[118px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap truncate"
                          >
                            {formatDateBR(r.data_reserva)} · {r.hora_inicio}
                          </div>
                          <div
                            data-pencil-name={`Quadra Hist Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                            className="text-[11px]/[normal] box-border w-[86px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap truncate"
                            title={r.quadra_nome}
                          >
                            {r.quadra_nome}
                          </div>
                          <div
                            data-pencil-name={`Valor Hist Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                            className="text-[11px]/[normal] box-border w-[80px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                          >
                            {formatCurrency(r.valor_total || 0)}
                          </div>
                          <div
                            data-pencil-name={`Status Hist Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                            className="box-border w-[96px] shrink-0 flex justify-start items-center"
                          >
                            <div
                              className={`box-border w-fit min-w-[76px] px-2 h-[22px] flex flex-row gap-0 justify-center items-center rounded-[11px] ${
                                isCancelada
                                  ? 'bg-[#FDEAEA]'
                                  : isConcluida
                                  ? 'bg-[#EAF8EF]'
                                  : 'bg-[#FFF3D9]'
                              }`}
                            >
                              <div
                                className={`text-[9px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                  isCancelada
                                    ? 'text-[#B01F24]'
                                    : isConcluida
                                    ? 'text-[#138A4B]'
                                    : 'text-[#A85B00]'
                                }`}
                              >
                                {isCancelada ? 'Cancelada' : isConcluida ? 'Concluída' : r.status}
                              </div>
                            </div>
                          </div>
                          <div
                            data-pencil-name={`Pagamento Hist Cliente ${r.data_reserva} · ${r.hora_inicio}`}
                            className="box-border w-[76px] shrink-0 flex justify-start items-center"
                          >
                            <div
                              className={`box-border w-fit min-w-[58px] px-2 h-[22px] flex flex-row gap-0 justify-center items-center rounded-[11px] ${
                                isCancelada
                                  ? 'bg-[#FDEAEA]'
                                  : isPago
                                  ? 'bg-[#EAF8EF]'
                                  : 'bg-[#FFF3D9]'
                              }`}
                            >
                              <div
                                className={`text-[9px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                                  isCancelada
                                    ? 'text-[#B01F24]'
                                    : isPago
                                    ? 'text-[#138A4B]'
                                    : 'text-[#A85B00]'
                                }`}
                              >
                                {isCancelada ? 'Cancel.' : isPago ? 'Pago' : r.status_pagamento}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Operação Cliente Refinado */}
              <div
                data-pencil-name="Operação Cliente Refinado"
                className="box-border w-full h-[64px] shrink-0 flex flex-row gap-[12px] justify-start items-start"
              >
                {/* Operação Cadastro */}
                <div
                  data-pencil-name="Operação Cadastro"
                  className="box-border flex-1 h-full flex flex-row gap-[10px] p-[14px] justify-start items-center bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
                >
                  <div
                    data-pencil-name="Ícone Operação Cadastro"
                    className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[11px]"
                  >
                    <Calendar size={16} className="text-[#6F766F]" />
                  </div>
                  <div
                    data-pencil-name="Texto Operação Cadastro"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Label Operação Cadastro"
                      className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      Cadastro
                    </div>
                    <div
                      data-pencil-name="Valor Operação Cadastro"
                      className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      {formatDateBR(clienteDetalhe.criado_em) || '—'}
                    </div>
                  </div>
                </div>

                {/* Operação Operador */}
                <div
                  data-pencil-name="Operação Operador"
                  className="box-border flex-1 h-full flex flex-row gap-[10px] p-[14px] justify-start items-center bg-[#FBFAF7] outline outline-1 outline-[#F0EBE4] -outline-offset-1 rounded-[16px] min-w-0"
                >
                  <div
                    data-pencil-name="Ícone Operação Operador"
                    className="box-border w-[34px] shrink-0 h-[34px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[11px]"
                  >
                    <UserCheck size={16} className="text-[#6F766F]" />
                  </div>
                  <div
                    data-pencil-name="Texto Operação Operador"
                    className="box-border w-fit shrink-0 h-fit flex flex-col gap-[4px] justify-start items-start"
                  >
                    <div
                      data-pencil-name="Label Operação Operador"
                      className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      Operador
                    </div>
                    <div
                      data-pencil-name="Valor Operação Operador"
                      className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                    >
                      {operadorNome}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Ver Cliente Refinado */}
        <div
          data-pencil-name="Footer Ver Cliente Refinado"
          className="box-border w-full h-[71.5px] shrink-0 flex flex-row gap-0 px-[24px] justify-between items-center bg-[#FBFAF7] border-t border-[#F0EBE4]"
        >
          {/* Ações Secundárias Ver Cliente (Arquivar, Excluir) */}
          <div
            data-pencil-name="Ações Secundárias Ver Cliente"
            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-start"
          >
            {clienteDetalhe && (
              <>
                <button
                  data-pencil-name="Botão Arquivar Refinado"
                  type="button"
                  onClick={clienteDetalhe.ativo === 1 ? onArquivar : onDesarquivar}
                  className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-0 px-[14px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[10px] hover:bg-[#F7F2EA] transition-colors cursor-pointer"
                  title={
                    clienteDetalhe.ativo === 1
                      ? 'Ocultar da lista principal preservando o histórico'
                      : 'Restaurar para a lista de clientes ativos'
                  }
                >
                  <div
                    data-pencil-name="Texto Arquivar Refinado"
                    className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    {clienteDetalhe.ativo === 1 ? 'Arquivar' : 'Reativar'}
                  </div>
                </button>
                <button
                  data-pencil-name="Botão Excluir Refinado"
                  type="button"
                  onClick={onExcluir}
                  className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-0 px-[14px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[10px] hover:bg-[#FDEAEA] transition-colors cursor-pointer"
                >
                  <div
                    data-pencil-name="Texto Excluir Refinado"
                    className="text-[13px]/[normal] box-border text-[#B01F24] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Excluir
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Ações Primárias Ver Cliente (Fechar, Editar) */}
          <div
            data-pencil-name="Ações Primárias Ver Cliente"
            className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-start"
          >
            <button
              data-pencil-name="Fechar Cliente Refinado"
              type="button"
              onClick={onClose}
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-0 px-[14px] justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[10px] hover:bg-[#F7F2EA] transition-colors cursor-pointer"
            >
              <div
                data-pencil-name="Texto Fechar Cliente Refinado"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Fechar
              </div>
            </button>
            {clienteDetalhe && clienteDetalhe.ativo === 1 && (
              <button
                data-pencil-name="Editar Cliente Refinado"
                type="button"
                onClick={onEditar}
                className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[16px] justify-center items-center bg-[#071915] hover:bg-[#122822] rounded-[10px] transition-colors cursor-pointer"
              >
                <Pencil size={14} className="text-[#C9FF3B]" />
                <div
                  data-pencil-name="Texto Editar Cliente Refinado"
                  className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Editar
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export function AdminClientes() {
  const { onToggleSidebar } = useOutletContext<{ onToggleSidebar?: () => void }>() || {};

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'arquivados'>('ativos');
  const [filtroCanal, setFiltroCanal] = useState<'todos' | 'com_reservas' | 'sem_reservas'>('todos');
  const [showFiltroCanalMenu, setShowFiltroCanalMenu] = useState(false);

  // Informações de Arena e Usuário
  const [arenaSlug, setArenaSlug] = useState(() => safeStorage.getItem('arena_slug') || 'felp-arena');
  const user = getStoredUser();
  const userName = user?.nome || 'fefe';

  // Notificações / Comunicados
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState<ClientesKPIs>({
    totalAtivos: 0,
    comReservas: 0,
    novosMes: 0,
    arquivados: 0,
  });

  // Modais
  const [activeModal, setActiveModal] = useState<'novo-cliente' | 'detalhe-cliente' | null>(null);

  // Estado Novo / Editar Cliente
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idEdicao, setIdEdicao] = useState<number | null>(null);
  const [ncNome, setNcNome] = useState('');
  const [ncTelefone, setNcTelefone] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Detalhe / Destaque do Cliente
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [clienteDetalhe, setClienteDetalhe] = useState<ClienteDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Carregar KPIs
  const carregarKPIs = useCallback(async () => {
    try {
      const res = await fetch('/api/clientes/estatisticas');
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  }, []);

  // Carregar Clientes da API
  const carregarClientes = useCallback(async (aba?: 'ativos' | 'arquivados') => {
    setLoading(true);
    const abaParaCarregar = aba ?? abaAtiva;
    const ativo = abaParaCarregar === 'ativos' ? 1 : 0;
    try {
      const res = await fetch(`/api/clientes?ativo=${ativo}`);
      if (res.ok) {
        const data = await res.json();
        setClientes(data);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar lista de clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [abaAtiva]);

  // Carregar Notificações e dados da Arena
  useEffect(() => {
    fetch('/api/arenas/minha', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.slug) {
          setArenaSlug(data.slug);
          safeStorage.setItem('arena_slug', data.slug);
        }
      })
      .catch(() => {});

    fetch('/api/auth/comunicados/ativos', { headers: {} })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarClientes(abaAtiva);
    carregarKPIs();
  }, [abaAtiva, carregarClientes, carregarKPIs]);

  // Carregar Detalhes do Cliente
  useEffect(() => {
    if (!selectedClienteId) {
      setClienteDetalhe(null);
      return;
    }

    const fetchDetalhe = async () => {
      setLoadingDetalhe(true);
      try {
        const res = await fetch(`/api/clientes/${selectedClienteId}`);
        if (res.ok) {
          const data = await res.json();
          setClienteDetalhe(data);
        } else {
          showToast('Erro ao carregar detalhes do cliente', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Erro ao carregar detalhes', 'error');
      } finally {
        setLoadingDetalhe(false);
      }
    };

    fetchDetalhe();
  }, [selectedClienteId]);

  // Salvar Novo / Editar Cliente
  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validarCamposCliente(ncNome, ncTelefone, ncEmail);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const method = modoEdicao ? 'PUT' : 'POST';
      const url = modoEdicao ? `/api/clientes/${idEdicao}` : '/api/clientes';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: ncNome.trim(),
          telefone: ncTelefone.trim(),
          email: ncEmail.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.field) {
          setErrors((prev) => ({ ...prev, [data.field]: data.error }));
        } else {
          showToast(data.error || 'Erro ao salvar cliente', 'error');
        }
        return;
      }

      showToast(
        modoEdicao ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!',
        'success'
      );
      setActiveModal(null);
      resetForm();
      carregarClientes();
      carregarKPIs();
    } catch (err) {
      console.error(err);
      showToast('Erro ao se conectar ao servidor.', 'error');
    }
  };

  // Arquivar Cliente
  const handleArquivarCliente = async () => {
    if (!clienteDetalhe) return;
    if (
      !window.confirm(
        `Arquivar "${clienteDetalhe.nome}"? O cliente ficará oculto da lista principal, mas o histórico de reservas será preservado.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/clientes/${clienteDetalhe.id}/arquivar`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao arquivar');
      showToast('Cliente arquivado. Histórico preservado.', 'success');
      setActiveModal(null);
      setSelectedClienteId(null);
      carregarClientes();
      carregarKPIs();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  // Desarquivar Cliente
  const handleDesarquivarCliente = async () => {
    if (!clienteDetalhe) return;
    try {
      const res = await fetch(`/api/clientes/${clienteDetalhe.id}/desarquivar`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reativar');
      showToast('Cliente reativado com sucesso!', 'success');
      setActiveModal(null);
      setSelectedClienteId(null);
      carregarClientes();
      carregarKPIs();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  // Excluir Cliente
  const handleExcluirCliente = async () => {
    if (!clienteDetalhe) return;

    const resCount = clienteDetalhe.reservas_count ?? clienteDetalhe.reservasCount ?? 0;
    if (resCount > 0) {
      showToast('Cliente com histórico não pode ser excluído. Use "Arquivar".', 'warning');
      return;
    }

    if (window.confirm(`Tem certeza que deseja excluir permanentemente o cliente ${clienteDetalhe.nome}?`)) {
      try {
        const res = await fetch(`/api/clientes/${clienteDetalhe.id}`, {
          method: 'DELETE',
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao excluir');

        showToast('Cliente excluído com sucesso!', 'success');
        setActiveModal(null);
        setSelectedClienteId(null);
        carregarClientes();
        carregarKPIs();
      } catch (err) {
        console.error(err);
        showToast(errorMessage(err), 'error');
      }
    }
  };

  const resetForm = () => {
    setNcNome('');
    setNcTelefone('');
    setNcEmail('');
    setErrors({});
    setIdEdicao(null);
    setModoEdicao(false);
  };

  const abrirEdicao = () => {
    if (!clienteDetalhe) return;
    setModoEdicao(true);
    setIdEdicao(clienteDetalhe.id);
    setNcNome(clienteDetalhe.nome || '');
    setNcTelefone(clienteDetalhe.telefone || '');
    setNcEmail(clienteDetalhe.email || '');
    setErrors({});
    setActiveModal('novo-cliente');
  };

  // Filtragem local
  const clientesFiltrados = clientes.filter((c) => {
    const matchBusca =
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.telefone && c.telefone.includes(busca)) ||
      (c.email && c.email.toLowerCase().includes(busca.toLowerCase()));

    if (!matchBusca) return false;

    const resCount = c.reservas_count ?? c.reservasCount ?? 0;
    if (filtroCanal === 'com_reservas') return resCount > 0;
    if (filtroCanal === 'sem_reservas') return resCount === 0;
    return true;
  });

  // Cliente em destaque (se houver selecionado, usa ele; senão, o primeiro da lista filtrada)
  const clienteDestaque =
    clientesFiltrados.find((c) => c.id === selectedClienteId) ||
    clientesFiltrados[0] ||
    null;

  return (
    <div className="admin-clientes-page w-full flex flex-col min-w-0 font-[Inter,system-ui,sans-serif]">
      {/* Toast Alert */}
      {toast && (
        <div
          style={{ zIndex: 999999 }}
          className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slideUp border ${
            toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500'
              : 'bg-rose-600 border-rose-500'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Área Principal Clientes (Fiel ao mockup do Penpot) */}
      <div
        data-pencil-name="Área Principal Clientes"
        className="box-border w-full flex flex-col gap-[18px] justify-start items-start"
      >
        {/* Cabeçalho Clientes */}
        <div
          data-pencil-name="Cabeçalho Clientes"
          className="box-border w-full min-h-[70px] shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center select-none"
        >
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="md:hidden p-2 rounded-xl bg-white border border-[#E6DED2] text-[#071915] hover:bg-[#F1EDE6] transition-colors"
                title="Abrir menu"
              >
                <Menu size={20} />
              </button>
            )}

            <div
              data-pencil-name="Título Clientes Grupo"
              className="box-border w-fit shrink-0 h-fit flex flex-col gap-[6px] justify-start items-start"
            >
              <div
                data-pencil-name="Breadcrumb Clientes"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Relacionamento / Clientes
              </div>
              <div
                data-pencil-name="Título Clientes"
                className="text-[28px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Clientes
              </div>
            </div>
          </div>

          <div
            data-pencil-name="Ações Cabeçalho Clientes"
            className="box-border w-fit shrink-0 h-fit flex flex-wrap gap-[10px] justify-start items-center"
          >
            {/* Botão Novo Cliente */}
            <button
              data-pencil-name="Novo Cliente"
              type="button"
              onClick={() => {
                resetForm();
                setActiveModal('novo-cliente');
              }}
              className="box-border w-fit shrink-0 h-[42px] flex flex-row gap-[8px] px-[16px] justify-start items-center bg-[#071915] hover:bg-[#122822] rounded-[10px] cursor-pointer transition-colors"
            >
              <Plus size={16} className="text-[#C9FF3B]" />
              <div
                data-pencil-name="Texto Novo Cliente"
                className="text-[13px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Novo cliente
              </div>
            </button>

            {/* Acesso usuário Clientes */}
            <div
              data-pencil-name="Acesso usuário Clientes"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
            >
              {/* Portal do Cliente Pill */}
              <a
                data-pencil-name="Portal do Cliente Clientes"
                href={`/portal/${arenaSlug}`}
                target="_blank"
                rel="noreferrer"
                className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[12px] justify-start items-center bg-[#ECFFF4] hover:bg-[#d8fae4] rounded-[17px] cursor-pointer transition-colors text-decoration-none"
                title="Acessar Portal do Atleta / Cliente"
              >
                <Globe size={14} className="text-[#008A5A]" />
                <div
                  data-pencil-name="Texto Portal Clientes"
                  className="text-[12px]/[normal] box-border text-[#007A50] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  Portal do Cliente
                </div>
              </a>

              {/* Usuário logado */}
              <div
                data-pencil-name="Usuário logado Clientes"
                className="box-border w-fit shrink-0 h-[34px] flex flex-row gap-[7px] px-[11px] justify-start items-center bg-[#F1EDE6] rounded-[17px]"
              >
                <div
                  data-pencil-name="Status online Clientes"
                  className="box-border w-[7px] shrink-0 h-[7px] bg-[#188A45] rounded-full"
                ></div>
                <div
                  data-pencil-name="Nome usuário Clientes"
                  className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                >
                  {userName}
                </div>
              </div>

              {/* Notificações Bell */}
              <div className="relative">
                <button
                  data-pencil-name="Notificações Clientes"
                  type="button"
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="box-border w-[34px] shrink-0 h-[34px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[17px] flex items-center justify-center hover:bg-[#FAF7F2] transition-colors relative"
                  title="Notificações"
                >
                  <Bell size={16} className="text-[#071915]" />
                  {notifications.length > 0 && (
                    <div
                      data-pencil-name="Bolinha notificação Clientes"
                      className="box-border w-[7px] h-[7px] absolute left-[22px] top-[7px] bg-[#D11F2A] outline outline-1 outline-[#FFFFFF] rounded-full"
                    ></div>
                  )}
                </button>

                {/* Dropdown de Notificações */}
                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl outline outline-1 outline-[#E6DED2] py-2 z-50 animate-scale-in">
                    <div className="px-4 py-2 border-b border-[#F0EBE4] flex items-center justify-between">
                      <span className="font-bold text-xs text-[#071915]">Notificações</span>
                      <span className="text-[10px] text-[#6F766F]">
                        {notifications.length} nova(s)
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#F4EFE8]">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[#6F766F]">
                          Nenhuma notificação no momento.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="px-4 py-2.5 hover:bg-[#FAF8F5]">
                            <div className="text-xs text-[#071915] font-medium">{n.message}</div>
                            <div className="text-[10px] text-[#6F766F] mt-0.5">
                              {new Date(n.createdAt || Date.now()).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Clientes (4 cards) */}
        <div
          data-pencil-name="Resumo Clientes"
          className="box-border w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] justify-start items-start"
        >
          {/* Card 1: CLIENTES ATIVOS */}
          <div
            data-pencil-name="Card Clientes Clientes ativos"
            className="box-border h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              data-pencil-name="Ícone Clientes Clientes ativos"
              className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#F1EDE6] rounded-[14px]"
            >
              <Users size={18} className="text-[#071915]" />
            </div>
            <div
              data-pencil-name="Texto Clientes Clientes ativos"
              className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
            >
              <div
                data-pencil-name="Topo Clientes Clientes ativos"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
              >
                <div
                  data-pencil-name="Label Clientes Clientes ativos"
                  className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
                >
                  CLIENTES ATIVOS
                </div>
                <div
                  data-pencil-name="Pill Clientes Clientes ativos"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
                >
                  <div
                    data-pencil-name="Texto Pill Clientes Clientes ativos"
                    className="text-[9px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Base
                  </div>
                </div>
              </div>
              <div
                data-pencil-name="Valor Clientes Clientes ativos"
                className="text-[23px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
              >
                {kpis.totalAtivos}
              </div>
              <div
                data-pencil-name="Descrição Clientes Clientes ativos"
                className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Clientes prontos para reservar
              </div>
            </div>
          </div>

          {/* Card 2: COM RESERVAS */}
          <div
            data-pencil-name="Card Clientes Com reservas"
            className="box-border h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              data-pencil-name="Ícone Clientes Com reservas"
              className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#EAF8EF] rounded-[14px]"
            >
              <CalendarCheck size={18} className="text-[#138A4B]" />
            </div>
            <div
              data-pencil-name="Texto Clientes Com reservas"
              className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
            >
              <div
                data-pencil-name="Topo Clientes Com reservas"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
              >
                <div
                  data-pencil-name="Label Clientes Com reservas"
                  className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
                >
                  COM RESERVAS
                </div>
                <div
                  data-pencil-name="Pill Clientes Com reservas"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
                >
                  <div
                    data-pencil-name="Texto Pill Clientes Com reservas"
                    className="text-[9px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Engajados
                  </div>
                </div>
              </div>
              <div
                data-pencil-name="Valor Clientes Com reservas"
                className="text-[23px]/[normal] box-border text-[#138A4B] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
              >
                {kpis.comReservas}
              </div>
              <div
                data-pencil-name="Descrição Clientes Com reservas"
                className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Usaram a arena no período
              </div>
            </div>
          </div>

          {/* Card 3: NOVOS NO MÊS */}
          <div
            data-pencil-name="Card Clientes Novos no mês"
            className="box-border h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              data-pencil-name="Ícone Clientes Novos no mês"
              className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#EEF3FF] rounded-[14px]"
            >
              <UserPlus size={18} className="text-[#2563EB]" />
            </div>
            <div
              data-pencil-name="Texto Clientes Novos no mês"
              className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
            >
              <div
                data-pencil-name="Topo Clientes Novos no mês"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
              >
                <div
                  data-pencil-name="Label Clientes Novos no mês"
                  className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
                >
                  NOVOS NO MÊS
                </div>
                <div
                  data-pencil-name="Pill Clientes Novos no mês"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
                >
                  <div
                    data-pencil-name="Texto Pill Clientes Novos no mês"
                    className="text-[9px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Crescimento
                  </div>
                </div>
              </div>
              <div
                data-pencil-name="Valor Clientes Novos no mês"
                className="text-[23px]/[normal] box-border text-[#2563EB] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
              >
                {kpis.novosMes}
              </div>
              <div
                data-pencil-name="Descrição Clientes Novos no mês"
                className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Cadastros recentes
              </div>
            </div>
          </div>

          {/* Card 4: ARQUIVADOS */}
          <div
            data-pencil-name="Card Clientes Arquivados"
            className="box-border h-[104px] flex flex-row gap-[12px] p-[16px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              data-pencil-name="Ícone Clientes Arquivados"
              className="box-border w-[42px] shrink-0 h-[42px] flex flex-row gap-0 justify-center items-center bg-[#FFF3D9] rounded-[14px]"
            >
              <Archive size={18} className="text-[#A85B00]" />
            </div>
            <div
              data-pencil-name="Texto Clientes Arquivados"
              className="box-border flex-1 h-fit flex flex-col gap-[5px] justify-start items-start min-w-0"
            >
              <div
                data-pencil-name="Topo Clientes Arquivados"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-[7px] justify-start items-center"
              >
                <div
                  data-pencil-name="Label Clientes Arquivados"
                  className="text-[10px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.8px] text-left whitespace-nowrap"
                >
                  ARQUIVADOS
                </div>
                <div
                  data-pencil-name="Pill Clientes Arquivados"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-[7px] py-[3px] justify-start items-center bg-[#F1EDE6] rounded-[10px]"
                >
                  <div
                    data-pencil-name="Texto Pill Clientes Arquivados"
                    className="text-[9px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Arquivo
                  </div>
                </div>
              </div>
              <div
                data-pencil-name="Valor Clientes Arquivados"
                className="text-[23px]/[normal] box-border text-[#A85B00] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap leading-none"
              >
                {kpis.arquivados}
              </div>
              <div
                data-pencil-name="Descrição Clientes Arquivados"
                className="text-[11px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                Ocultos da operação
              </div>
            </div>
          </div>
        </div>

        {/* Controles Clientes (Tabs, Busca, Filtro) */}
        <div
          data-pencil-name="Controles Clientes"
          className="box-border w-full min-h-[46px] shrink-0 flex flex-wrap gap-[12px] justify-start items-center"
        >
          {/* Tabs Clientes */}
          <div
            data-pencil-name="Tabs Clientes"
            className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[4px] p-[4px] justify-start items-center bg-[#F1EDE6] rounded-[12px]"
          >
            <button
              data-pencil-name="Tab Clientes Ativos"
              type="button"
              onClick={() => setAbaAtiva('ativos')}
              className={`box-border w-fit shrink-0 h-[30px] flex flex-row gap-0 px-[16px] justify-center items-center rounded-[9px] cursor-pointer transition-colors ${
                abaAtiva === 'ativos'
                  ? 'bg-[#071915]'
                  : 'bg-transparent hover:text-[#071915]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Clientes Ativos"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                  abaAtiva === 'ativos' ? 'text-[#FFFFFF]' : 'text-[#6F766F]'
                }`}
              >
                Ativos
              </div>
            </button>
            <button
              data-pencil-name="Tab Clientes Arquivados"
              type="button"
              onClick={() => setAbaAtiva('arquivados')}
              className={`box-border w-fit shrink-0 h-[30px] flex flex-row gap-0 px-[16px] justify-center items-center rounded-[9px] cursor-pointer transition-colors ${
                abaAtiva === 'arquivados'
                  ? 'bg-[#071915]'
                  : 'bg-transparent hover:text-[#071915]'
              }`}
            >
              <div
                data-pencil-name="Texto Tab Clientes Arquivados"
                className={`text-[12px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap ${
                  abaAtiva === 'arquivados' ? 'text-[#FFFFFF]' : 'text-[#6F766F]'
                }`}
              >
                Arquivados
              </div>
            </button>
          </div>

          {/* Busca Clientes */}
          <div
            data-pencil-name="Busca Clientes"
            className="box-border w-full sm:w-[320px] shrink-0 h-[38px] flex flex-row gap-[8px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px] focus-within:outline-[#071915] transition-all"
          >
            <Search size={15} className="text-[#6F766F] shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-[13px] text-[#071915] placeholder:text-[#94A3B8] font-normal"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="text-[#94A3B8] hover:text-[#071915] text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro Clientes Origem / Canal */}
          <div className="relative">
            <button
              data-pencil-name="Filtro Clientes Origem"
              type="button"
              onClick={() => setShowFiltroCanalMenu(!showFiltroCanalMenu)}
              className="box-border w-fit shrink-0 h-[38px] flex flex-row gap-[8px] px-[12px] justify-start items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[9px] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
            >
              <div
                data-pencil-name="Texto Filtro Clientes Origem"
                className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                {filtroCanal === 'todos'
                  ? 'Todos os canais'
                  : filtroCanal === 'com_reservas'
                  ? 'Com reservas'
                  : 'Sem reservas'}
              </div>
              <ChevronDown size={15} className="text-[#6F675F]" />
            </button>

            {showFiltroCanalMenu && (
              <div className="absolute left-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl outline outline-1 outline-[#E6DED2] py-1.5 z-40 animate-scale-in">
                <button
                  type="button"
                  onClick={() => {
                    setFiltroCanal('todos');
                    setShowFiltroCanalMenu(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#FAF8F5] ${
                    filtroCanal === 'todos' ? 'text-[#071915] bg-[#F7F2EA]' : 'text-[#6F766F]'
                  }`}
                >
                  <span>Todos os canais</span>
                  {filtroCanal === 'todos' && <Check size={14} className="text-[#071915]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroCanal('com_reservas');
                    setShowFiltroCanalMenu(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#FAF8F5] ${
                    filtroCanal === 'com_reservas' ? 'text-[#071915] bg-[#F7F2EA]' : 'text-[#6F766F]'
                  }`}
                >
                  <span>Com reservas</span>
                  {filtroCanal === 'com_reservas' && <Check size={14} className="text-[#071915]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroCanal('sem_reservas');
                    setShowFiltroCanalMenu(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#FAF8F5] ${
                    filtroCanal === 'sem_reservas' ? 'text-[#071915] bg-[#F7F2EA]' : 'text-[#6F766F]'
                  }`}
                >
                  <span>Sem reservas</span>
                  {filtroCanal === 'sem_reservas' && <Check size={14} className="text-[#071915]" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Corpo Clientes (Tabela + Perfil em destaque) */}
        <div
          data-pencil-name="Corpo Clientes"
          className="box-border w-full flex-1 flex flex-col lg:flex-row gap-[16px] justify-start items-start"
        >
          {/* Tabela Clientes */}
          <div
            data-pencil-name="Tabela Clientes"
            className="box-border flex-1 w-full min-w-0 flex flex-col gap-0 justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] overflow-hidden shadow-sm"
          >
            {/* Header Tabela Clientes */}
            <div
              data-pencil-name="Header Tabela Clientes"
              className="box-border w-full h-[55.5px] shrink-0 flex flex-row gap-0 px-[22px] justify-between items-center bg-[#FBFAF7] border-b border-[#F0EBE4]"
            >
              <div
                data-pencil-name="Título Tabela Clientes"
                className="text-[16px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
              >
                Lista de clientes
              </div>
              <div
                data-pencil-name="Dica Tabela Clientes"
                className="text-[12px]/[normal] box-border text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
              >
                {clientesFiltrados.length} cliente{clientesFiltrados.length === 1 ? '' : 's'}{' '}
                {abaAtiva === 'ativos' ? 'ativos' : 'arquivados'}
              </div>
            </div>

            {/* Container responsivo com scroll horizontal para a tabela */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[700px] w-full flex flex-col">
                {/* Colunas Clientes */}
                <div
                  data-pencil-name="Colunas Clientes"
                  className="box-border w-full h-[35.5px] shrink-0 flex flex-row gap-[14px] px-[22px] justify-start items-center border-b border-[#F0EBE4] bg-white"
                >
                  <div
                    data-pencil-name="Coluna Clientes CLIENTE"
                    className="text-[10px]/[normal] box-border w-[180px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    CLIENTE
                  </div>
                  <div
                    data-pencil-name="Coluna Clientes TELEFONE"
                    className="text-[10px]/[normal] box-border w-[110px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    TELEFONE
                  </div>
                  <div
                    data-pencil-name="Coluna Clientes E-MAIL"
                    className="text-[10px]/[normal] box-border w-[145px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    E-MAIL
                  </div>
                  <div
                    data-pencil-name="Coluna Clientes RESERVAS"
                    className="text-[10px]/[normal] box-border w-[65px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    RESERVAS
                  </div>
                  <div
                    data-pencil-name="Coluna Clientes ÚLTIMA VISITA"
                    className="text-[10px]/[normal] box-border w-[90px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    ÚLTIMA VISITA
                  </div>
                  <div
                    data-pencil-name="Coluna Clientes AÇÕES"
                    className="text-[10px]/[normal] box-border w-[50px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-bold tracking-[0.5px] text-left"
                  >
                    AÇÕES
                  </div>
                </div>

                {/* Linhas da Tabela */}
                {loading ? (
                  <div className="w-full py-12 text-center text-xs text-[#6F766F]">
                    Carregando clientes...
                  </div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="w-full py-12 text-center text-xs text-[#6F766F]">
                    Nenhum cliente encontrado.
                  </div>
                ) : (
                  clientesFiltrados.map((c, idx) => {
                    const isSelected = clienteDestaque?.id === c.id;
                    const resCount = c.reservas_count ?? c.reservasCount ?? 0;
                    const dataVisita = formatDateBR(c.ultima_visita || c.criado_em);

                    // Cores de avatar alternadas conforme Penpot
                    const avatarBg = isSelected
                      ? 'bg-[#C9FF3B] text-[#071915]'
                      : idx % 2 === 0
                      ? 'bg-[#EAF8EF] text-[#138A4B]'
                      : 'bg-[#F1EDE6] text-[#071915]';

                    return (
                      <div
                        key={c.id}
                        data-pencil-name={`Linha Cliente ${c.nome}`}
                        onClick={() => setSelectedClienteId(c.id)}
                        className={`box-border w-full min-h-[49.5px] shrink-0 flex flex-row gap-[14px] px-[22px] justify-start items-center border-b border-[#F4EFE8] cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#F7F2EA]/60' : 'hover:bg-[#FAF8F5]'
                        }`}
                      >
                        {/* Cliente Cell */}
                        <div
                          data-pencil-name={`Cliente Cell ${c.nome}`}
                          className="box-border w-[180px] shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center min-w-0"
                        >
                          <div
                            data-pencil-name={`Avatar Cliente ${c.nome}`}
                            className={`box-border w-[30px] shrink-0 h-[30px] rounded-full flex items-center justify-center font-bold text-[11px] ${avatarBg}`}
                          >
                            {c.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div
                            data-pencil-name={`Nome Cliente ${c.nome}`}
                            className="text-[13px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate"
                            title={c.nome}
                          >
                            {c.nome}
                          </div>
                        </div>

                        {/* Telefone */}
                        <div
                          data-pencil-name={`Telefone Cliente ${c.nome}`}
                          className="text-[11px]/[normal] box-border w-[110px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left truncate"
                        >
                          {c.telefone || '—'}
                        </div>

                        {/* Email */}
                        <div
                          data-pencil-name={`Email Cliente ${c.nome}`}
                          className="text-[11px]/[normal] box-border w-[145px] shrink-0 text-[#6F766F] font-[Inter,system-ui,sans-serif] font-normal text-left truncate"
                          title={c.email || ''}
                        >
                          {c.email || '—'}
                        </div>

                        {/* Reservas */}
                        <div
                          data-pencil-name={`Reservas Cliente ${c.nome}`}
                          className="text-[12px]/[normal] box-border w-[65px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left"
                        >
                          {resCount}
                        </div>

                        {/* Última Visita */}
                        <div
                          data-pencil-name={`Última Visita Cliente ${c.nome}`}
                          className="text-[11px]/[normal] box-border w-[90px] shrink-0 text-[#071915] font-[Inter,system-ui,sans-serif] font-normal text-left"
                        >
                          {dataVisita}
                        </div>

                        {/* Ações (Botão Ver) */}
                        <div
                          data-pencil-name={`Ver Cliente ${c.nome}`}
                          className="box-border w-[50px] shrink-0"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClienteId(c.id);
                              setActiveModal('detalhe-cliente');
                            }}
                            className="box-border w-[46px] shrink-0 h-[24px] flex flex-row gap-0 justify-center items-center bg-[#FFFFFF] outline outline-1 outline-[#DED6CA] -outline-offset-1 rounded-[8px] hover:bg-[#F1EDE6] transition-colors cursor-pointer"
                          >
                            <div
                              data-pencil-name={`Texto Ver Cliente ${c.nome}`}
                              className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                            >
                              Ver
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Resumo Perfil Cliente (Card Lateral em Destaque) */}
          <div
            data-pencil-name="Resumo Perfil Cliente"
            className="box-border w-full lg:w-[270px] shrink-0 h-fit flex flex-col gap-[12px] p-[18px] justify-start items-start bg-[#071915] rounded-[16px] shadow-xl text-white select-none lg:sticky lg:top-6"
          >
            <div
              data-pencil-name="Título Perfil Cliente"
              className="text-[18px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
            >
              Cliente em destaque
            </div>

            {clienteDestaque ? (
              <>
                <div
                  data-pencil-name="Avatar Perfil Cliente"
                  className="box-border w-[58px] h-[58px] shrink-0 bg-[#C9FF3B] text-[#071915] rounded-full flex items-center justify-center font-extrabold text-xl shadow-md"
                >
                  {clienteDestaque.nome.slice(0, 2).toUpperCase()}
                </div>

                <div
                  data-pencil-name="Nome Perfil Cliente"
                  className="text-[22px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap truncate max-w-full leading-tight"
                  title={clienteDestaque.nome}
                >
                  {clienteDestaque.nome}
                </div>

                <div
                  data-pencil-name="Contato Perfil Cliente"
                  className="text-[13px]/[normal] box-border text-[#D5DDD2] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap truncate max-w-full"
                >
                  {clienteDestaque.telefone || clienteDestaque.email || 'Sem telefone'}
                </div>

                {/* Linha Reservas realizadas */}
                <div
                  data-pencil-name="Info Perfil Reservas realizadas"
                  className="box-border w-full h-[34.5px] shrink-0 flex flex-row gap-0 py-[10px] justify-between items-center border-b border-[#243026]"
                >
                  <div
                    data-pencil-name="Label Perfil Reservas realizadas"
                    className="text-[12px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Reservas realizadas
                  </div>
                  <div
                    data-pencil-name="Valor Perfil Reservas realizadas"
                    className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {clienteDestaque.reservas_count ?? clienteDestaque.reservasCount ?? 0}
                  </div>
                </div>

                {/* Linha Última visita */}
                <div
                  data-pencil-name="Info Perfil Última visita"
                  className="box-border w-full h-[34.5px] shrink-0 flex flex-row gap-0 py-[10px] justify-between items-center border-b border-[#243026]"
                >
                  <div
                    data-pencil-name="Label Perfil Última visita"
                    className="text-[12px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Última visita
                  </div>
                  <div
                    data-pencil-name="Valor Perfil Última visita"
                    className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {formatDateBR(clienteDestaque.ultima_visita || clienteDestaque.criado_em)}
                  </div>
                </div>

                {/* Linha Ticket médio */}
                <div
                  data-pencil-name="Info Perfil Ticket médio"
                  className="box-border w-full h-[34.5px] shrink-0 flex flex-row gap-0 py-[10px] justify-between items-center border-b border-[#243026]"
                >
                  <div
                    data-pencil-name="Label Perfil Ticket médio"
                    className="text-[12px]/[normal] box-border text-[#AAB4A7] font-[Inter,system-ui,sans-serif] font-normal text-left whitespace-nowrap"
                  >
                    Ticket médio
                  </div>
                  <div
                    data-pencil-name="Valor Perfil Ticket médio"
                    className="text-[12px]/[normal] box-border text-[#FFFFFF] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    {formatCurrency(clienteDestaque.ticket_medio ?? 0)}
                  </div>
                </div>

                {/* Botão Abrir Perfil Cliente */}
                <button
                  data-pencil-name="Botão Abrir Perfil Cliente"
                  type="button"
                  onClick={() => {
                    setSelectedClienteId(clienteDestaque.id);
                    setActiveModal('detalhe-cliente');
                  }}
                  className="box-border w-full h-[42px] shrink-0 flex flex-row gap-0 justify-center items-center bg-[#C9FF3B] hover:bg-[#b8f028] rounded-[10px] transition-all cursor-pointer mt-1"
                >
                  <div
                    data-pencil-name="Texto Abrir Perfil Cliente"
                    className="text-[12px]/[normal] box-border text-[#071915] font-[Inter,system-ui,sans-serif] font-bold text-left whitespace-nowrap"
                  >
                    Abrir perfil completo
                  </div>
                </button>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-[#AAB4A7]">
                Nenhum cliente selecionado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: NOVO / EDITAR CLIENTE */}
      <ModalNovoCliente
        isOpen={activeModal === 'novo-cliente'}
        modoEdicao={modoEdicao}
        ncNome={ncNome}
        setNcNome={setNcNome}
        ncTelefone={ncTelefone}
        setNcTelefone={setNcTelefone}
        ncEmail={ncEmail}
        setNcEmail={setNcEmail}
        errors={errors}
        onClose={() => setActiveModal(null)}
        onSubmit={handleSalvarCliente}
      />

      {/* MODAL: DETALHE DO CLIENTE */}
      <ModalDetalheCliente
        isOpen={activeModal === 'detalhe-cliente'}
        loadingDetalhe={loadingDetalhe}
        clienteDetalhe={clienteDetalhe}
        operadorNome={userName}
        onClose={() => {
          setActiveModal(null);
        }}
        onArquivar={handleArquivarCliente}
        onDesarquivar={handleDesarquivarCliente}
        onExcluir={handleExcluirCliente}
        onEditar={abrirEdicao}
      />

    </div>
  );
}
