// Service worker unique de l'application :
//  1. coque et données publiques disponibles hors ligne ;
//  2. réception des notifications push (Firebase Cloud Messaging, messages « data » uniquement) et clic.
const VERSION = "ga2-v3";
const SHELL = ["/", "/index.html", "/css/ds.css", "/manifest.webmanifest", "/img/logo-96.png", "/icons/icon-192-v2.png",
  ...["app", "ui", "cloud", "store", "ordo", "firebase-config", "push", "push-config", "liturgie-romain", "liturgie-1962"].map(f => "/js/" + f + ".js"),
  ...["accueil", "carte", "missel", "journal", "missions", "passeport", "profil", "notifications"].map(f => "/js/views/" + f + ".js"),
  "/data/routes.json", "/data/content-rights.json"];
self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== "ga-push-seen").map(k => caches.delete(k)))).then(() => self.clients.claim())));
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

// ---------- Notifications ----------
// Seuls les liens internes au site sont ouverts (contrôle aussi fait côté serveur).
const safePath = u => (typeof u === "string" && /^\/(#\/[A-Za-z0-9\-_/%.]*)?$/.test(u) ? u : "/");
const isWebKitOnly = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(self.navigator.userAgent);

// Mémoire courte des notifications déjà traitées : évite un affichage en double si un message est livré deux fois.
async function seen(id) {
  if (!id) return false;
  const c = await caches.open("ga-push-seen"), key = new Request("/__seen/" + encodeURIComponent(id));
  if (await c.match(key)) return true;
  await c.put(key, new Response("1"));
  const keys = await c.keys();                                       // on ne garde que les 100 derniers
  await Promise.all(keys.slice(0, Math.max(0, keys.length - 100)).map(k => c.delete(k)));
  return false;
}

function parse(event) {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { p = { data: { body: event.data && event.data.text() } }; }
  const d = { ...(p.notification || {}), ...(p.data || {}) };      // format FCM : { data: {...}, from, fcmMessageId }
  return { id: d.nid || p.fcmMessageId || "", title: String(d.title || "Guardian Angel").slice(0, 80), body: String(d.body || "").slice(0, 240), url: safePath(d.url), category: d.category || "" };
}

self.addEventListener("push", event => {
  const n = parse(event);
  event.waitUntil((async () => {
    if (await seen(n.id)) return;
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const front = wins.find(w => w.visibilityState === "visible" && w.focused && ["/", "/index.html"].includes(new URL(w.url).pathname));  // seule l'application écoute ces messages
    // Application ouverte et au premier plan : message dans l'application plutôt qu'une notification système
    // (sauf Safari/WebKit, qui exige l'affichage d'une notification pour chaque message reçu).
    if (front && !isWebKitOnly) { front.postMessage({ type: "ga-push", ...n }); return; }
    await self.registration.showNotification(n.title, {
      body: n.body, tag: n.id || undefined, renotify: false, lang: "fr",
      icon: "/icons/icon-192-v2.png", badge: "/icons/favicon-64-v2.png", data: { url: n.url }
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find(c => new URL(c.url).origin === self.location.origin);
    if (w) { await w.focus(); if ("navigate" in w) return w.navigate(url).catch(() => w.postMessage({ type: "ga-open", url })); return; }
    return self.clients.openWindow(url);
  })());
});
// Changement d'abonnement push du navigateur : l'application renouvelle l'inscription FCM à la prochaine ouverture
// (refreshOnStartup appelle register(), qui déclenche onRegistered avec l'identifiant à jour).
self.addEventListener("pushsubscriptionchange", () => {});
