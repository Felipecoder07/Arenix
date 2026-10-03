import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminReservas } from '../src/screens/admin/AdminReservas';

describe('block form', () => {
  it('loads the chosen date and clears the selection when that day is full', async () => {
    vi.stubGlobal('React', React);
    const court = { id: 1, nome: 'Quadra A', tipo: 'Areia', status: 'Ativa', hora_abertura: '08:00', hora_fechamento: '22:00', modalidades: [], preco_base: 100 };
    const fetchMock = vi.fn(async (input: string) => {
      const url = String(input);
      const full = url.includes('data=2099-12-02');
      const data = url.includes('/grade') ? { quadras: [court], reservas: [], bloqueios: full ? [{ id: 1, quadra_id: 1, data_bloqueio: '2099-12-02', hora_inicio: '08:00', hora_fim: '22:00', motivo: 'Evento' }] : [] } : url === '/api/quadras' ? [court] : [];
      return { ok: true, status: 200, json: async () => data };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><AdminReservas /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/quadras', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: /Bloquear quadra/i }));
    fireEvent.change(document.getElementById('bq-data')!, { target: { value: '2099-12-01' } });
    const start = document.getElementById('bq-inicio')!;
    const end = document.getElementById('bq-fim')!;
    await waitFor(() => expect(start).not.toBeDisabled());
    fireEvent.change(start, { target: { value: '14:00' } });
    fireEvent.change(end, { target: { value: '18:00' } });
    expect(screen.getByRole('button', { name: /Confirmar bloqueio/i })).toBeEnabled();
    fireEvent.change(document.getElementById('bq-data')!, { target: { value: '2099-12-02' } });
    await screen.findByText('Nenhum horário disponível nesta data.');
    expect(start).toHaveValue('');
    expect(end).toHaveValue('');
    expect(screen.getByRole('button', { name: /Confirmar bloqueio/i })).toBeDisabled();
  });
});
