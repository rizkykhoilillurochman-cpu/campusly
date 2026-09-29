const CACHE='campusly-v38';
const APP_SHELL=['/','/index.html','/styles.css?v=26','/ui.css?v=1','/app.js?v=33','/ui.js?v=2','/ai-runtime.js?v=10','/developer-contact.js?v=6','/ai-fix.js?v=5','/final-polish.js?v=2','/manifest.webmanifest?v=34','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET'||u.pathname.startsWith('/api/'))return;event.respondWith(fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/index.html'))))});
