import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ArenaPortalButton } from '../src/components/ArenaPortalButton';

it('opens the sharing window before navigating and uses the current account arena for every action', async () => {
  vi.stubGlobal('React', React);
  localStorage.setItem('arena_slug', 'arena-antiga');
  localStorage.setItem('courtmanager_user', JSON.stringify({ perfil: 'Administrador', tenant_id: 2, arena_slug: 'arena-atual', arena_nome: 'Arena atual' }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ slug: 'arena-atual', nome: 'Arena atual' }) })));
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<ArenaPortalButton />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Portal do Cliente' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Link da Sua Arena' }));
  expect(open).not.toHaveBeenCalled();
  const url = (dialog.getByRole('textbox', { name: 'Link do portal da arena' }) as HTMLInputElement).value;
  expect(url).toContain(':5176/arena/arena-atual');
  fireEvent.click(dialog.getByRole('button', { name: 'Copiar' }));
  await dialog.findByRole('button', { name: 'Copiado!' });
  expect(writeText).toHaveBeenCalledWith(url);
  fireEvent.click(dialog.getByRole('button', { name: 'Abrir Portal' }));
  expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
  fireEvent.click(dialog.getByRole('button', { name: 'WhatsApp' }));
  const shared = new URL(open.mock.calls[1][0] as string);
  expect(shared.searchParams.get('text')).toContain(url);
  expect(shared.searchParams.get('text')).toContain('Arena atual');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
