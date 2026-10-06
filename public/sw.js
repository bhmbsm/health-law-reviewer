const CACHE = 'law-review-shell-v7';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldShells = keys.filter(key => key.startsWith('law-review-shell-') && key !== CACHE);
    await Promise.all(oldShells.map(key => caches.delete(key)));
    await self.clients.claim();
    // One-time migration: old tabs have no update listener and can keep running
    // the pre-validation generator indefinitely. Reload them after taking over.
    // Only shell caches are removed; login and saved learning records are kept.
    if (oldShells.length) {
      const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
      await Promise.all(windows.map(async client => {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin) return;
        url.searchParams.set('app_update', 'v7');
        try { await client.navigate(url.href); } catch {}
      }));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  // Hashed bundles are immutable; avoid a network round trip on every visit.
  if(url.pathname.startsWith('/_next/static/')){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())));
      return response;
    })));
    return;
  }
  // Never substitute a cached HTML page for a script, image, or an RSC response.
  if(event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request, {cache:'no-store'}).then(response=>{
    if(response.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('/'))));
});

self.addEventListener('push', (event) => {
  let payload = {title:'😐 오늘의 보건법규 심사를 시작해 볼까요?',body:'앱을 열어 학습 기록을 확인하세요.',url:'/?screen=today'};
  try { if(event.data) payload={...payload,...event.data.json()}; } catch {}
  const url=new URL(typeof payload.url==='string'?payload.url:'/?screen=today',self.location.origin);
  const target=url.origin===self.location.origin?url.href:new URL('/?screen=today',self.location.origin).href;
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:target},tag:'health-law-study'}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/?screen=today', self.location.origin);
  const target = url.origin===self.location.origin ? url.href : new URL('/?screen=today',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
