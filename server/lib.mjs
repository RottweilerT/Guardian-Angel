// Fonctions pures du serveur de notifications (testées sans réseau).
import { liturgie, dn } from "../public/js/liturgie-romain.js";

export const CATEGORIES = ["missions", "liturgie", "annonces", "nouveautes"];
export const LINK_RE = /^\/(#\/[A-Za-z0-9\-_/%.]*)?$/;
export const MAX_MANUAL_PER_DAY = 5;
export const MISSION_MAX_AGE_MS = 72 * 3600 * 1000;      // une mission publiée il y a plus de 72 h n'est plus « nouvelle »
export const STALE_SUB_MS = 270 * 86400 * 1000;          // abonnement non renouvelé depuis 9 mois : supprimé

const ms = v => (v == null ? 0 : typeof v === "number" ? v : v.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : 0);
export { ms };

/** Valide une notification avant envoi ; renvoie une liste d'erreurs. */
export function validate(n) {
  const e = [];
  if (typeof n.title !== "string" || !n.title.trim() || n.title.length > 65) e.push("titre");
  if (typeof n.body !== "string" || !n.body.trim() || n.body.length > 180) e.push("message");
  if (!CATEGORIES.includes(n.category)) e.push("catégorie");
  if (typeof n.url !== "string" || !LINK_RE.test(n.url)) e.push("lien");
  return e;
}

/** Destinataires : abonnements actifs de la catégorie, sans doublon de cible (le plus récent l'emporte).
 *  Renvoie aussi les doublons obsolètes à supprimer. */
export function pickRecipients(subs, category) {
  const best = new Map(), dup = [];
  for (const s of subs) {
    if (!s || typeof s.target !== "string" || !["fid", "token"].includes(s.kind)) continue;
    const k = s.kind + ":" + s.target, cur = best.get(k);
    if (!cur) best.set(k, s);
    else if (ms(s.updatedAt) > ms(cur.updatedAt)) { dup.push(cur.id); best.set(k, s); }
    else dup.push(s.id);
  }
  const recipients = [...best.values()].filter(s => s.active === true && Array.isArray(s.categories) && s.categories.includes(category))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { recipients, duplicates: dup };
}

/** Message FCM HTTP v1 (données uniquement : le service worker du site affiche la notification). */
export function buildMessage(sub, n, nid) {
  return {
    message: {
      [sub.kind === "fid" ? "fid" : "token"]: sub.target,
      data: { nid: String(nid), title: n.title, body: n.body, url: n.url, category: n.category },
      webpush: { headers: { TTL: "86400", Urgency: "normal" } }
    }
  };
}

/** Classe une erreur d'envoi : "invalid" (abonnement à supprimer), "retry", "fatal" (problème global), "skip". */
export function classify(status, body) {
  const code = body?.error?.details?.find(d => d.errorCode)?.errorCode || body?.error?.status || "";
  if (status === 404 || code === "UNREGISTERED" || code === "SENDER_ID_MISMATCH") return { kind: "invalid", code: code || "NOT_FOUND" };
  if (status === 401 || (status === 403 && code !== "SENDER_ID_MISMATCH")) return { kind: "fatal", code: code || "PERMISSION_DENIED" };
  if (status === 429 || status >= 500 || status === 0) return { kind: "retry", code: code || "UNAVAILABLE" };
  return { kind: "skip", code: code || "INVALID_ARGUMENT" };      // 400 : on ne supprime jamais sur une erreur ambiguë
}

/** Date et heure à Paris. */
export function paris(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24, y: +p.year, m: +p.month, d: +p.day };
}

/** Notification automatique du matin pour une solennité (calendrier romain actuel), ou null. */
export function liturgicalNotification(now = new Date()) {
  const t = paris(now);
  if (t.hour < 6 || t.hour >= 12) return null;
  const L = liturgie(dn(t.y, t.m, t.d));
  if (L.rang !== "solennite") return null;
  return { id: "liturgie_" + t.date, title: L.titre.slice(0, 65), body: "Solennité du jour. Retrouvez la messe dans le missel.".slice(0, 180), category: "liturgie", url: "/#/missel", source: "liturgie" };
}

/** Notification d'une mission nouvellement publiée. */
export function missionNotification(id, m) {
  const titre = String(m.titre || "Nouvelle mission").slice(0, 120);
  return { id: "mission_" + id, title: "Nouvelle mission paroissiale".slice(0, 65), body: (titre + (m.paroisse ? " — " + m.paroisse : "")).slice(0, 180), category: "missions", url: "/#/missions", source: "mission" };
}
