// Electron expõe `window.gustashare` no preload. No navegador isso não
// existe — é o jeito estável de distinguir desktop vs web sem user-agent.

export const isDesktop = typeof window !== 'undefined' && Boolean(window.gustashare);

export const DESKTOP_DOWNLOAD_URL = '/GustaShare-Setup.exe';

export function parseInviteFromUrl() {
  if (typeof window === 'undefined' || isDesktop) return null;
  const match = window.location.pathname.match(/^\/room\/([^/]+)\/?$/);
  if (!match) return null;
  return {
    roomCode: decodeURIComponent(match[1]),
  };
}

// A URL da sala é sempre um slug minúsculo, sem acento e com hífen no lugar
// de espaço (o título exibido na UI pode manter o texto original) — evita
// links feios como "League%20of%20Legends" e faz "Sala"/"sala" apontarem
// pro mesmo link.
export function roomUrlSlug(roomCode) {
  const slug = String(roomCode || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sala';
}

export function setRoomUrl(roomCode) {
  if (isDesktop || typeof window === 'undefined' || !roomCode) return;
  const path = `/room/${roomUrlSlug(roomCode)}`;
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
