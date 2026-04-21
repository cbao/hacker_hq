function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function defaultHttpBase(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

function defaultWsBase(): string {
  return defaultHttpBase().replace(/^http/i, 'ws');
}

export const API_BASE_URL = stripTrailingSlash(
  import.meta.env.VITE_API_BASE_URL ?? defaultHttpBase()
);

export const WS_BASE_URL = stripTrailingSlash(
  import.meta.env.VITE_WS_URL ?? defaultWsBase()
);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function wsUrl(path = ''): string {
  if (!path) return WS_BASE_URL;
  return `${WS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
