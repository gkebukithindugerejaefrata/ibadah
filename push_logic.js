
/* ===================== push.js - Logic untuk index.html =====================
   Tempelkan ini di dalam <script> utama kamu, atau include sebagai file terpisah
*/

// 1. GANTI DENGAN VAPID PUBLIC KEY ASLI KAMU
const VAPID_PUBLIC_KEY = 'BJ9RKqnboQSSdNBu9uDW4cKncHQua8IfUoftAWQfp2uEKcp_oazv14bsfhV_OIV-5xkoacN6J6CIdjy4ZMYl_Bw';

// Helper: convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

let isSubscribed = false;
let swRegistration = null;

// 2. Register Service Worker
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported');
    return;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/ibadah/sw.js', { scope: '/ibadah/' });
    console.log('SW registered:', swRegistration);

    // Cek status subscribe
    const subscription = await swRegistration.pushManager.getSubscription();
    isSubscribed = !!subscription;
    updateBellUI(isSubscribed);

  } catch (e) {
    console.error('SW register fail', e);
  }
}

// 3. Update UI Lonceng
function updateBellUI(subscribed) {
  const badge = document.getElementById('todayBadge');
  const btn = document.getElementById('btnTodayPopup');
  if (!btn) return;

  if (subscribed) {
    btn.classList.add('!bg-emerald-900', '!text-white', '!border-emerald-900');
    btn.innerHTML = `<span class="text-[18px]">🔔</span><span class="hidden sm:inline text-[13px] font-semibold">Pengingat Aktif</span><span id="todayBadge" class="${badge?.className || ''}"></span>`;
    // simpen status biar popup tidak spam
    localStorage.setItem('gke_push_enabled', 'true');
  } else {
    btn.classList.remove('!bg-emerald-900', '!text-white', '!border-emerald-900');
    // kembalikan ke default tapi tetap ada fungsi popup
    // btn.innerHTML default handled elsewhere
    localStorage.removeItem('gke_push_enabled');
  }
}

// 4. Fungsi Subscribe
async function subscribeUser() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Izin notifikasi ditolak. Aktifkan di pengaturan browser ya.');
      return;
    }

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Simpan ke Supabase
    const { endpoint } = subscription;
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh'))));
    const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))));

    // Supabase client kamu sudah ada sebagai `supabase` global
    // Pastikan sudah ada instance supabase client
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint,
      p256dh,
      auth,
      sektor: null // bisa diisi preferensi user nanti
    }, { onConflict: 'endpoint' });

    if (error) throw error;

    isSubscribed = true;
    updateBellUI(true);
    toast('Pengingat ibadah aktif! 🙏');

    // Test notif lokal
    setTimeout(() => {
      swRegistration.showNotification('Pengingat Aktif!', {
        body: 'Kamu akan dapat pengingat H-1 dan hari H untuk jadwal ibadah.',
        icon: 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png'
      });
    }, 500);

  } catch (e) {
    console.error('Subscribe gagal', e);
    alert('Gagal mengaktifkan pengingat: ' + e.message);
  }
}

// 5. Fungsi Unsubscribe
async function unsubscribeUser() {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
    isSubscribed = false;
    updateBellUI(false);
    toast('Pengingat dimatikan');
  } catch (e) {
    console.error('Unsub gagal', e);
  }
}

// 6. Integrasi dengan tombol lonceng yang sudah ada
// GANTI listener lama btnTodayPopup kamu dengan ini:
function setupBellButton() {
  const btn = document.getElementById('btnTodayPopup');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!isSubscribed) {
      // Belum subscribe -> tawarkan subscribe
      if (confirm('Aktifkan pengingat ibadah via notifikasi? Kamu akan dapat info H-1 dan hari H.')) {
        await subscribeUser();
      } else {
        // Kalau tidak mau, tetap buka popup jadwal hari ini seperti biasa
        openTodayPopup();
      }
    } else {
      // Sudah subscribe -> buka popup + kasih opsi matikan
      openTodayPopup();
    }
  });
}

// 7. Kirim Push Saat Admin Save (panggil setelah saveForm sukses)
async function triggerPushForNewSchedule(eventData) {
  // eventData: { title, lokasi, tanggal, jam }
  try {
    // Panggil Edge Function
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        title: `Jadwal Baru: ${eventData.title}`,
        body: `${eventData.tanggal} jam ${eventData.jam} di ${eventData.lokasi}. Jangan lewatkan 🙏`,
        url: '/ibadah/#jadwal-' + eventData.id,
        tag: 'new-schedule'
      }
    });
    if (error) throw error;
    console.log('Push sent:', data);
  } catch (e) {
    console.warn('Trigger push gagal (tidak fatal):', e);
  }
}

// INIT saat load
document.addEventListener('DOMContentLoaded', () => {
  initPush().then(() => setupBellButton());
});
