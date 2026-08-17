export const getBackendUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3000';

  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL as string;
  }

  const { protocol, hostname } = window.location;

  if (hostname.includes('trycloudflare.com')) {
    return 'https://industry-simpson-universal-dealing.trycloudflare.com';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return `${protocol}//${hostname}:3000`;
};

export const BACKEND_URL = getBackendUrl();
