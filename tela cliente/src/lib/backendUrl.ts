export const getBackendUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3000';

  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL as string;
  }

  const { protocol, hostname, origin } = window.location;

  // Se estiver rodando via Cloudflare Tunnel
  if (hostname.includes('trycloudflare.com') || hostname.includes('cloudflare')) {
    return origin;
  }

  // Se estiver rodando localmente (localhost ou 127.0.0.1)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
  }

  // Se estiver acessando via IP da rede local (ex: 192.168.x.x)
  return `${protocol}//${hostname}:3000`;
};

export const BACKEND_URL = getBackendUrl();
