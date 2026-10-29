/* Service worker порталу ППО РУ.
   Зберігає на телефоні ЛИШЕ файли самого сайту (оболонку), щоб він швидко відкривався.
   Дані з Google-таблиці (облік, новини, документи) завжди беруться з мережі й не зберігаються. */
const CACHE = 'ppo-v1.5.3';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'notify.js', '../config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png', 'icons/logo-128.png', 'icons/logo-256.png', 'icons/logo-favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  // нова версія чекає, доки користувач натисне «Оновити»
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('ppo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Google (облік, дані) — завжди напряму в мережу
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
      return Response.error();
    }
  }));
});

/* сповіщення: фонова перевірка нових оголошень (Android, встановлений сайт) */
const META = 'meta-ppo';
const NKEY = n => (n['ID'] || '') + '|' + (n['Дата'] || '') + '|' + (n['Заголовок'] || '');
async function bgCheck() {
  const mc = await caches.open(META);
  const r = await mc.match('meta'); if (!r) return;
  const meta = await r.json(); if (!meta.api) return;
  const u = new URL(meta.api); u.searchParams.set('api', 'home');
  const h = await fetch(u.toString()).then(x => x.json());
  const notified = new Set(meta.notified || []);
  const fresh = (h.news || []).slice(0, 30).filter(n => !notified.has(NKEY(n)) && (!meta.important || n['Закріплено'] === 'Так'));
  for (const n of fresh.slice(0, 3)) {
    await self.registration.showNotification((n['Закріплено'] === 'Так' ? 'Важливо: ' : 'Нове оголошення: ') + n['Заголовок'],
      { body: String(n['Текст'] || '').slice(0, 140), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'ppo-' + NKEY(n), data: { href: '#/notifs' } });
  }
  fresh.forEach(n => notified.add(NKEY(n)));
  meta.notified = [...notified].slice(-300);
  await mc.put('meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'ppo-news') e.waitUntil(bgCheck().catch(() => {})); });

/* натискання на сповіщення: відкрити сайт на списку оголошень */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || '#/notifs';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'NAV', href }); return c.focus(); }
    return self.clients.openWindow('./' + href);
  }));
});
