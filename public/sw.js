// Service worker só pra Web Push (ver src/lib/pushNotifications.js e
// cloudflare-worker/worker.js) — sem cache/offline, de propósito: o
// GustaShare não precisa funcionar offline, só precisa de um service
// worker vivo pra receber o evento `push` mesmo com a aba fechada.

// Cópia mínima de `roomUrlSlug` (src/lib/platform.js) — o service worker
// não importa módulos do app, então duplica só o essencial. Se aquela
// função mudar, atualiza aqui também.
function roomUrlSlug(roomCode) {
  const slug = String(roomCode || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sala';
}

self.addEventListener('push', (event) => {
  let payload = { title: 'GustaShare', body: '' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload não veio em JSON — mantém o título/corpo padrão
  }

  // Sem `tag`: com uma tag fixa, a 2ª notificação em diante (outra pessoa
  // entrando numa sala, ou o convite diário chegando enquanto uma anterior
  // ainda não foi dispensada) substitui a anterior em silêncio — mesmo
  // problema do localNotifications.js, mesma causa: falta de `renotify`.
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // `data` sobrevive até o clique — usado lá embaixo pra abrir a sala
      // certa. O convite diário não tem `roomCode`, então cai no fallback ('/').
      data: { roomCode: payload.roomCode },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const roomCode = event.notification.data?.roomCode;
  const targetPath = roomCode ? `/room/${roomUrlSlug(roomCode)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const existing = clientList.find((c) => 'focus' in c);
      if (existing) {
        if ('navigate' in existing) await existing.navigate(targetPath);
        return existing.focus();
      }
      return self.clients.openWindow(targetPath);
    })
  );
});
