import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useArenaPortal } from '../src/hooks/useArenaPortal';
import { getArenaPortalUrl } from '../src/utils/arenaPortal';

it('uses the athlete app in development and preserves the production origin and arena', () => {
  const location = { origin: 'http://localhost:5173' } as Location;
  expect(getArenaPortalUrl('arena-a', location, true)).toBe('http://localhost:5176/arena/arena-a');
  expect(getArenaPortalUrl('arena-b', { origin: 'https://courts.example:8443' } as Location, false))
    .toBe('https://courts.example:8443/arena/arena-b');
  expect(getArenaPortalUrl('', location, true)).toBe('');
});

it('ignores another account cached slug and resolves the arena of the authenticated session', async () => {
  localStorage.setItem('arena_slug', 'conta-antiga');
  localStorage.setItem('courtmanager_user', JSON.stringify({ perfil: 'Administrador', tenant_id: 2, arena_slug: 'conta-atual' }));
  let respond!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
  const { result } = renderHook(() => useArenaPortal());
  expect(result.current.clientPortalUrl).toContain('/arena/conta-atual');
  await act(async () => respond({ ok: true, json: async () => ({ slug: 'slug-atualizado', nome: 'Arena atual' }) } as Response));
  await waitFor(() => expect(result.current.clientPortalUrl).toContain('/arena/slug-atualizado'));
  expect(result.current.arenaName).toBe('Arena atual');
});

it('does not use a demo or cached arena when the session lacks a slug and the API fails', async () => {
  localStorage.setItem('arena_slug', 'conta-antiga');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false } as Response)));
  const { result } = renderHook(() => useArenaPortal());
  await act(async () => {});
  expect(result.current.clientPortalUrl).toBe('');
});

it('does not reuse the previous tenant arena when the account changes', async () => {
  localStorage.setItem('courtmanager_user', JSON.stringify({ perfil: 'Administrador', tenant_id: 1, arena_slug: 'arena-a' }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false } as Response)));
  const { result, rerender } = renderHook(() => useArenaPortal());
  await act(async () => {});
  expect(result.current.clientPortalUrl).toContain('/arena/arena-a');
  localStorage.setItem('courtmanager_user', JSON.stringify({ perfil: 'Administrador', tenant_id: 2, arena_slug: 'arena-b' }));
  rerender();
  expect(result.current.clientPortalUrl).toContain('/arena/arena-b');
  await act(async () => {});
});
