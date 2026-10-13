// push-subscribe.js - FIXED v2 - SUDAH ADA VAPID KEY BARU
console.log('push-subscribe.js FIXED v2 loaded');

const VAPID_PUBLIC_KEY = "BBY5ufpzNiBTshM6vCySRt5Ag1pRTUllP3VfoHkbGYfwigmqGTVW_00DpHAtQ3E2QMp9oTpzMV91U711LcsN0oY";
const SUPABASE_URL = "https://gpgjgplqsvyexumoljyo.supabase.co";
const SUPABASE_KEY = "sb_publishable_JaVgg3CuVmI9SczGkoaRZQ_EaYoV9z9";

function getSupabaseClient(){
  if(window.supabase && window.supabase.createClient){
    if(window._gkeSupabase) return window._gkeSupabase;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window._gkeSupabase = client;
    return client;
  }
  console.warn('Supabase SDK belum load');
  return null;
}

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;++i) outputArray[i]=rawData.charCodeAt(i);
  return outputArray;
}

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
    updateNotifUI(false);
    return;
  }
  const perm = Notification.permission;
  const localEnabled = localStorage.getItem('gke_notif_enabled')==='true';
  if(perm==='granted' && localEnabled){
    updateNotifUI(true);
  }else{
    updateNotifUI(false);
  }
}

async function subscribeAndSaveToSupabase(){
  try{
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    
    if(!sub){
      console.log('[Notif] bikin subscription baru...');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const supabaseClient = getSupabaseClient();
    if(!supabaseClient) return sub;

    const subJson = sub.toJSON();
    const { data: existing } = await supabaseClient.from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).maybeSingle();
    
    if(!existing){
      const { error } = await supabaseClient.from('push_subscriptions').insert({
        endpoint: sub.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
        subscription: subJson,
        created_at: new Date().toISOString(),
        user_agent: navigator.userAgent
      });
      if(error){
        console.error('gagal simpan', error);
      }else{
        console.log('berhasil simpan ke Supabase');
      }
    }
    return sub;
  }catch(e){
    console.error('subscribe error', e);
    return null;
  }
}

async function activateNotif(){
  try{
    if('serviceWorker' in navigator){
      let reg = await navigator.serviceWorker.getRegistration();
      if(!reg){
        reg = await navigator.serviceWorker.register('sw.js', {scope:'./'});
      }
      await navigator.serviceWorker.ready;
    }
    localStorage.setItem('gke_notif_enabled','true');
    updateNotifUI(true);
    await subscribeAndSaveToSupabase();
    if(typeof toast==='function') toast('Notifikasi aktif ✓');
    
    setTimeout(async ()=>{
      try{
        if(Notification.permission==='granted' && 'serviceWorker' in navigator){
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('GKE Bukit Hindu', {
            body: 'Notifikasi aktif! Kamu akan dapat info jadwal terbaru.',
            icon:'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
            tag:'gke-test',
            data:{url: location.href}
          });
        }
      }catch(e){}
    }, 800);
  }catch(e){ console.error(e); }
}

function toggleNotifikasi(){
  const btn = document.getElementById('btn-aktifkan-notif');
  if(!btn || btn._busy) return;
  if(!('Notification' in window)){
    updateNotifUI(false);
    return;
  }
  const isActive = btn.dataset.active==='true';
  if(isActive){
    (async ()=>{
      btn._busy=true;
      try{
        localStorage.setItem('gke_notif_enabled','false');
        const reg = await navigator.serviceWorker.getRegistration().catch(()=>null);
        if(reg){
          const sub = await reg.pushManager.getSubscription().catch(()=>null);
          if(sub){
            const client = getSupabaseClient();
            if(client) await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            await sub.unsubscribe().catch(()=>{});
          }
        }
        updateNotifUI(false);
        if(typeof toast==='function') toast('Notifikasi dimatikan');
      }finally{ btn._busy=false; }
    })();
    return;
  }

  let perm = Notification.permission;
  if(perm==='denied'){
    if(typeof toast==='function') toast('Diblokir. Klik gembok 🔒 di address bar > Izinkan notifikasi.');
    updateNotifUI(false);
    return;
  }
  if(perm==='default'){
    Notification.requestPermission().then(result=>{
      if(result==='granted') activateNotif();
      else updateNotifUI(false);
    });
    return;
  }
  if(perm==='granted') activateNotif();
}

window.updateNotifUI = updateNotifUI;
window.checkNotifStatus = checkNotifStatus;
window.toggleNotifikasi = toggleNotifikasi;
window.activateNotif = activateNotif;
window.isPWA = isPWA;

document.addEventListener('DOMContentLoaded', checkNotifStatus);
window.addEventListener('load', checkNotifStatus);
