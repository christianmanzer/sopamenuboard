// Keeps the board working through Wi-Fi drops: shell + fonts + images are cached,
// the playlist is network-first with the last good copy as fallback.
const V = "menuboard-v2";
const SHELL = ["/player.html", "/player.css", "/player.js",
  "/fonts/righteous-latin-400-normal.woff2", "/fonts/raleway-latin-900-normal.woff2", "/img/pattern.svg",
  "/fonts/gelasio-latin-400-normal.woff2", "/fonts/gelasio-latin-400-italic.woff2",
  "/fonts/gelasio-latin-700-normal.woff2", "/fonts/gelasio-latin-700-italic.woff2"];

self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // /<location>/menu/<n>  -> network first, cached player page as fallback
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/player.html")));
    return;
  }
  // player code + playlist -> network first, cache fallback
  if (url.pathname.endsWith("playlist.json") || url.pathname === "/player.js" || url.pathname === "/player.css") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // images + fonts -> cache first, fill the cache as we go
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; })));
});
