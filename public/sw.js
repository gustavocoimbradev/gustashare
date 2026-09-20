// Service worker só pra Web Push (ver src/lib/pushNotifications.js e
// cloudflare-worker/worker.js) — sem cache/offline, de propósito: o
// GustaShare não precisa funcionar offline, só precisa de um service
// worker vivo pra receber o evento `push` mesmo com a aba fechada.

self.addEventListener('push', (event) => {
  let payload = { title: 'GustaShare', body: '' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload não veio em JSON — mantém o título/corpo padrão
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'gustashare-notification',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
