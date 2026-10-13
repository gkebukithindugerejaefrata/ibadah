// push-subscribe.js - FIX CHROME MOBILE & PWA - gesture-safe
console.log('push-subscribe.js CHROME-MOBILE FIX loaded');

function isPWA(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || document.referrer.includes('android-app://');
}

function updateNotifUI(active){
  const btn = document.getElementById('btn-aktifkan-notif');
  const wrap = document.getElementById('notifWrap');
  if(!btn) return;
  const thumb = btn.querySelector('.notif-thumb');
  if(active){
    btn.dataset.active="true";
    btn.setAttribute('aria-checked','true');
    btn.classList.remove('bg-stone-300');
    btn.classList.add('bg-emerald-600');
    if(thumb){ thumb.classList.remove('translate-x-1'); thumb.classList.add('translate-x-6'); }
    if(wrap){ wrap.classList.add('border-emerald-300','bg-emerald-50'); }
  }else{
    btn.dataset.active="false";
    btn.setAttribute('aria-checked','false');
    btn.classList.remove('bg-emerald-600');
    btn.classList.add('bg-stone-300');
    if(thumb){ thumb.classList.remove('translate-x-6'); thumb.classList.add('translate-x-1'); }
    if(wrap){ wrap.classList.remove('border-emerald-300','bg-emerald-50'); }
  }
}

function checkNotifStatus(){
  if(!('Notification' in window)){
    console.log('[Notif] no Notification API');
    updateNotifUI(false);
    return;
  }
  const perm = Notification.permission;
  const localEnabled = localStorage.getItem('gke_notif_enabled')==='true';
  console.log('[Notif] check - PWA:', isPWA(), 'perm:', perm, 'local:', localEnabled, 'isSecure:', window.isSecureContext);
  if(perm==='granted' && localEnabled){
    updateNotifUI(true);
  }else{
    updateNotifUI(false);
  }
}

// Fungsi aktifkan setelah granted - dipisah biar bisa dipanggil setelah requestPermission
async function activateNotif(){
  try{
    if('serviceWorker' in navigator){
      try{
        let reg = await navigator.serviceWorker.getRegistration();
        if(!reg){
          reg = await navigator.serviceWorker.register('sw.js', {scope:'./'});
          console.log('[Notif] SW registered');
        }
        await navigator.serviceWorker.ready;
      }catch(e){ console.warn('SW fail', e); }
    }
    localStorage.setItem('gke_notif_enabled','true');
    updateNotifUI(true);
    if(typeof toast==='function') toast('Notifikasi aktif ✓' + (isPWA()?' (PWA)':''));
    else alert('Notifikasi aktif');

    // Test notif
    setTimeout(async ()=>{
      try{
        if(Notification.permission==='granted'){
          if('serviceWorker' in navigator){
            const reg = await navigator.serviceWorker.ready;
            if(reg && reg.showNotification){
              await reg.showNotification('GKE Bukit Hindu', {
                body: 'Notifikasi aktif! Kamu akan dapat info jadwal terbaru.',
                icon:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
                badge:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
                vibrate:[200,100,200],
                tag:'gke-test',
                data:{url: location.href}
              });
              return;
            }
          }
          new Notification('GKE Bukit Hindu', {body:'Notifikasi aktif!'});
        }
      }catch(e){ console.log('test notif err', e); }
    }, 800);
  }catch(e){ console.error(e); }
}

function toggleNotifikasi(){
  // PENTING: jangan bikin async di awal, biar gesture Chrome mobile kepake
  const btn = document.getElementById('btn-aktifkan-notif');
  if(!btn){
    console.error('btn not found');
    return;
  }
  if(btn._busy){
    console.log('busy');
    return;
  }

  if(!('Notification' in window)){
    if(typeof toast==='function') toast('Browser tidak support notifikasi 🔕');
    updateNotifUI(false);
    return;
  }

  const isActive = btn.dataset.active==='true';
  console.log('[Notif] click - PWA:', isPWA(), 'active:', isActive, 'perm:', Notification.permission, 'secure:', window.isSecureContext);

  if(isActive){
    // MATIKAN - ini boleh async
    (async ()=>{
      btn._busy=true;
      try{
        localStorage.setItem('gke_notif_enabled','false');
        const reg = await navigator.serviceWorker.getRegistration().catch(()=>null);
        if(reg){
          const sub = await reg.pushManager.getSubscription().catch(()=>null);
          if(sub) await sub.unsubscribe().catch(()=>{});
        }
        updateNotifUI(false);
        if(typeof toast==='function') toast('Notifikasi dimatikan');
      }finally{ btn._busy=false; }
    })();
    return;
  }

  // MAU AKTIFKAN
  let perm = Notification.permission;

  if(perm==='denied'){
    const msg = isPWA()
      ? 'Diblokir. Cara buka: Pengaturan HP > Aplikasi > GKE Jadwal > Notifikasi > Izinkan. Atau buka di Chrome biasa, klik gembok 🔒 > Setelan situs > Izinkan.'
      : 'Diblokir. Klik gembok 🔒 di kiri address bar > Setelan situs > Notifikasi > Izinkan. Lalu reload.';
    if(typeof toast==='function') toast(msg);
    else alert(msg);
    updateNotifUI(false);
    return;
  }

  if(perm==='default'){
    // INI KUNCINYA: panggil requestPermission LANGSUNG tanpa await sebelumnya, biar gesture Chrome mobile tidak hilang
    console.log('[Notif] requesting permission - gesture safe');
    try{
      const promise = Notification.requestPermission();
      // Modern Chrome returns Promise
      if(promise && promise.then){
        promise.then(result=>{
          console.log('[Notif] request result:', result);
          if(result==='granted'){
            activateNotif();
          }else if(result==='default'){
            if(typeof toast==='function') toast('Kamu menutup prompt. Klik tombol 🔔 lagi dan pilih Izinkan. Kalau gak muncul, klik 🔒 di address bar > Izinkan notifikasi.');
            updateNotifUI(false);
          }else{
            if(typeof toast==='function') toast('Izin ditolak. Klik 🔒 > Setelan situs > Izinkan notifikasi.');
            updateNotifUI(false);
          }
        }).catch(err=>{
          console.error('requestPermission promise err', err);
          if(typeof toast==='function') toast('Gagal minta izin: '+err.message);
        });
      }else{
        // Old callback style fallback
        Notification.requestPermission(result=>{
          console.log('[Notif] request result cb:', result);
          if(result==='granted') activateNotif();
          else{
            if(typeof toast==='function') toast('Izin belum diberikan: '+result);
            updateNotifUI(false);
          }
        });
      }
    }catch(e){
      console.error('requestPermission sync err', e);
      if(typeof toast==='function') toast('Error minta izin: '+e.message);
    }
    return;
  }

  // perm === granted - langsung aktifkan
  if(perm==='granted'){
    activateNotif();
  }
}

window.updateNotifUI = updateNotifUI;
window.checkNotifStatus = checkNotifStatus;
window.toggleNotifikasi = toggleNotifikasi;
window.activateNotif = activateNotif;
window.isPWA = isPWA;

document.addEventListener('DOMContentLoaded', checkNotifStatus);
window.addEventListener('load', checkNotifStatus);
