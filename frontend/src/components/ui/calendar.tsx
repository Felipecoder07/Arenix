"use client";

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import './calendar.css';

export type CalendarMode = 'single' | 'range' | 'multiple';
export interface DateRange { from?: Date; to?: Date }
export interface CalendarEvent { date: Date; label?: string }
interface CalendarSharedProps {
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  weekStartsOn?: 0 | 1;
  disabled?: (date: Date) => boolean;
  bookedDates?: Date[];
  events?: CalendarEvent[];
  quickNav?: boolean;
  className?: string;
}
interface CalendarSingleProps extends CalendarSharedProps {
  mode?: 'single'; selected?: Date; defaultSelected?: Date;
  onSelect?: (date: Date | undefined) => void;
}
interface CalendarMultipleProps extends CalendarSharedProps {
  mode: 'multiple'; selected?: Date[]; defaultSelected?: Date[];
  onSelect?: (dates: Date[]) => void;
}
interface CalendarRangeProps extends CalendarSharedProps {
  mode: 'range'; selected?: DateRange; defaultSelected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
}
export type CalendarProps = CalendarSingleProps | CalendarMultipleProps | CalendarRangeProps;

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const controlClass = 'calendar-control flex size-7 shrink-0 items-center justify-center rounded-[10px]';
const pickerClass = 'calendar-control flex h-10 items-center justify-center rounded-[10px] text-[13px]';

function sameDay(a?: Date, b?: Date) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function before(a: Date, b: Date) { return startOfDay(a).getTime() < startOfDay(b).getTime(); }
function withinRange(date: Date, range?: DateRange) {
  if (!range?.from || !range.to) return false;
  const t = startOfDay(date).getTime();
  const from = startOfDay(range.from).getTime();
  const to = startOfDay(range.to).getTime();
  return t > Math.min(from, to) && t < Math.max(from, to);
}
function buildMonthGrid(month: Date, weekStartsOn: 0 | 1) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(1 - ((start.getDay() - weekStartsOn + 7) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function QuickNavTooltip({ label, disabled, children }: { label: string; disabled?: boolean; children: React.ReactElement }) {
  if (disabled) return children;
  return <span className="group/tip relative inline-flex">
    {children}
    <span aria-hidden="true" className="calendar-tooltip pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-[10px] px-1.5 py-0.5 text-[10.5px] font-medium opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-active/tip:!opacity-0">{label}</span>
  </span>;
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>((props, ref) => {
  const { mode = 'single', month: controlledMonth, defaultMonth, onMonthChange, weekStartsOn = 0,
    disabled, bookedDates, events, quickNav = true, className } = props;
  const reducedMotion = useReducedMotion();
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [internalMonth, setInternalMonth] = React.useState(() => startOfDay(defaultMonth ?? controlledMonth ?? new Date()));
  const displayedMonth = controlledMonth ?? internalMonth;
  const [navView, setNavView] = React.useState<'days' | 'months' | 'years'>('days');
  const [direction, setDirection] = React.useState(1);
  const [yearAnchor, setYearAnchor] = React.useState(displayedMonth.getFullYear());
  const [internalSelection, setInternalSelection] = React.useState<Date | Date[] | DateRange | undefined>(props.defaultSelected);
  // An explicit selected={undefined} is a controlled, empty selection.
  const controlled = Object.prototype.hasOwnProperty.call(props, 'selected');
  const selection = controlled ? props.selected : internalSelection;
  const single = mode === 'single' ? selection as Date | undefined : undefined;
  const multiple = mode === 'multiple' ? (selection ?? []) as Date[] : [];
  const range = mode === 'range' ? selection as DateRange | undefined : undefined;
  const dayGridRef = React.useRef<HTMLDivElement>(null);
  const pendingFocus = React.useRef<Date | null>(null);
  const [focusedDate, setFocusedDate] = React.useState<Date>();

  const isBooked = (date: Date) => bookedDates?.some(d => sameDay(d, date)) ?? false;
  const isDisabled = (date: Date) => isBooked(date) || (disabled?.(date) ?? false);
  const setMonth = (next: Date, dir: number) => {
    setDirection(dir);
    if (controlledMonth === undefined) setInternalMonth(next);
    onMonthChange?.(next);
  };
  const openYears = () => { setYearAnchor(displayedMonth.getFullYear()); setNavView('years'); };
  const restoreFocus = () => {
    if (!pendingFocus.current) return;
    const target = dayGridRef.current?.querySelector<HTMLButtonElement>(`[data-date-key="${pendingFocus.current.toDateString()}"]`);
    if (target) { target.focus(); pendingFocus.current = null; }
  };
  React.useEffect(restoreFocus, [displayedMonth]);

  function selectDay(date: Date) {
    if (isDisabled(date)) return;
    if (mode === 'single') {
      const next = sameDay(single, date) ? undefined : date;
      if (!controlled) setInternalSelection(next);
      (props as CalendarSingleProps).onSelect?.(next);
    } else if (mode === 'multiple') {
      const next = multiple.some(d => sameDay(d, date)) ? multiple.filter(d => !sameDay(d, date)) : [...multiple, date];
      if (!controlled) setInternalSelection(next);
      (props as CalendarMultipleProps).onSelect?.(next);
    } else {
      const next = !range?.from || range.to ? { from: date } : before(date, range.from) ? { from: date, to: range.from } : { from: range.from, to: date };
      if (!controlled) setInternalSelection(next);
      (props as CalendarRangeProps).onSelect?.(next);
    }
  }

  const grid = React.useMemo(() => buildMonthGrid(displayedMonth, weekStartsOn), [displayedMonth, weekStartsOn]);
  const weeks = Array.from({ length: 6 }, (_, index) => grid.slice(index * 7, index * 7 + 7));
  const weekdayLabels = weekStartsOn === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;
  const focusableDate = [focusedDate, single, today, ...grid].find(date => date && sameMonth(date, displayedMonth) && !isDisabled(date));
  const monthLabel = `${MONTH_NAMES[displayedMonth.getMonth()]} ${displayedMonth.getFullYear()}`;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const current = new Date((e.target as HTMLElement).dataset.date ?? '');
    if (Number.isNaN(current.getTime())) return;
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target: Date | undefined;
    if (e.key in deltas) {
      target = new Date(current);
      target.setDate(current.getDate() + deltas[e.key]);
    } else if (e.key === 'Home' || e.key === 'End') {
      target = new Date(current);
      const day = (current.getDay() - weekStartsOn + 7) % 7;
      target.setDate(current.getDate() + (e.key === 'Home' ? -day : 6 - day));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      target = addMonths(current, e.key === 'PageUp' ? -1 : 1);
      target.setDate(Math.min(current.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    }
    if (!target) return;
    e.preventDefault();
    const step = before(target, current) ? -1 : 1;
    // Bounded search: an entirely disabled calendar must never trap the browser.
    for (let i = 0; isDisabled(target) && i < 366; i++) target.setDate(target.getDate() + step);
    if (isDisabled(target)) return;
    setFocusedDate(target);
    if (!sameMonth(target, displayedMonth)) {
      pendingFocus.current = target;
      setMonth(addMonths(target, 0), step);
    } else {
      dayGridRef.current?.querySelector<HTMLButtonElement>(`[data-date-key="${target.toDateString()}"]`)?.focus();
    }
  }

  return <div ref={ref} data-slot="calendar" data-mode={mode} className={cn('arena-calendar w-full max-w-[300px] select-none rounded-2xl border p-3', className)}>
    <div className="sr-only" aria-live="polite" aria-atomic="true">{monthLabel}</div>
    <div className="mb-2 flex items-center justify-between gap-1">
      <button type="button" aria-label="Mês anterior" onClick={() => setMonth(addMonths(displayedMonth, -1), -1)} className={controlClass}><ChevronLeft size={16} strokeWidth={1.9} /></button>
      <div className="flex items-center gap-0.5">
        <QuickNavTooltip label="Escolher mês" disabled={!quickNav}>
          <button type="button" disabled={!quickNav} aria-label="Escolher mês" onClick={() => setNavView('months')} className={cn('calendar-control rounded-[10px] px-1.5 py-1 text-[13px] font-medium', navView === 'months' && 'calendar-soft-selected')}>{MONTH_NAMES[displayedMonth.getMonth()]}</button>
        </QuickNavTooltip>
        <QuickNavTooltip label="Navegação rápida" disabled={!quickNav}>
          <button type="button" disabled={!quickNav} aria-label="Alternar seleção de mês ou ano" onClick={() => navView === 'months' ? openYears() : setNavView('months')} className="calendar-control rounded-[10px] px-0.5 py-1 text-[13px] opacity-40">|</button>
        </QuickNavTooltip>
        <QuickNavTooltip label="Escolher ano" disabled={!quickNav}>
          <button type="button" disabled={!quickNav} aria-label="Escolher ano" onClick={openYears} className={cn('calendar-control rounded-[10px] px-1.5 py-1 text-[13px] font-medium', navView === 'years' && 'calendar-soft-selected')}>{displayedMonth.getFullYear()}</button>
        </QuickNavTooltip>
      </div>
      <button type="button" aria-label="Próximo mês" onClick={() => setMonth(addMonths(displayedMonth, 1), 1)} className={controlClass}><ChevronRight size={16} strokeWidth={1.9} /></button>
    </div>
    <div className="relative overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        {navView === 'days' && <motion.div key={`${displayedMonth.getFullYear()}-${displayedMonth.getMonth()}`} custom={direction}
          initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reducedMotion ? 0 : direction * -12 }}
          onAnimationComplete={restoreFocus} transition={{ duration: reducedMotion ? 0.12 : 0.18, ease: EASE_OUT }}>
          <div className="mb-1 grid grid-cols-7">{weekdayLabels.map(label => <div key={label} className="calendar-muted flex h-7 items-center justify-center text-[11px] font-medium">{label}</div>)}</div>
          <div ref={dayGridRef} role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-y-0.5" onKeyDown={handleKeyDown}>
            {weeks.map(week => <div key={week[0].toISOString()} role="row" className="contents">
              {week.map(date => {
                const booked = isBooked(date);
                const dayDisabled = isDisabled(date);
                const rangeStart = sameDay(range?.from, date);
                const rangeEnd = sameDay(range?.to, date);
                const selected = mode === 'single' ? sameDay(single, date) : mode === 'multiple' ? multiple.some(d => sameDay(d, date)) : rangeStart || rangeEnd;
                const event = events?.find(item => sameDay(item.date, date));
                return <div key={date.toISOString()} role="gridcell" aria-selected={selected} className="relative flex h-8 items-center justify-center">
                  {mode === 'range' && range?.from && range.to && !sameDay(range.from, range.to) && (withinRange(date, range) || rangeStart || rangeEnd) && <div className={cn('calendar-soft-selected absolute inset-y-0', rangeStart ? 'left-1/2 right-0' : rangeEnd ? 'left-0 right-1/2' : 'inset-x-0')} />}
                  <button type="button" disabled={dayDisabled} aria-label={date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} aria-current={sameDay(date, today) ? 'date' : undefined}
                    title={event?.label} data-date={date.toISOString()} data-date-key={date.toDateString()} tabIndex={sameDay(date, focusableDate) ? 0 : -1}
                    onFocus={() => setFocusedDate(date)} onClick={() => selectDay(date)}
                    className={cn('calendar-day relative z-10 flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums',
                      !sameMonth(date, displayedMonth) && 'calendar-outside', selected && 'calendar-selected', sameDay(date, today) && !selected && 'calendar-today',
                      dayDisabled && !booked && 'opacity-30', booked && 'line-through opacity-50')}>
                    {date.getDate()}{event && !selected && <span className="absolute bottom-0.5 size-1 rounded-full bg-sky-500" />}
                  </button>
                </div>;
              })}
            </div>)}
          </div>
        </motion.div>}
        {navView === 'months' && <motion.div key="months" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.15, ease: EASE_OUT }} className="grid grid-cols-3 gap-1 py-1">
          {MONTH_NAMES.map((name, index) => <button key={name} type="button" aria-label={name} onClick={() => { setMonth(new Date(displayedMonth.getFullYear(), index, 1), 1); setNavView('days'); }} className={cn(pickerClass, index === displayedMonth.getMonth() && 'calendar-selected')}>{name.slice(0, 3)}</button>)}
        </motion.div>}
        {navView === 'years' && <motion.div key="years" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.15, ease: EASE_OUT }}>
          <div className="mb-1 flex items-center justify-between px-0.5">
            <button type="button" aria-label="Anos anteriores" onClick={() => setYearAnchor(y => y - 12)} className={controlClass}><ChevronLeft size={16} /></button>
            <span className="calendar-muted text-[11px] font-medium">{yearAnchor - 5}–{yearAnchor + 6}</span>
            <button type="button" aria-label="Próximos anos" onClick={() => setYearAnchor(y => y + 12)} className={controlClass}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1">{Array.from({ length: 12 }, (_, i) => yearAnchor - 5 + i).map(year => <button key={year} type="button" onClick={() => { setMonth(new Date(year, displayedMonth.getMonth(), 1), 1); setNavView('months'); }} className={cn(pickerClass, 'tabular-nums', year === displayedMonth.getFullYear() && 'calendar-selected')}>{year}</button>)}</div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </div>;
});
Calendar.displayName = 'Calendar';
