// Offline shell: the app opens with no signal and shows the last schedule it saved.
// The schedule feed itself (Google) is never cached here; the app keeps its own copy.
const V = 'crew-hub-202611261912';
const SHELL = ['./', 'index.html', 'app.js', 'fonts/archivo.woff2', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // App settings (icons, shortcuts) always come fresh when online, so changes reach installs.
  if (url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // The wide map (computers only) is kept after its first download.
  if (url.pathname.endsWith('topo-desk.svg')) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(req, copy)); return r; })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
