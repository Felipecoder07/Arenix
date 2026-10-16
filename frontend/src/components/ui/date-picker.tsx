import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Calendar } from './calendar';
import { cn } from '../../lib/utils';

type DatePickerProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'defaultValue'> & {
  value?: string;
  onValueChange: (value: string) => void;
};

function parseDate(value?: string | number) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Preserves ISO form values and native validation, with a shared calendar popup. */
export function DatePicker({ value = '', onValueChange, className, min, max, disabled, onClick, onKeyDown, ...props }: DatePickerProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const popup = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const dialogId = React.useId();
  const selected = parseDate(value);
  const minimum = parseDate(min);
  const maximum = parseDate(max);

  const close = React.useCallback(() => {
    setOpen(false);
    input.current?.focus();
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(300, window.innerWidth - 16);
      const height = popup.current?.getBoundingClientRect().height || 340;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      });
    };
    reposition();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && event.target !== input.current) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    const frame = requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, close]);

  return <>
    <input {...props} ref={input} type="date" value={value} min={min} max={max} disabled={disabled}
      aria-label={props['aria-label'] || props.title || (props.id ? undefined : 'Selecionar data')}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
      className={cn('arena-date-input', className)}
      onChange={event => onValueChange(event.target.value)}
      onClick={event => { event.preventDefault(); onClick?.(event); if (!disabled) setOpen(true); }}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); if (!disabled) setOpen(true); }
      }} />
    {open && createPortal(<div ref={popup} id={dialogId} role="dialog" aria-label="Escolher data" className="fixed z-[10000] w-[300px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-auto rounded-2xl bg-white shadow-xl" style={position}
      onClick={event => event.stopPropagation()}
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== input.current) setOpen(false); }}>
      <Calendar selected={selected} defaultMonth={selected ?? minimum ?? new Date()}
        disabled={date => (!!minimum && date < minimum) || (!!maximum && date > maximum)}
        onSelect={date => {
          // Clicking the current day confirms it; required fields never clear accidentally.
          if (date) onValueChange(formatDate(date));
          close();
        }} />
      <div className="flex items-center justify-between px-3 pb-2 text-xs text-[#6F766F]">
        {!props.required ? <button type="button" onClick={() => { onValueChange(''); close(); }} className="rounded px-2 py-1 hover:bg-[#F1EDE6]">Limpar</button> : <span />}
        <button type="button" onClick={close} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-[#F1EDE6]"><X size={12} />Fechar</button>
      </div>
    </div>, document.body)}
  </>;
}
