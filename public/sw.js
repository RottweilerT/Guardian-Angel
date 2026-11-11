// Service worker : coque de l'application et données publiques disponibles hors ligne.
const VERSION = "ga2-v1";
const SHELL = ["/", "/index.html", "/css/ds.css", "/manifest.webmanifest", "/img/logo-96.png",
  ...["app", "ui", "cloud", "store", "ordo", "firebase-config", "liturgie-romain", "liturgie-1962"].map(f => "/js/" + f + ".js"),
  ...["accueil", "carte", "missel", "journal", "missions", "passeport", "profil"].map(f => "/js/views/" + f + ".js"),
  "/data/routes.json", "/data/content-rights.json"];
self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/__/")) return;
  const same = url.origin === location.origin;
  if (!same && url.host !== "www.gstatic.com") return;            // tuiles, Firestore, Google : jamais en cache ici
  // réseau d'abord (toujours la dernière version), cache en secours hors ligne
  e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; })
    .catch(() => caches.match(req).then(h => h || (req.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});
