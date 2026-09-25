// Push Notification Handler — wird via importScripts vom Workbox-SW geladen.
// Definiert push + notificationclick Event-Listener.

// Aufräumen beim Aktivieren eines neuen Service Workers (läuft je Version einmal):
// Der Laufzeit-Cache „supabase-api“ ist seit 25.09.2026 abgeschafft
// (vite.config.ts). Er konnte API-Antworten angemeldeter Nutzer enthalten und
// soll darum nicht auf den Geräten liegen bleiben, bis er irgendwann verfällt.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('supabase-api').catch(() => false));
});

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
  // Nur Ziele innerhalb dieser App öffnen (Audit 25.09.2026): eine Meldung „vom
  // Verein“ darf nie auf eine fremde Seite führen. Geprüft wird nach dem
  // Parsen — '//fremd.de' oder '/\\fremd.de' wären sonst fremde Adressen.
  let ziel;
  try {
    ziel = new URL(event.notification.data?.url || '/', self.location.origin);
  } catch {
    ziel = new URL('/', self.location.origin);
  }
  if (ziel.origin !== self.location.origin) ziel = new URL('/', self.location.origin);
  const url = ziel.href;
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
