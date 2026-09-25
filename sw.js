/* sw.js - Service Worker untuk Push Notif GKE Bukit Hindu */
const CACHE_NAME = 'gke-ibadah-v1';
const urlsToCache = [
  '/ibadah/',
  '/ibadah/index.html',
  '/ibadah/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

// PUSH EVENT - ini yang nampilin notif saat server push
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'Jadwal Ibadah GKE', body: event.data ? event.data.text() : 'Ada jadwal terbaru' };
  }

  const title = data.title || 'Jadwal Ibadah GKE Bukit Hindu';
  const options = {
    body: data.body || 'Jangan lewatkan persekutuan terdekat 🙏',
    icon: data.icon || 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
    badge: 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
    data: {
      url: data.url || '/ibadah/',
      eventId: data.eventId || null
    },
    vibrate: [200, 100, 200],
    tag: data.tag || 'gke-ibadah',
    renotify: true,
    actions: [
      { action: 'open', title: 'Lihat Jadwal' },
      { action: 'close', title: 'Tutup' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// KLIK NOTIFIKASI
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data.url || '/ibadah/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Jika sudah ada tab terbuka, fokusin
      for (const client of clientList) {
        if (client.url.includes('/ibadah') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Jika tidak, buka baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Optional: Local reminder check (untuk Opsi 3 fallback)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_LOCAL_REMINDER') {
    const { title, body, timestamp } = event.data;
    const delay = timestamp - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
          tag: 'local-reminder'
        });
      }, delay);
    }
  }
});
