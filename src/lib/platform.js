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
  };
}

export function setRoomUrl(roomCode) {
  if (isDesktop || typeof window === 'undefined' || !roomCode) return;
  const path = `/room/${encodeURIComponent(roomCode)}`;
  if (window.location.pathname === path && !window.location.search) return;
  const alreadyInRoomPath = /^\/room\//.test(window.location.pathname);
  const method = alreadyInRoomPath ? 'replaceState' : 'pushState';
  window.history[method]({ roomCode }, '', path);
}

export function clearRoomUrl() {
  if (isDesktop || typeof window === 'undefined') return;
  if (window.location.pathname === '/' && !window.location.search) return;
  window.history.pushState({}, '', '/');
}
