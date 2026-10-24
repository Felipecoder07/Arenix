import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminReservas } from '../src/screens/admin/AdminReservas';

afterEach(() => vi.unstubAllGlobals());

it('uses configured cancellation reasons and sends the selected identifier', async () => {
  vi.stubGlobal('React', React);
  const court = { id: 1, nome: 'Quadra A', tipo: 'Areia', status: 'Ativa', hora_abertura: '08:00', hora_fechamento: '22:00', modalidades: [], preco_base: 100 };
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const reservation = { id: 1, quadra_id: 1, cliente_nome: 'Cliente Cancelamento', data_reserva: today, hora_inicio: '10:00', hora_fim: '11:00', valor_total: 100, valor_pago: 0, status: 'Confirmada', status_pagamento: 'Pendente' };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = url.includes('/grade') ? { quadras: [court], reservas: [reservation], bloqueios: [] }
      : url === '/api/quadras' ? [court]
      : url === '/api/motivos' ? [{ id: -1, motivo: 'Desistência do Cliente' }, { id: 12, motivo: 'Evento remarcado' }]
      : init?.method === 'PATCH' ? { message: 'Reserva cancelada.' } : [];
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><AdminReservas /></MemoryRouter>);
  fireEvent.click((await screen.findAllByText('Cliente Cancelamento'))[0]);
  fireEvent.click(within(document.querySelector('.modal-overlay.open') as HTMLElement).getByRole('button', { name: 'Cancelar', exact: true }));
  await screen.findByRole('option', { name: 'Evento remarcado' });
  fireEvent.change(screen.getByLabelText('Motivo do cancelamento *'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cancelamento' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) =>
    url === '/api/reservas/1/cancelar' && JSON.parse(String(init?.body)).motivo === 12
  )).toBe(true));
});
