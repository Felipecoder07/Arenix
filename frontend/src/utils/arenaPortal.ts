export function getArenaPortalUrl(slug: string, location = window.location, development = import.meta.env.DEV): string {
  if (!slug.trim()) return '';
  const origin = new URL(location.origin);
  if (development) origin.port = '5176';
  return `${origin.origin}/arena/${encodeURIComponent(slug.trim())}`;
}
