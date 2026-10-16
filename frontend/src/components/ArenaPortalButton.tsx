import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Share2, X } from 'lucide-react';
import { useArenaPortal } from '../hooks/useArenaPortal';

export function ArenaPortalButton() {
  const { arenaName, clientPortalUrl } = useArenaPortal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copyLink = async () => {
    if (!clientPortalUrl) return;
    await navigator.clipboard.writeText(clientPortalUrl);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2500);
  };

  const shareLink = () => {
    if (!clientPortalUrl) return;
    const message = `🏐 Agende sua quadra na ${arenaName} de forma rápida e online. Escolha o melhor horário e reserve agora:\n\n👉 ${clientPortalUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return <div className="relative">
    <button ref={trigger} type="button" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}
      className="box-border h-[34px] flex flex-row gap-[7px] px-[12px] items-center bg-[#ECFFF4] hover:bg-[#DCFCE7] transition-colors rounded-[17px] border-none cursor-pointer shadow-sm active:scale-95" title="Portal do Cliente">
      <Globe size={14} className="text-[#008A5A] shrink-0" />
      <span className="text-[12px] text-[#007A50] font-[Inter,system-ui,sans-serif] font-bold whitespace-nowrap">Portal do Cliente</span>
    </button>
    {open && <>
      <div className="fixed inset-0 z-40" role="presentation" onClick={close} />
      <div role="dialog" aria-label="Link da Sua Arena" className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-24px)] bg-[#F7F2EA] outline outline-1 outline-[#E6DED2] rounded-[16px] shadow-xl p-4 z-50 animate-scale-in">
        <div className="flex items-center justify-between border-b border-[#E6DED2] pb-2 mb-3">
          <span className="text-xs font-bold text-[#071915] flex items-center gap-1.5"><Globe size={14} className="text-[#008A5A]" />Link da Sua Arena</span>
          <button type="button" aria-label="Fechar janela do portal" onClick={close} className="text-[#6F766F] hover:text-[#071915] p-1 rounded-md"><X size={14} /></button>
        </div>
        <p className="text-[11px] text-[#4F5550] mb-2 leading-relaxed">Divulgue este link no Instagram, WhatsApp e redes da arena para seus clientes agendarem online:</p>
        <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-2.5 py-2 rounded-lg border border-[#E6DED2] mb-3">
          <input type="text" aria-label="Link do portal da arena" readOnly value={clientPortalUrl} className="flex-1 min-w-0 bg-transparent text-xs text-[#071915] font-mono outline-none truncate select-all" />
          <button type="button" onClick={copyLink} disabled={!clientPortalUrl} className="px-2 py-1 rounded bg-[#F7F2EA] hover:bg-[#EFEAE2] border border-[#E6DED2] text-[#071915] text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50">
            {copied ? <Check size={12} className="text-[#008A5A]" /> : <Copy size={12} />}<span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!clientPortalUrl} onClick={() => window.open(clientPortalUrl, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#071915] text-[#F7F2EA] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-50"><ExternalLink size={13} />Abrir Portal</button>
          <button type="button" disabled={!clientPortalUrl} onClick={shareLink} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#138A4B] text-white text-xs font-semibold hover:bg-[#0E6C3A] transition-colors disabled:opacity-50"><Share2 size={13} />WhatsApp</button>
        </div>
      </div>
    </>}
  </div>;
}
