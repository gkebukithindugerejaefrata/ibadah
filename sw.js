// sw.js — Service Worker untuk menerima Web Push
// Taruh file ini di root domain (misal: https://situskamu.com/sw.js)
// agar scope-nya mencakup seluruh halaman.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Event ini terpanggil saat push notification diterima dari server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notifikasi', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Pemberitahuan';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',   // ganti sesuai icon kamu
    badge: data.badge || '/badge-72.png', // opsional
    image: data.image || undefined,       // gambar besar di badan notifikasi (opsional)
    data: {
      url: data.url || '/', // url yang dibuka saat notif diklik
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Event ini terpanggil saat user klik notifikasinya
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
