// Notifications push (Firebase Cloud Messaging, API Firebase Installation ID : register / onRegistered).
// Abonnement volontaire, sans compte obligatoire (session anonyme), une entrée par appareil.
import { cloud, ensureAuth, loadMessaging } from "./cloud.js";
import { pushConfig } from "./push-config.js";

export const CATEGORIES = [
  { id: "missions", label: "Nouvelles missions paroissiales", desc: "Quand une paroisse publie un besoin de bénévoles.", auto: true },
  { id: "liturgie", label: "Grandes fêtes liturgiques", desc: "Le matin des solennités du calendrier romain.", auto: true },
  { id: "annonces", label: "Informations importantes", desc: "Annonces ponctuelles de l'équipe." },
  { id: "nouveautes", label: "Nouveautés de l'application", desc: "Nouvelles fonctionnalités, rarement." }
];
export const CAT_IDS = CATEGORIES.map(c => c.id);
const KEY = "ga2-push";
const REFRESH_MS = 7 * 86400000;
const local = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* indisponible */ } }
};
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join("");
const emit = () => window.dispatchEvent(new Event("ga:push"));

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const supported = () => window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** État affiché : unsupported | ios-install | not-configured | offline | denied | off | paused | on */
export function status() {
  const s = local.get();
  if (!supported()) return { state: isIOS() && !isStandalone() ? "ios-install" : "unsupported" };
  if (!pushConfig.vapidKey) return { state: "not-configured" };
  if (Notification.permission === "denied") return { state: "denied", local: s };
  if (!s || Notification.permission !== "granted") return { state: "off", local: s };
  return { state: s.active ? "on" : "paused", local: s };
}

async function swRegistration() {
  return (await navigator.serviceWorker.getRegistration("/")) || navigator.serviceWorker.register("/sw.js");
}

// Obtient l'identifiant d'installation (FID) via register()/onRegistered().
let fidWaiters = [], listening = false;
async function obtainTarget() {
  const m = await loadMessaging();
  if (!m) throw Object.assign(new Error("Navigateur non compatible"), { code: "ga/unsupported" });
  const { mm, messaging } = m;
  const swr = await swRegistration();
  await navigator.serviceWorker.ready;
  if (typeof mm.register === "function") {
    if (!listening) {
      listening = true;
      // Appelé aussi plus tard si l'identifiant change : on met à jour l'abonnement.
      mm.onRegistered(messaging, fid => {
        const w = fidWaiters; fidWaiters = [];
        if (w.length) w.forEach(r => r(fid));
        else { const s = local.get(); if (s && s.target !== fid) save({ ...s, kind: "fid", target: fid }, true).catch(() => {}); }
      });
    }
    const p = new Promise((res, rej) => { fidWaiters.push(res); setTimeout(() => rej(Object.assign(new Error("Délai dépassé"), { code: "ga/timeout" })), 25000); });
    await mm.register(messaging, { vapidKey: pushConfig.vapidKey, serviceWorkerRegistration: swr });
    return { kind: "fid", target: await p };
  }
  // Repli (API dépréciée, toujours prise en charge) si la version du SDK n'expose pas register().
  return { kind: "token", target: await mm.getToken(messaging, { vapidKey: pushConfig.vapidKey, serviceWorkerRegistration: swr }) };
}

// Écrit l'abonnement de cet appareil : users/{uid} n'est pas utilisé, collection dédiée lisible par le seul propriétaire.
async function save(s, force) {
  const user = await ensureAuth();
  const { fs, db } = cloud;
  const docId = user.uid + "_" + s.deviceId;
  const ref = fs.doc(db, "push_subscriptions", docId);
  const body = { uid: user.uid, deviceId: s.deviceId, kind: s.kind, target: s.target, categories: s.categories, active: s.active, updatedAt: fs.serverTimestamp() };
  if (!force && s.docId === docId && Date.now() - (s.lastWrite || 0) < REFRESH_MS && s.synced) { local.set(s); emit(); return s; }
  if (s.docId === docId) {
    try { await fs.updateDoc(ref, body); }
    catch (e) { if (e.code !== "not-found") throw e; await fs.setDoc(ref, { ...body, createdAt: fs.serverTimestamp() }); }
  } else await fs.setDoc(ref, { ...body, createdAt: fs.serverTimestamp() });
  const n = { ...s, docId, uid: user.uid, lastWrite: Date.now(), synced: true };
  local.set(n); emit(); return n;
}

/** Active les notifications. À appeler directement depuis un clic (exigence des navigateurs). */
export async function enable(categories) {
  const cats = categories.filter(c => CAT_IDS.includes(c));
  if (!cats.length) throw Object.assign(new Error("Choisissez au moins une catégorie"), { code: "ga/no-category" });
  const perm = await Notification.requestPermission();   // première instruction asynchrone : conserve le geste de l'utilisateur
  if (perm !== "granted") { emit(); throw Object.assign(new Error(perm === "denied" ? "Autorisation refusée" : "Autorisation non accordée"), { code: "ga/denied" }); }
  const t = await obtainTarget();
  const prev = local.get();
  return save({ deviceId: prev?.deviceId || rnd(), docId: prev?.docId, ...t, categories: cats, active: true }, true);
}

export async function setCategories(categories) {
  const s = local.get(); if (!s) return;
  const cats = categories.filter(c => CAT_IDS.includes(c));
  if (!cats.length) return unsubscribe();
  return save({ ...s, categories: cats }, true);
}
export async function setActive(active) { const s = local.get(); if (s) return save({ ...s, active }, true); }

/** Désabonnement complet : supprime l'entrée côté serveur et l'inscription FCM de cet appareil. */
export async function unsubscribe() {
  const s = local.get();
  try {
    if (s?.docId && cloud.ready) {
      const user = await ensureAuth();
      if (s.docId.startsWith(user.uid + "_")) await cloud.fs.deleteDoc(cloud.fs.doc(cloud.db, "push_subscriptions", s.docId));
    }
    const m = await loadMessaging().catch(() => null);
    if (m) { if (typeof m.mm.unregister === "function") await m.mm.unregister(m.messaging).catch(() => {}); else await m.mm.deleteToken(m.messaging).catch(() => {}); }
  } finally { local.set(null); emit(); }
}

/** Au démarrage : si cet appareil est abonné, renouvelle l'inscription (recommandé par Firebase) et la date de mise à jour. */
export async function refreshOnStartup() {
  const s = local.get();
  if (!s || !supported() || !pushConfig.vapidKey || Notification.permission !== "granted" || !cloud.ready) return;
  try {
    const t = await obtainTarget();
    const user = await ensureAuth();
    const changed = t.target !== s.target || s.kind !== t.kind || s.docId !== user.uid + "_" + s.deviceId;
    await save({ ...s, ...t }, changed);
  } catch (e) { console.warn("Notifications : renouvellement impossible", e); }
}

/** Supprime toutes les inscriptions de l'utilisateur (suppression de compte). */
export async function deleteAllFor(uid) {
  const { fs, db } = cloud;
  const q = await fs.getDocs(fs.query(fs.collection(db, "push_subscriptions"), fs.where("uid", "==", uid)));
  for (const d of q.docs) await fs.deleteDoc(d.ref);
  const s = local.get(); if (s && s.uid === uid) { local.set(null); emit(); }
}

// --- Administration ---
export const LINK_RE = /^\/(#\/[A-Za-z0-9\-_/%.]*)?$/;
export function validNotification(n) {
  const e = [];
  if (!n.title || n.title.length > 65) e.push("Titre obligatoire, 65 caractères au plus.");
  if (!n.body || n.body.length > 180) e.push("Message obligatoire, 180 caractères au plus.");
  if (!CAT_IDS.includes(n.category)) e.push("Catégorie inconnue.");
  if (!LINK_RE.test(n.url || "")) e.push("Lien : chemin interne au site, par exemple /#/missions.");
  return e;
}
