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

  updateNotifButtonUI(true);
}

// Matikan notifikasi: unsubscribe dari browser + hapus dari Supabase
async function unsubscribePushNotifications() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration('sw.js');
  if (!registration) { updateNotifButtonUI(false); return; }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) { updateNotifButtonUI(false); return; }

  const endpoint = subscription.endpoint;

  try {
    await subscription.unsubscribe();
  } catch (e) {
    console.error('Gagal unsubscribe dari browser:', e);
  }

  const { error } = await supabaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) console.error('Gagal hapus subscription dari database:', error);

  updateNotifButtonUI(false);
}

// Cek status subscription saat halaman dibuka, sesuaikan tampilan tombol
async function checkNotifStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration('sw.js');
    if (!registration) { updateNotifButtonUI(false); return; }

    const subscription = await registration.pushManager.getSubscription();
    updateNotifButtonUI(!!subscription && Notification.permission === 'granted');
  } catch (e) {
    updateNotifButtonUI(false);
  }
}

// Ubah tampilan switch sesuai status aktif/tidak
function updateNotifButtonUI(isActive) {
  const btn = document.getElementById('btn-aktifkan-notif');
  if (!btn) return;
  const thumb = btn.querySelector('.notif-thumb');

  btn.dataset.active = isActive ? 'true' : 'false';
  btn.setAttribute('aria-checked', isActive ? 'true' : 'false');

  if (isActive) {
    btn.classList.remove('bg-stone-300');
    btn.classList.add('bg-emerald-600');
    if (thumb) { thumb.classList.remove('translate-x-1'); thumb.classList.add('translate-x-6'); }
  } else {
    btn.classList.remove('bg-emerald-600');
    btn.classList.add('bg-stone-300');
    if (thumb) { thumb.classList.remove('translate-x-6'); thumb.classList.add('translate-x-1'); }
  }
}

// Toggle: kalau sedang aktif -> matikan, kalau belum -> aktifkan
async function toggleNotifikasi(userId) {
  const btn = document.getElementById('btn-aktifkan-notif');
  const isActive = btn?.dataset.active === 'true';
  if (isActive) {
    await unsubscribePushNotifications();
  } else {
    await initPushNotifications(userId ?? null);
  }
}
