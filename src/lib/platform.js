// Electron expõe `window.gustashare` no preload. No navegador isso não
// existe — é o jeito estável de distinguir desktop vs web sem user-agent.

export const isDesktop = typeof window !== 'undefined' && Boolean(window.gustashare);

export const DESKTOP_DOWNLOAD_URL = '/GustaShare-Portable.exe';

export function parseInviteFromUrl() {
  if (typeof window === 'undefined' || isDesktop) return null;
  const match = window.location.pathname.match(/^\/room\/([^/]+)\/?$/);
  if (!match) return null;
  return {
    roomCode: decodeURIComponent(match[1]),
    from: new URLSearchParams(window.location.search).get('from') || '',
  };
}
