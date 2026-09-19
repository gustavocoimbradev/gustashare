import { roomUrlSlug } from './platform.js';

const SITE = 'https://gustashare.vercel.app';
const HOME_TITLE = 'GustaShare - Compartilhe sua tela gratuitamente';
const HOME_DESCRIPTION =
  'Participe de chamadas em grupo, compartilhe sua tela, ligue sua câmera e converse com seus amigos de forma descomplicada e gratuita.';

function setMeta(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function applySeo({ title, description, path = '/' } = {}) {
  const nextTitle = title || HOME_TITLE;
  const nextDescription = description || HOME_DESCRIPTION;
  const url = `${SITE}${path}`;

  document.title = nextTitle;
  setMeta('name', 'description', nextDescription);
  setMeta('property', 'og:title', nextTitle);
  setMeta('property', 'og:description', nextDescription);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', nextTitle);
  setMeta('name', 'twitter:description', nextDescription);
  setLink('canonical', url);
}

export function seoHome() {
  applySeo({ path: '/' });
}

export function seoRoom(roomCode) {
  const code = String(roomCode || '').trim();
  applySeo({
    title: code ? `Sala ${code} · GustaShare` : HOME_TITLE,
    description: code
      ? `Você foi convidado para a sala ${code} no GustaShare. Participe da chamada, compartilhe sua tela e converse com a galera.`
      : HOME_DESCRIPTION,
    path: code ? `/room/${roomUrlSlug(code)}` : '/',
  });
}

export { SITE, HOME_TITLE, HOME_DESCRIPTION };
