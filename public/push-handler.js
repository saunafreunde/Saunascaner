// Push Notification Handler — wird via importScripts vom Workbox-SW geladen.
// Definiert push + notificationclick Event-Listener.

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : { title: 'Saunafreunde', body: '' };
  } catch {
    payload = { title: 'Saunafreunde', body: event.data?.text() ?? '' };
  }

  const title = payload.title || 'Saunafreunde Schwarzwald';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'saunafreunde',
    data: { url: payload.url || '/' },
    requireInteraction: !!payload.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
