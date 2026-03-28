const CACHE      = 'pam-v8';
const TILE_CACHE = 'pam-tiles-v1';    // Mapbox auto-cache
const OSM_CACHE  = 'pam-osm-tiles-v1'; // OSM explicit download

const ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE&&k!==TILE_CACHE&&k!==OSM_CACHE)
            .map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const url = e.request.url;

  // ── Nominatim / OSRM / Open-Elevation: always network, no cache ─────────────
  if( url.includes('nominatim.openstreetmap.org') ||
      url.includes('router.project-osrm.org')     ||
      url.includes('open-elevation.com')){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));
    return;
  }

  // ── OSM tiles (tile.openstreetmap.org): OSM_CACHE first, then network ────────
  if(url.includes('tile.openstreetmap.org')){
    e.respondWith(
      caches.open(OSM_CACHE).then(async osmCache=>{
        const hit = await osmCache.match(e.request);
        if(hit) return hit;
        try{
          const res = await fetch(e.request);
          if(res.ok) osmCache.put(e.request, res.clone());
          return res;
        }catch(err){
          return new Response('',{status:503,statusText:'OSM Offline'});
        }
      })
    );
    return;
  }

  // ── Mapbox raster tiles: TILE_CACHE first, then network + auto-cache ─────────
  if(url.includes('api.mapbox.com/styles') && url.includes('/tiles/')){
    e.respondWith(
      caches.open(TILE_CACHE).then(async tileCache=>{
        const hit = await tileCache.match(e.request);
        if(hit) return hit;
        try{
          const res = await fetch(e.request);
          if(res.ok) tileCache.put(e.request, res.clone());
          return res;
        }catch(err){
          return new Response('',{status:503,statusText:'Tile Offline'});
        }
      })
    );
    return;
  }

  // ── Mapbox GL JS, fonts, sprites, glyphs: cache-first ────────────────────────
  if(url.includes('mapbox.com') || url.includes('mapbox.cn')){
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
        if(res.ok) caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        return res;
      }))
    );
    return;
  }

  // ── App shell + fonts: cache-first ───────────────────────────────────────────
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
