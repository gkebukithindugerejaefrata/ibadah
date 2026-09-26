// push-subscribe.js
// File ini memakai variabel global "supabaseClient" yang SUDAH dibuat
// di index.html (script utama), jadi tidak perlu bikin koneksi baru lagi.
// Pastikan script ini di-load SETELAH script utama yang membuat supabaseClient.

const VAPID_PUBLIC_KEY = 'BHvHe3hqMxY8aEAxA0ya1Y28iBxLfysZS76w7KajaKW8FHf8pXtpToD-A74bVrXtkpHyDnqRDDeq4RLt0LdFjEE';

// Utility: convert base64 VAPID key ke Uint8Array (wajib untuk pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function initPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notification tidak didukung browser ini.');
    return;
  }

  // 1. Daftarkan service worker
  const registration = await navigator.serviceWorker.register('sw.js');

  // 2. Minta izin notifikasi ke user
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Izin notifikasi ditolak.');
    return;
  }

  // 3. Cek apakah sudah subscribe sebelumnya
  let subscription = await registration.pushManager.getSubscription();

  // 4. Kalau belum, subscribe baru
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();

  // 5. Simpan/update subscription ke Supabase
  const { error } = await supabaseClient.from('push_subscriptions').upsert(
    {
      user_id: userId,               // null kalau tidak pakai auth
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('Gagal simpan subscription:', error);
  } else {
    console.log('Berhasil subscribe push notification.');
  }
}

// Contoh pemanggilan:
// initPushNotifications(currentUser?.id ?? null);
