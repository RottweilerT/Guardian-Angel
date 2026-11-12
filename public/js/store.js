// Données personnelles : privées par défaut.
//  - sans compte, ou sans consentement explicite : stockage local uniquement (navigateur) ;
//  - avec compte ET consentement (RGPD art. 9) : Firestore, sous users/{uid}/…
import { cloud } from "./cloud.js";
import { deleteAllFor as deletePushFor } from "./push.js";
export const KINDS = ["journal", "visits"];
export const CONSENT_VERSION = 1;

const ls = {
  get(k, d) { try { const v = localStorage.getItem("ga2-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ga2-" + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem("ga2-" + k); } catch { /* idem */ } }
};
export const prefs = {
  get: (k, d) => ls.get("pref-" + k, d),
  set: (k, v) => { ls.set("pref-" + k, v); emit(); },
  all: () => Object.fromEntries(["calendrier", "langue", "taille", "favEglises", "favJours"].map(k => [k, ls.get("pref-" + k, null)]))
};

const cache = { journal: {}, visits: {} };
const unsub = {};
export const state = { consent: false };
const emit = () => window.dispatchEvent(new Event("ga:data"));
export const isCloud = () => !!(cloud.user && state.consent);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function loadLocal() { KINDS.forEach(k => { cache[k] = ls.get(k, {}); }); }
loadLocal();

export const list = kind => Object.values(cache[kind]);
export const get = (kind, id) => cache[kind][id];

export async function put(kind, id, obj) {
  const clean = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  if (isCloud()) {
    const { fs, db, user } = cloud;
    await fs.setDoc(fs.doc(db, "users", user.uid, kind, id), { ...clean, updatedAt: fs.serverTimestamp() });
  } else { cache[kind][id] = { ...clean, updatedAt: Date.now() }; ls.set(kind, cache[kind]); emit(); }
}
export async function del(kind, id) {
  if (isCloud()) { const { fs, db, user } = cloud; await fs.deleteDoc(fs.doc(db, "users", user.uid, kind, id)); }
  else { delete cache[kind][id]; ls.set(kind, cache[kind]); emit(); }
}

function stop() { Object.values(unsub).forEach(u => u && u()); KINDS.forEach(k => { unsub[k] = null; }); }
function subscribe() {
  const { fs, db, user } = cloud; stop();
  KINDS.forEach(kind => {
    unsub[kind] = fs.onSnapshot(fs.collection(db, "users", user.uid, kind), snap => {
      const m = {}; snap.docs.forEach(d => { const v = d.data(); m[d.id] = { ...v, updatedAt: v.updatedAt?.toMillis ? v.updatedAt.toMillis() : v.updatedAt }; });
      cache[kind] = m; emit();
    }, e => console.warn(kind, e));
  });
}

// Appelé à chaque changement d'utilisateur. Renvoie "consent-needed" si le consentement n'a pas encore été donné.
export async function onUserChange(user) {
  stop(); state.consent = false;
  if (!user) { loadLocal(); emit(); return "local"; }
  const { fs, db } = cloud;
  try {
    const c = await fs.getDoc(fs.doc(db, "users", user.uid, "meta", "consent"));
    if (c.exists() && c.data().version >= CONSENT_VERSION) { state.consent = true; subscribe(); emit(); return "cloud"; }
  } catch (e) { console.warn(e); }
  emit(); return "consent-needed";
}

export async function giveConsent() {
  const { fs, db, user } = cloud;
  await fs.setDoc(fs.doc(db, "users", user.uid, "meta", "consent"), { version: CONSENT_VERSION, givenAt: fs.serverTimestamp(), scope: "journal-spirituel" });
  // les données locales sont transférées dans le compte, puis effacées de l'appareil
  const local = Object.fromEntries(KINDS.map(k => [k, ls.get(k, {})]));
  const batch = fs.writeBatch(db); let n = 0;
  KINDS.forEach(k => Object.entries(local[k]).forEach(([id, v]) => { if (n++ < 450) batch.set(fs.doc(db, "users", user.uid, k, id), { ...v, updatedAt: fs.serverTimestamp() }); }));
  if (n) await batch.commit();
  KINDS.forEach(k => ls.del(k));
  state.consent = true; subscribe(); emit();
}

export function exportAll(extra = {}) {
  return { exportedAt: new Date().toISOString(), application: "Guardian Angel", stockage: isCloud() ? "compte" : "appareil", journal: list("journal"), visites: list("visits"), preferences: prefs.all(), ...extra };
}

// Suppression définitive : journal, visites, anciennes notes, candidatures, consentement, puis le compte.
export async function deleteAccount() {
  const { fs, db, au, user } = cloud; stop();
  for (const sub of ["journal", "visits", "notes", "meta"]) {
    const s = await fs.getDocs(fs.collection(db, "users", user.uid, sub));
    for (let i = 0; i < s.docs.length; i += 400) { const b = fs.writeBatch(db); s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
  }
  const apps = await fs.getDocs(fs.query(fs.collection(db, "applications"), fs.where("uid", "==", user.uid)));
  for (const d of apps.docs) await fs.deleteDoc(d.ref);
  await deletePushFor(user.uid).catch(e => console.warn("abonnements", e));
  try { await au.deleteUser(user); }
  catch (e) { if (e.code !== "auth/requires-recent-login") throw e; await au.reauthenticateWithPopup(user, new au.GoogleAuthProvider()); await au.deleteUser(user); }
  eraseLocal();
}
export function eraseLocal() { KINDS.forEach(k => ls.del(k)); loadLocal(); emit(); }
