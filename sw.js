// sw.js - GKE Bukit Hindu PWA + Push - FIXED v4
const CACHE_NAME = 'gke-bukit-hindu-v4-pwa';
const ASSETS = [
  './',
  './ibadah.html',
  './manifest.json',
  './push-subscribe.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] install', CACHE_NAME);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err=>{
        console.warn('[SW] cache addAll fail', err);
        return Promise.resolve();
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(k => {
        if(k!==CACHE_NAME){
          console.log('[SW] deleting old cache', k);
          return caches.delete(k);
        }
        return null;
      }));
    }).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if(url.href.includes('supabase') || event.request.method!=='GET' || url.protocol==='chrome-extension:'){
    return;
  }
  if(event.request.headers.get('accept')?.includes('text/html')){
    event.respondWith(
      fetch(event.request).then(res=>{
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c=>c.put(event.request, clone)).catch(()=>{});
        return res;
      }).catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(res=>{
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(event.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
    })
  );
});

self.addEventListener('push', (event) => {
  console.log('[SW] push received', event.data?.text());
  let data = {};
  try{
    if(event.data){
      try{ data = event.data.json(); }catch{ data = { body: event.data.text() }; }
    }
  }catch(e){ 
    data = { body: 'Ada jadwal ibadah terbaru' }; 
  }

  // FIX: support image dari kirimnotif
  const title = data.title || 'Jadwal Ibadah GKE Bukit Hindu';
  const options = {
    body: data.body || 'Ada jadwal ibadah terbaru, cek sekarang!',
    icon: data.icon || 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
    badge: 'https://i.ibb.co/nM6H3j9K/6ab2a2d4-1b74-4c2d-9dc6-bf2a26ea4c6d-1.png',
    image: data.image || undefined, // FIX: ini yang hilang di versi lama
    vibrate: [200,100,200],
    tag: 'gke-jadwal',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || './ibadah.html' }
  };

  // Hapus field undefined biar gak error di beberapa browser
  if(!options.image) delete options.image;

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notif click', event.notification.data);
  event.notification.close();
  const url = event.notification.data?.url || './ibadah.html';
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
      for(const c of list){
        if(c.url.includes('ibadah') && 'focus' in c){
          c.navigate(url).catch(()=>{});
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event)=>{
  console.log('[SW] notif closed');
});
