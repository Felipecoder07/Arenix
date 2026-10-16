import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminConfiguracoesQuadras } from '../src/screens/admin/AdminConfiguracoesQuadras';

it('preloads the remaining tabs and preserves edits without refetching on navigation', async () => {
  window.history.replaceState({}, '', '/admin/configuracoes?aba=quadras');
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url === '/api/arenas/minha' ? { nome: 'Arena original', notif_reserva_email: 1, notif_cancelamento_email: 1, notif_pagamento_email: 1 }
      : url === '/api/motivos/estatisticas' ? { mes: { total: 0, valorTotal: 0 }, ultimos30Dias: { total: 0, porMotivo: [] } }
      : url === '/api/quadras' || url === '/api/motivos' ? [] : {};
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminConfiguracoesQuadras />);
  await waitFor(() => expect(screen.getByLabelText('Nome da arena *')).toHaveValue('Arena original'));
  const requests = () => fetchMock.mock.calls.filter(([url]) => ['/api/arenas/minha', '/api/motivos', '/api/motivos/estatisticas'].includes(String(url))).length;
  const initialRequests = requests();
  const tabs = within(document.querySelector('[data-pencil-name="Menu Interno Configurações"]') as HTMLElement);
  fireEvent.click(tabs.getByRole('button', { name: 'Arena', exact: true }));
  fireEvent.change(screen.getByLabelText('Nome da arena *'), { target: { value: 'Rascunho da arena' } });
  fireEvent.click(tabs.getByRole('button', { name: 'Notificações', exact: true }));
  await screen.findByRole('heading', { name: 'Notificações' });
  fireEvent.click(screen.getAllByRole('switch')[0]);
  expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(tabs.getByRole('button', { name: 'Cancelamentos', exact: true }));
  fireEvent.click(tabs.getByRole('button', { name: 'Arena', exact: true }));
  expect(screen.getByLabelText('Nome da arena *')).toHaveValue('Rascunho da arena');
  fireEvent.click(tabs.getByRole('button', { name: 'Notificações', exact: true }));
  expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false');
  expect(screen.queryByText('Carregando notificações...')).not.toBeInTheDocument();
  expect(requests()).toBe(initialRequests);
});
