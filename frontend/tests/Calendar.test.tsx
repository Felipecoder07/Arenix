import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Calendar } from '../src/components/ui/calendar';
import { DatePicker } from '../src/components/ui/date-picker';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
const january = new Date(2030, 0, 1);
const day = (number: number) => screen.getByRole('button', { name: `${number} de janeiro de 2030` });

it('supports controlled selection, including an explicitly empty selection', () => {
  const onSelect = vi.fn();
  const { rerender } = render(<Calendar defaultMonth={january} selected={new Date(2030, 0, 10)} onSelect={onSelect} />);
  fireEvent.click(day(10));
  expect(onSelect).toHaveBeenLastCalledWith(undefined);
  rerender(<Calendar defaultMonth={january} selected={undefined} onSelect={onSelect} />);
  expect(screen.getAllByRole('gridcell').every(cell => cell.getAttribute('aria-selected') === 'false')).toBe(true);
  fireEvent.click(day(12));
  expect(onSelect).toHaveBeenLastCalledWith(new Date(2030, 0, 12));
});

it('toggles multiple dates and orders a range selected backwards', () => {
  const multiple = vi.fn();
  const { unmount } = render(<Calendar mode="multiple" defaultMonth={january} onSelect={multiple} />);
  fireEvent.click(day(10));
  fireEvent.click(day(12));
  fireEvent.click(day(10));
  expect(multiple).toHaveBeenLastCalledWith([new Date(2030, 0, 12)]);
  unmount();
  const range = vi.fn();
  render(<Calendar mode="range" defaultMonth={january} onSelect={range} />);
  fireEvent.click(day(15));
  fireEvent.click(day(10));
  expect(range).toHaveBeenLastCalledWith({ from: new Date(2030, 0, 10), to: new Date(2030, 0, 15) });
});

it('disables booked and restricted days and exposes event labels', () => {
  render(<Calendar defaultMonth={january} bookedDates={[new Date(2030, 0, 10)]} disabled={date => date.getDate() === 11} events={[{ date: new Date(2030, 0, 12), label: 'Torneio' }]} />);
  expect(day(10)).toBeDisabled();
  expect(day(10)).toHaveClass('line-through');
  expect(day(11)).toBeDisabled();
  expect(day(12)).toHaveAttribute('title', 'Torneio');
});

it('navigates years and months using the quick pickers', async () => {
  render(<Calendar defaultMonth={january} />);
  fireEvent.click(screen.getByRole('button', { name: 'Escolher ano' }));
  fireEvent.click(await screen.findByRole('button', { name: '2032' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Fevereiro', exact: true }));
  expect(await screen.findByRole('grid', { name: 'Fevereiro 2032' })).toBeInTheDocument();
});

it('keeps keyboard focus across months and skips disabled days', async () => {
  render(<Calendar defaultMonth={january} disabled={date => date.getMonth() === 1 && date.getDate() === 1} />);
  day(31).focus();
  fireEvent.keyDown(day(31), { key: 'ArrowRight' });
  await waitFor(() => expect(screen.getByRole('button', { name: '2 de fevereiro de 2030' })).toHaveFocus());
});

it('opens above a modal, respects bounds and updates an ISO form date without submitting', async () => {
  const submit = vi.fn();
  function Form() {
    const [value, setValue] = React.useState('2030-01-10');
    return <form onSubmit={submit}><label htmlFor="date">Data da reserva</label><DatePicker id="date" value={value} onValueChange={setValue} min="2030-01-10" max="2030-01-20" required /></form>;
  }
  render(<Form />);
  const input = screen.getByLabelText('Data da reserva');
  fireEvent.click(input);
  const popup = screen.getByRole('dialog', { name: 'Escolher data' });
  expect(popup.parentElement).toBe(document.body);
  expect(day(9)).toBeDisabled();
  expect(day(21)).toBeDisabled();
  expect(within(popup).queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument();
  fireEvent.click(day(15));
  expect(input).toHaveValue('2030-01-15');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(submit).not.toHaveBeenCalled();
});

it('confirms an already selected required date and closes on Escape without closing its parent', () => {
  const changed = vi.fn();
  const parentKeyDown = vi.fn();
  render(<div onKeyDown={parentKeyDown}><DatePicker aria-label="Data" value="2030-01-10" onValueChange={changed} required /></div>);
  fireEvent.click(screen.getByLabelText('Data'));
  fireEvent.click(day(10));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Data')).toHaveValue('2030-01-10');
  fireEvent.click(screen.getByLabelText('Data'));
  fireEvent.keyDown(day(10), { key: 'Escape' });
  expect(parentKeyDown).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
