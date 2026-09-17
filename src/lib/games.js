export const GAMES = [
  { name: 'Gartic', url: 'https://gartic.io/', domain: 'gartic.io' },
  { name: 'StopotS', url: 'https://stopots.com/', domain: 'stopots.com' },
  { name: 'Codenames', url: 'https://codenames.game/', domain: 'codenames.game' },
  { name: 'Argumento', url: 'http://argumen.to/', domain: 'argumen.to' },
];

export function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

export function openGame(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  if (window.gustashare?.openExternal) {
    window.gustashare.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
