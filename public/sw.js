const CACHE = 'law-review-shell-v4';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/art/office.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(new URL(event.request.url).pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('/'))));
});
self.addEventListener('push',event=>{
  let payload={title:'😐 오늘의 보건법규 심사를 시작해 볼까요?',body:'앱을 열어 학습 기록을 확인하세요.',url:'/?tab=free'};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{}
  const safeUrl=typeof payload.url==='string'&&payload.url.startsWith('/')&&!payload.url.startsWith('//')?payload.url:'/?tab=free';
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:safeUrl},tag:'health-law-study'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const path=event.notification.data?.url||'/?tab=free';
  const target=new URL(path,self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    for(const window of windows){if(new URL(window.url).origin===self.location.origin){await window.navigate(target);return window.focus();}}
    return self.clients.openWindow(target);
  }));
});
