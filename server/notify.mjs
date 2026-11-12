#!/usr/bin/env node
// Serveur de notifications Guardian Angel — exécuté par GitHub Actions (toutes les 10 minutes environ).
//  1. détecte les missions nouvellement publiées et les solennités du jour → crée les notifications (une seule fois) ;
//  2. envoie les notifications en attente aux abonnés de leur catégorie, par lots, sans doublon, avec reprise ;
//  3. supprime les abonnements invalides, en double ou abandonnés.
// Identifiants : FIREBASE_SERVICE_ACCOUNT (JSON, secret GitHub) ; émulateur : FIRESTORE_EMULATOR_HOST.
import { fileURLToPath } from "node:url";
import { validate, pickRecipients, buildMessage, classify, liturgicalNotification, missionNotification, ms,
  MAX_MANUAL_PER_DAY, MISSION_MAX_AGE_MS, STALE_SUB_MS } from "./lib.mjs";

const BATCH = 100, CONCURRENCY = 20, LEASE_MS = 10 * 60 * 1000, MAX_PER_RUN = 10;
const sleep = t => new Promise(r => setTimeout(r, t));

// ----- Envoi réel : API FCM HTTP v1 (cible « fid » recommandée, ou « token » pour les anciens abonnements) -----
export function fcmSender({ projectId, getAccessToken, fetchImpl = fetch }) {
  let tok = null, exp = 0;
  const access = async () => { if (!tok || Date.now() > exp - 60000) { const t = await getAccessToken(); tok = t.access_token; exp = Date.now() + (t.expires_in || 3000) * 1000; } return tok; };
  return async (sub, n, nid) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      let status = 0, body = null, retryAfter = 0;
      try {
        const r = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST", headers: { Authorization: "Bearer " + (await access()), "Content-Type": "application/json" }, body: JSON.stringify(buildMessage(sub, n, nid)) });
        status = r.status; if (r.ok) return { ok: true };
        retryAfter = +(r.headers.get("retry-after") || 0); body = await r.json().catch(() => null);
      } catch { status = 0; }
      const c = classify(status, body);
      if (c.kind !== "retry" || attempt === 3) return { ok: false, ...c };
      await sleep(Math.max(retryAfter * 1000, 500 * 2 ** attempt));
    }
  };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
const create = async (ref, data) => { try { await ref.create(data); return true; } catch (e) { if (e.code === 6 || /already exists/i.test(e.message)) return false; throw e; } };

/** Une passe complète. `send(sub, notification, id)` → { ok } | { ok:false, kind, code }. */
export async function runOnce({ db, send, FieldValue, Timestamp, now = new Date(), log = console.log }) {
  const res = { created: [], sent: [], removed: 0 };
  const nowMs = now.getTime(), ts = Timestamp.fromMillis(nowMs);

  // 1a. Missions publiées pas encore notifiées
  const missions = await db.collection("missions").where("status", "==", "published").get();
  for (const d of missions.docs) {
    const m = d.data(); if (m.notifiedAt) continue;
    const fresh = m.publishedAt && nowMs - ms(m.publishedAt) <= MISSION_MAX_AGE_MS;
    if (fresh) {
      const n = missionNotification(d.id, m);
      if (await create(db.collection("notifications").doc(n.id), { title: n.title, body: n.body, category: n.category, url: n.url, source: n.source, status: "pending", createdAt: ts, createdBy: "auto" })) res.created.push(n.id);
    }
    await d.ref.update({ notifiedAt: ts, notified: !!fresh });
  }
  // 1b. Solennité du jour (le matin, heure de Paris)
  const lit = liturgicalNotification(now);
  if (lit && await create(db.collection("notifications").doc(lit.id), { title: lit.title, body: lit.body, category: lit.category, url: lit.url, source: lit.source, status: "pending", createdAt: ts, createdBy: "auto" })) res.created.push(lit.id);

  // 2. Envoi des notifications en attente
  const queue = (await db.collection("notifications").where("status", "in", ["pending", "sending"]).get()).docs
    .sort((a, b) => ms(a.data().createdAt) - ms(b.data().createdAt)).slice(0, MAX_PER_RUN);
  let manualToday = null;
  for (const d of queue) {
    // Réservation (bail) : empêche deux exécutions simultanées d'envoyer la même notification.
    const claimed = await db.runTransaction(async tx => {
      const cur = (await tx.get(d.ref)).data();
      if (!cur || !(cur.status === "pending" || (cur.status === "sending" && ms(cur.leaseUntil) < nowMs))) return null;
      tx.update(d.ref, { status: "sending", leaseUntil: Timestamp.fromMillis(nowMs + LEASE_MS), startedAt: cur.startedAt || ts });
      return cur;
    });
    if (!claimed) continue;
    const n = claimed, errs = validate(n);
    if (errs.length) { await d.ref.update({ status: "failed", error: "Notification invalide : " + errs.join(", "), finishedAt: ts }); continue; }
    if (n.source === "manuel" && !n.startedAt) {
      if (manualToday === null) manualToday = (await db.collection("notifications").where("createdAt", ">", Timestamp.fromMillis(nowMs - 86400000)).get())
        .docs.filter(x => x.data().source === "manuel" && ["sent", "sending"].includes(x.data().status) && x.id !== d.id).length;
      if (manualToday >= MAX_MANUAL_PER_DAY) { await d.ref.update({ status: "refused", error: `Limite de ${MAX_MANUAL_PER_DAY} envois manuels par 24 h atteinte`, finishedAt: ts }); continue; }
      manualToday++;
    }
    const subs = (await db.collection("push_subscriptions").where("categories", "array-contains", n.category).get()).docs.map(x => ({ id: x.id, ...x.data() }));
    const { recipients, duplicates } = pickRecipients(subs, n.category);
    for (const id of duplicates) { await db.collection("push_subscriptions").doc(id).delete(); res.removed++; }
    const stats = { targets: recipients.length, success: 0, failure: 0, removed: duplicates.length, ...(n.stats || {}) };
    stats.targets = recipients.length;
    const todo = recipients.filter(s => !n.cursor || s.id > n.cursor);
    let fatal = null;
    for (let i = 0; i < todo.length && !fatal; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const out = await pool(chunk, CONCURRENCY, s => send(s, n, d.id));
      for (let k = 0; k < chunk.length; k++) {
        const r = out[k];
        if (r.ok) stats.success++;
        else if (r.kind === "invalid") { await db.collection("push_subscriptions").doc(chunk[k].id).delete(); stats.removed++; res.removed++; stats.failure++; }
        else if (r.kind === "fatal") { fatal = r.code; break; }
        else stats.failure++;
      }
      if (!fatal) await d.ref.update({ cursor: chunk[chunk.length - 1].id, stats, leaseUntil: Timestamp.fromMillis(Date.now() + LEASE_MS) });
    }
    if (fatal) { await d.ref.update({ status: "failed", error: "Envoi refusé par FCM : " + fatal, stats, finishedAt: ts }); log(`✗ ${d.id} : ${fatal}`); continue; }
    await d.ref.update({ status: "sent", stats, sentAt: ts, finishedAt: ts, leaseUntil: FieldValue.delete() });
    res.sent.push({ id: d.id, ...stats });
    log(`✓ ${d.id} — ${stats.success}/${stats.targets} reçue(s), ${stats.removed} abonnement(s) supprimé(s)`);
  }

  // 3. Abonnements abandonnés (non renouvelés depuis longtemps)
  const stale = await db.collection("push_subscriptions").where("updatedAt", "<", Timestamp.fromMillis(nowMs - STALE_SUB_MS)).limit(400).get();
  for (const x of stale.docs) { await x.ref.delete(); res.removed++; }
  return res;
}

async function main() {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore, FieldValue, Timestamp } = await import("firebase-admin/firestore");
  let projectId = process.env.FIREBASE_PROJECT_ID, credential, send;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: projectId || "demo-guardian" });
    send = async () => ({ ok: true });                         // émulateur : aucun envoi réel
  } else {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    if (!sa.private_key) { console.log("::error::FIREBASE_SERVICE_ACCOUNT manquant"); process.exit(1); }
    credential = cert(sa); projectId = projectId || sa.project_id;
    initializeApp({ credential, projectId });
    send = fcmSender({ projectId, getAccessToken: () => credential.getAccessToken() });
  }
  const r = await runOnce({ db: getFirestore(), send, FieldValue, Timestamp });
  console.log(`::notice::Notifications : ${r.created.length} créée(s) [${r.created.join(", ")}], ${r.sent.length} envoyée(s), ${r.removed} abonnement(s) supprimé(s).`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
