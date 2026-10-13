// push-subscribe.js - GKE Bukit Hindu - PWA READY
console.log('push-subscribe.js PWA-ready loaded');

function isPWA(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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
    updateNotifUI(false);
    return;
  }
  const perm = Notification.permission;
  const localEnabled = localStorage.getItem('gke_notif_enabled')==='true';
  console.log('[Notif] check PWA:', isPWA(), 'perm:', perm, 'local:', localEnabled);
  if(perm==='granted' && localEnabled){
    updateNotifUI(true);
  }else{
    updateNotifUI(false);
  }
}

async function toggleNotifikasi(userId){
  const btn = document.getElementById('btn-aktifkan-notif');
  if(!btn) return;
  if(btn._busy) return;
  btn._busy = true;
  const origDisabled = btn.disabled;
  btn.disabled = true;
  try{
    if(!('Notification' in window)){
      if(typeof toast==='function') toast('Browser tidak mendukung notifikasi 🔕');
      else alert('Browser tidak mendukung notifikasi');
      updateNotifUI(false);
      return;
    }

    const isActive = btn.dataset.active==='true';
    console.log('[Notif] toggle PWA:', isPWA(), 'isActive:', isActive, 'perm:', Notification.permission);

    if(isActive){
      localStorage.setItem('gke_notif_enabled','false');
      try{
        const reg = await navigator.serviceWorker.getRegistration();
        if(reg){
          const sub = await reg.pushManager.getSubscription();
          if(sub) await sub.unsubscribe();
        }
      }catch(e){ console.log('unsub skip', e); }
      updateNotifUI(false);
      if(typeof toast==='function') toast('Notifikasi dimatikan');
    }else{
      if(Notification.permission==='denied'){
        const msg = isPWA() ? 'Izin diblokir. Buka Pengaturan Android > Aplikasi > GKE Jadwal > Notifikasi > Izinkan' : 'Izin diblokir. Buka 🔒 di address bar > Setelan situs > Izinkan notifikasi';
        if(typeof toast==='function') toast(msg);
        else alert(msg);
        updateNotifUI(false);
        return;
      }

      let perm = Notification.permission;
      if(perm==='default'){
        perm = await Notification.requestPermission();
        console.log('[Notif] after request:', perm);
      }

      if(perm!=='granted'){
        if(typeof toast==='function') toast('Izin notifikasi belum diberikan');
        updateNotifUI(false);
        return;
      }

      // Pastikan SW ready - PENTING untuk PWA
      if('serviceWorker' in navigator){
        try{
          let reg = await navigator.serviceWorker.getRegistration();
          if(!reg){
            reg = await navigator.serviceWorker.register('sw.js', {scope:'./'});
            console.log('[Notif] SW registered from toggle');
          }
          await navigator.serviceWorker.ready;
          console.log('[Notif] SW ready');
        }catch(e){
          console.warn('SW register gagal, lanjut mode lokal', e);
        }
      }

      localStorage.setItem('gke_notif_enabled','true');
      updateNotifUI(true);
      if(typeof toast==='function') toast('Notifikasi aktif ✓' + (isPWA() ? ' (PWA)' : ''));

      setTimeout(async ()=>{
        try{
          if(Notification.permission==='granted'){
            // Di PWA harus pakai SW showNotification
            if('serviceWorker' in navigator){
              try{
                const reg = await navigator.serviceWorker.ready;
                if(reg && reg.showNotification){
                  await reg.showNotification('GKE Bukit Hindu - Gereja Efrata', {
                    body: isPWA() ? 'PWA aktif! Kamu akan dapat pengingat jadwal terbaru.' : 'Notifikasi jadwal ibadah aktif.',
                    icon:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
                    badge:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
                    vibrate:[200,100,200],
                    tag:'gke-test',
                    renotify:true,
                    data:{url: location.href}
                  });
                  console.log('[Notif] test notif shown via SW');
                  return;
                }
              }catch(e){ console.warn('SW notif fail', e); }
            }
            // Fallback untuk browser biasa
            new Notification('GKE Bukit Hindu', {
              body:'Notifikasi jadwal ibadah aktif.',
              icon:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png'
            });
          }
        }catch(e){ console.log('test notif error', e); }
      }, 600);
    }
  }catch(err){
    console.error('toggleNotifikasi error', err);
    if(typeof toast==='function') toast('Gagal: '+(err.message||err));
  }finally{
    btn._busy = false;
    btn.disabled = origDisabled;
  }
}

window.updateNotifUI = updateNotifUI;
window.checkNotifStatus = checkNotifStatus;
window.toggleNotifikasi = toggleNotifikasi;
window.isPWA = isPWA;

document.addEventListener('DOMContentLoaded', checkNotifStatus);
window.addEventListener('load', checkNotifStatus);
