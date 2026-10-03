import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminReservas } from '../src/screens/admin/AdminReservas';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem('grade_interval');
});

test('grade de reservas usa linhas de 30 minutos quando a arena escolhe esse intervalo', async () => {
  window.localStorage.setItem('grade_interval', '30');
  const quadra = {
    id: 1, nome: 'Quadra teste', tipo: 'Areia', status: 'Ativa',
    hora_abertura: '08:00', hora_fechamento: '10:00', modalidades: [], preco_base: 100,
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/grade') ? { quadras: [quadra], reservas: [], bloqueios: [] }
      : url === '/api/quadras' ? [quadra] : [];
    return { ok: true, status: 200, json: async () => body };
  }));

  render(<MemoryRouter><AdminReservas /></MemoryRouter>);
  await waitFor(() => expect(
    [...document.querySelectorAll('[style*="grid-column: 1"][style*="grid-row:"]')]
      .some(element => element.textContent?.trim() === '08:30'),
  ).toBe(true));
});
