import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamRecentActivity } from '../src/components/TeamRecentActivity';

beforeEach(() => vi.stubGlobal('React', React));

it('renders only the actual actor, event and timestamp returned by the server', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ id: 7, usuario_nome: 'Ana real', evento: 'Edição de Usuário', criado_em: '2030-01-10 12:42:00' }] })));
  render(<TeamRecentActivity />);
  expect(await screen.findByText('Ana real · Edição de Usuário')).toBeInTheDocument();
  expect(screen.getByText(/10\/01\/2030/)).toBeInTheDocument();
  expect(screen.queryByText(/Hoje, 09:42|25\/09\/2026|atualizou uma reserva/)).not.toBeInTheDocument();
});

it('shows an empty activity history instead of fabricated events', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
  render(<TeamRecentActivity />);
  expect(await screen.findByText('Nenhuma atividade registrada para a equipe.')).toBeInTheDocument();
});

it('reports API errors and allows a retry', async () => {
  let failed = true;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: !failed, json: async () => [] })));
  render(<TeamRecentActivity />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Nenhuma atividade registrada para a equipe.')).toBeInTheDocument();
});
