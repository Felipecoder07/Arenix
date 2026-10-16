import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminReservas } from '../src/screens/admin/AdminReservas';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2030, 0, 10, 12, 0));
});
afterEach(() => vi.useRealTimers());

function setup({ populated = false, failed = false, occupied = false } = {}) {
  const court = { id: 7, nome: 'Quadra real', tipo: 'Areia', status: 'Ativa', hora_abertura: '08:00', hora_fechamento: '22:00', modalidades: [], preco_base: 100 };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const date = new URL(url, 'http://localhost').searchParams.get('data_inicio') || '2030-01-10';
    const rows = populated ? [
      { id: 1, quadra_id: 7, data_reserva: date, hora_inicio: '09:00', hora_fim: '10:00', cliente_nome: 'Cliente da manhã', status: 'Confirmada', status_pagamento: 'Pago', valor_total: 100, valor_pago: 100 },
      { id: 2, quadra_id: 7, data_reserva: date, hora_inicio: '13:00', hora_fim: '14:00', cliente_nome: 'Cancelamento em análise', status: 'Cancelamento pendente', status_pagamento: 'Cancelado (Pendente Estorno)', valor_total: 100, valor_pago: 100 },
      { id: 3, quadra_id: 7, data_reserva: date, hora_inicio: '15:00', hora_fim: '16:00', cliente_nome: 'Cliente real', status: 'Pendente', status_pagamento: 'Pendente', valor_total: 100, valor_pago: 0 },
    ] : [];
    const bloqueios = occupied ? [
      { id: 1, quadra_id: 7, data_bloqueio: date, hora_inicio: '08:00', hora_fim: '12:30' },
      { id: 2, quadra_id: 7, data_bloqueio: date, hora_inicio: '12:00', hora_fim: '22:00' },
    ] : [];
    return { ok: !(failed && url.includes('/grade')), status: failed && url.includes('/grade') ? 500 : 200,
      json: async () => url.includes('/grade') ? { quadras: [court], reservas: rows, bloqueios } : url === '/api/quadras' ? [court] : [] };
  }));
  render(<MemoryRouter><AdminReservas /></MemoryRouter>);
  return within(screen.getByRole('region', { name: 'Próxima reserva' }));
}

it('shows an empty agenda without fabricated customers, alerts or actions', async () => {
  const card = setup();
  await card.findByText('Nenhuma reserva a seguir');
  expect(card.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/Marina Alves|Bruno Lima|Pedro Rocha|Time Fixo/)).not.toBeInTheDocument();
  expect(screen.getByText('Nenhuma pendência de pagamento na data selecionada.')).toBeInTheDocument();
  const summary = within(screen.getByRole('region', { name: 'Resumo operacional' }));
  expect(summary.getAllByText('0')).toHaveLength(2);
  expect(summary.getByText('R$ 0,00')).toBeInTheDocument();
  expect(summary.getByText('0%')).toBeInTheDocument();
  expect(summary.getByText('0% confirmado')).toBeInTheDocument();
  expect(summary.getByText('14 horários livres')).toBeInTheDocument();
  expect(summary.getByText('Nenhum pagamento pendente')).toBeInTheDocument();
});

it('shows full occupancy and zero free slots for overlapping blocks with fractional hours', async () => {
  const card = setup({ occupied: true });
  await card.findByText('Nenhuma reserva a seguir');
  const summary = within(screen.getByRole('region', { name: 'Resumo operacional' }));
  expect(summary.getByText('100%')).toBeInTheDocument();
  expect(summary.getByText('0 horários livres')).toBeInTheDocument();
});

it('selects the next real booking and skips past times and pending cancellations', async () => {
  const card = setup({ populated: true });
  await card.findByText('15:00 · Quadra real');
  const summary = within(screen.getByRole('region', { name: 'Resumo operacional' }));
  expect(summary.getByText('3')).toBeInTheDocument();
  expect(summary.getByText('R$ 300,00')).toBeInTheDocument();
  expect(summary.getByText('67% confirmado')).toBeInTheDocument();
  expect(summary.getByText('21%')).toBeInTheDocument();
  expect(summary.getByText('11 horários livres')).toBeInTheDocument();
  expect(summary.getByText('2')).toBeInTheDocument();
  expect(card.getByText('Cliente real · pendente')).toBeInTheDocument();
  expect(card.getByRole('button', { name: 'Registrar pagamento' })).toBeEnabled();
  fireEvent.click(card.getByRole('button', { name: 'Detalhes' }));
  expect(document.querySelector('.modal-overlay.open')).toHaveTextContent('Cliente real');
});

it('uses the earliest booking on a future date and none on a past date', async () => {
  const card = setup({ populated: true });
  await card.findByText('15:00 · Quadra real');
  fireEvent.change(document.getElementById('main-date-picker')!, { target: { value: '2030-01-11' } });
  await card.findByText('09:00 · Quadra real');
  expect(card.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
  fireEvent.change(document.getElementById('main-date-picker')!, { target: { value: '2030-01-09' } });
  await card.findByText('Nenhuma reserva a seguir');
});

it('shows an unavailable agenda on API failure instead of invented or empty bookings', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const card = setup({ failed: true });
  await card.findByText('Agenda indisponível');
  const summary = within(screen.getByRole('region', { name: 'Resumo operacional' }));
  expect(summary.getAllByText('—')).toHaveLength(4);
  expect(summary.getAllByText('Dados indisponíveis')).toHaveLength(4);
  expect(card.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recarregar agenda' })).toBeEnabled();
});
