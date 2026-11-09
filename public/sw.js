// Service worker : l'application s'ouvre même sans réseau (dans une église sans couverture, par ex.).
// Les données (lectures, notes) sont gérées hors ligne par le cache persistant de Firestore.
const VERSION = "guardian-v5";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/liturgie.js", "/ordinaire.js", "/firebase-config.js", "/manifest.webmanifest", "/icons/favicon-32-v2.png", "/img/logo-96.png", "/img/logo-240.png", "/confidentialite.html"];
const RUNTIME_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/__/")) return;                     // config et auth Firebase : toujours le réseau
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.host)) return;      // Firestore, Google Auth… : jamais en cache

  if (req.mode === "navigate") {                                     // page : réseau d'abord, cache si hors ligne
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put("/index.html", c)); return r; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // fichiers statiques : cache immédiat, mise à jour en arrière-plan
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
