/* Campusly service worker: network-first app shell + persistent notifications. */
const CACHE='campusly-disabled-v46';
self.addEventListener('install',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET'||u.pathname.startsWith('/api/'))return;event.respondWith(fetch(event.request,{cache:'no-store'}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const target=event.notification.data?.route?`/#${event.notification.data.route}`:'/';for(const c of list){if('focus' in c)return c.focus().then(()=>c.navigate?.(target));}return clients.openWindow(target);}));});
