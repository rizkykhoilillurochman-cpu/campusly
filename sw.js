const CACHE='campusly-v10';
const CORE=['./','./index.html','./styles.css?v=11','./polish.css?v=2','./sidebar-fix.css?v=1','./mobile-polish.css?v=1','./app.js?v=10','./liquid-ui.js?v=10','./boot-fix.js?v=1','./mobile-enhancements.js?v=1','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(x=>new Request(x,{cache:'reload'}))).catch(()=>{})).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok&&new URL(e.request.url).origin===self.location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
