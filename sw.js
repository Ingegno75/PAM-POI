const CACHE = 'pam-v7';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  // Nominatim & OSRM: network only
  if(e.request.url.includes('nominatim.openstreetmap.org')||
     e.request.url.includes('router.project-osrm.org')||
     e.request.url.includes('open-elevation.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Mapbox tiles: network-first, cache fallback
  if(e.request.url.includes('mapbox.com')||e.request.url.includes('mapbox.cn')){
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return r;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  // Everything else: cache-first
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
