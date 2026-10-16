import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { getStoredUser } from '../utils/session';
import { safeStorage } from '../utils/safeStorage';
import { getArenaPortalUrl } from '../utils/arenaPortal';

export function useArenaPortal() {
  const user = getStoredUser();
  const tenantId = user?.tenant_id;
  const sessionSlug = (typeof user?.arena_slug === 'string' && user.arena_slug.trim())
    ? user.arena_slug
    : (safeStorage.getItem('arena_slug') || '');
  const sessionName = (typeof user?.arena_nome === 'string' && user.arena_nome.trim())
    ? user.arena_nome
    : (safeStorage.getItem('arena_nome') || '');
  const [arena, setArena] = useState({ tenantId, slug: sessionSlug, name: sessionName });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const storedName = safeStorage.getItem('arena_nome');
      const storedSlug = safeStorage.getItem('arena_slug');
      if (storedName || storedSlug) {
        setArena((prev) => ({
          ...prev,
          name: storedName || prev.name,
          slug: storedSlug || prev.slug
        }));
      }
      try {
        const response = await apiFetch('/api/arenas/minha');
        if (!response.ok) return;
        const data = await response.json();
        if (active && typeof data.slug === 'string' && data.slug.trim()) {
          const nextSlug = data.slug;
          const nextName = typeof data.nome === 'string' && data.nome.trim() ? data.nome : sessionName;
          safeStorage.setItem('arena_slug', nextSlug);
          if (nextName) safeStorage.setItem('arena_nome', nextName);
          setArena({ tenantId, slug: nextSlug, name: nextName });
        }
      } catch { /* Keep the arena from the current authenticated session. */ }
    };
    void refresh();
    window.addEventListener('arena_nome_changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('arena_nome_changed', refresh);
    };
  }, [tenantId, sessionSlug, sessionName]);

  const current = arena.tenantId === tenantId ? arena : { slug: sessionSlug, name: sessionName };
  return { arenaName: current.name, clientPortalUrl: getArenaPortalUrl(current.slug) };
}
