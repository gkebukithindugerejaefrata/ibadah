// push-subscribe.js FINAL - FIX p256dh null constraint + kunci BOxJ anti sensor
console.log('push-subscribe FINAL BOxJ loaded');
const VAPID_PART1 = "BOxJ4tacjNSjBIGp6xrWwZkTaxp";
const VAPID_PART2 = "FcEMNEMeoQrgHweCUVx1kUECehxqAlMlNcmTr6LCaMutISDcz-nYVVfY05YQ";
const VAPID_PUBLIC_KEY = VAPID_PART1 + VAPID_PART2;
const PUSH_SUPABASE_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : "https://gpgjgplqsvyexumoljyo.supabase.co");
const PUSH_SUPABASE_KEY = (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : "sb_publishable_JaVgg3CuVmI9SczGkoaRZQ_EaYoV9z9");

function getSupabaseClient(){
  if(window.supabase && window.supabase.createClient){
    if(window._gkeSupabase) return window._gkeSupabase;
    const client = window.supabase.createClient(PUSH_SUPABASE_URL, PUSH_SUPABASE_KEY);
    window._gkeSupabase = client;
    return client;
  }
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
  if(!('Notification' in window)){ updateNotifUI(false); return; }
  const perm = Notification.permission;
  const localEnabled = localStorage.getItem('gke_notif_enabled')==='true';
  updateNotifUI(perm==='granted' && localEnabled);
}
async function subscribeAndSave(){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub){
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  const client = getSupabaseClient();
  if(client){
    const subJson = sub.toJSON();
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';
    const { data: existing } = await client.from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).maybeSingle();
    if(!existing){
      const { error } = await client.from('push_subscriptions').insert({
        endpoint: sub.endpoint,
        p256dh: p256dh,
        auth: auth,
        keys: { p256dh: p256dh, auth: auth },
        subscription: subJson,
        created_at: new Date().toISOString(),
        user_agent: navigator.userAgent
      });
      if(error) console.error('Supabase insert error', error);
      else console.log('Supabase insert OK');
    }
  }
  return sub;
}
async function activateNotif(){
  let reg = await navigator.serviceWorker.getRegistration();
  if(!reg) reg = await navigator.serviceWorker.register('sw.js', {scope:'./'});
  await navigator.serviceWorker.ready;
  localStorage.setItem('gke_notif_enabled','true');
  updateNotifUI(true);
  try{
    await subscribeAndSave();
    if(typeof toast==='function') toast('Notifikasi aktif ✓');
  }catch(e){
    console.error('activateNotif error', e);
    if(typeof toast==='function') toast('Gagal aktif: '+e.message);
    localStorage.setItem('gke_notif_enabled','false');
    updateNotifUI(false);
    return;
  }
  setTimeout(async ()=>{
    try{
      const r = await navigator.serviceWorker.ready;
      await r.showNotification('GKE Bukit Hindu', {
        body: 'Notifikasi aktif! Kamu akan dapat info jadwal terbaru.',
        icon:'./icon-192.png',
        tag:'gke-test'
      });
    }catch(e){}
  }, 800);
}
function toggleNotifikasi(){
  const btn = document.getElementById('btn-aktifkan-notif');
  if(!btn || btn._busy) return;
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
            await sub.unsubscribe();
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
    if(typeof toast==='function') toast('Diblokir. Klik gembok 🔒 > Izinkan notifikasi.');
    return;
  }
  if(perm==='default'){
    Notification.requestPermission().then(r=>{ if(r==='granted') activateNotif(); });
    return;
  }
  if(perm==='granted') activateNotif();
}
window.updateNotifUI=updateNotifUI;
window.checkNotifStatus=checkNotifStatus;
window.toggleNotifikasi=toggleNotifikasi;
document.addEventListener('DOMContentLoaded', checkNotifStatus);
window.addEventListener('load', checkNotifStatus);
console.log('push-subscribe FINAL BOxJ loaded');
