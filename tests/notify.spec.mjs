// Serveur de notifications contre l'émulateur Firestore — npm run test:rules (lance l'émulateur)
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { runOnce } from "../server/notify.mjs";

let db, sent;
const NOW = new Date("2026-11-12T09:00:00Z");
const T = (d = 0) => Timestamp.fromMillis(NOW.getTime() + d);
const send = async (sub, n, nid) => { sent.push(nid + ">" + sub.target); return sub.target.startsWith("DEAD") ? { ok: false, kind: "invalid", code: "UNREGISTERED" } : { ok: true }; };
const run = (opts = {}) => runOnce({ db, send, FieldValue, Timestamp, now: NOW, log: () => {}, ...opts });
const sub = (id, target, cats, active = true, upd = 0) => db.doc("push_subscriptions/" + id).set({ uid: id.split("_")[0], deviceId: id.split("_")[1], kind: "fid", target, categories: cats, active, createdAt: T(-1e6), updatedAt: T(upd) });

before(() => { process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080"; initializeApp({ projectId: "demo-guardian" }); db = getFirestore(); });
beforeEach(async () => {
  sent = [];
  for (const c of ["missions", "notifications", "push_subscriptions"]) { const s = await db.collection(c).get(); await Promise.all(s.docs.map(d => d.ref.delete())); }
  await sub("u1_aaaaaaaa", "FID-A", ["missions", "annonces"]);
  await sub("u2_bbbbbbbb", "FID-B", ["annonces"]);
  await sub("u3_cccccccc", "FID-C", ["missions"], false);           // en pause
  await sub("u4_dddddddd", "DEAD-D", ["missions"]);                 // abonnement invalide
  await sub("u5_eeeeeeee", "FID-A", ["missions"], true, -5000);     // même appareil, entrée plus ancienne
});

test("mission publiée : notifiée une seule fois ; brouillon et mission ancienne ignorés", async () => {
  await db.doc("missions/m1").set({ titre: "Chorale", paroisse: "Saint-Sulpice", status: "published", publishedAt: T(-3600e3) });
  await db.doc("missions/m2").set({ titre: "Brouillon", status: "draft" });
  await db.doc("missions/m3").set({ titre: "Ancienne", status: "published", publishedAt: T(-10 * 86400e3) });
  const r1 = await run();
  assert.deepEqual(r1.created, ["mission_m1"]);
  assert.deepEqual(sent.sort(), ["mission_m1>DEAD-D", "mission_m1>FID-A"]);
  const n = (await db.doc("notifications/mission_m1").get()).data();
  assert.equal(n.status, "sent"); assert.equal(n.stats.success, 1); assert.equal(n.stats.targets, 2);
  assert.equal((await db.doc("push_subscriptions/u4_dddddddd").get()).exists, false, "abonnement invalide supprimé");
  assert.equal((await db.doc("push_subscriptions/u5_eeeeeeee").get()).exists, false, "doublon supprimé");
  assert.equal((await db.doc("missions/m3").get()).data().notified, false);
  sent = []; const r2 = await run();
  assert.equal(r2.created.length, 0); assert.equal(sent.length, 0, "aucun envoi en double");
  await db.doc("missions/m1").update({ titre: "Chorale (modifiée)" }); sent = []; await run();
  assert.equal(sent.length, 0, "une simple modification ne renvoie rien");
});

test("envoi manuel, annulation, quota, reprise après interruption", async () => {
  await db.collection("notifications").doc("n1").set({ title: "Annonce", body: "Texte", category: "annonces", url: "/#/missions", source: "manuel", status: "pending", createdAt: T(-60e3), createdBy: "admin" });
  await db.collection("notifications").doc("n2").set({ title: "Annulée", body: "Texte", category: "annonces", url: "/", source: "manuel", status: "cancelled", createdAt: T(-50e3), createdBy: "admin" });
  await db.collection("notifications").doc("n3").set({ title: "Lien externe", body: "Texte", category: "annonces", url: "https://evil.example", source: "manuel", status: "pending", createdAt: T(-40e3), createdBy: "admin" });
  // n4 : interrompue au milieu (bail expiré) après avoir servi FID-A : reprise après le curseur
  await db.collection("notifications").doc("n4").set({ title: "Reprise", body: "Texte", category: "annonces", url: "/", source: "manuel", status: "sending", startedAt: T(-30e3), leaseUntil: T(-1), cursor: "u1_aaaaaaaa", createdAt: T(-30e3), createdBy: "admin" });
  await run();
  assert.deepEqual(sent.sort(), ["n1>FID-A", "n1>FID-B", "n4>FID-B"]);
  assert.equal((await db.doc("notifications/n2").get()).data().status, "cancelled");
  assert.equal((await db.doc("notifications/n3").get()).data().status, "failed");
  for (let i = 0; i < 6; i++) await db.collection("notifications").doc("q" + i).set({ title: "Q" + i, body: "x", category: "annonces", url: "/", source: "manuel", status: "pending", createdAt: T(-20e3 + i), createdBy: "admin" });
  await run();
  const st = await Promise.all([0, 1, 2, 3, 4, 5].map(i => db.doc("notifications/q" + i).get().then(d => d.data().status)));
  assert.equal(st.filter(s => s === "refused").length, 3, "limite de 5 envois manuels par 24 h (n1 et n4 déjà comptées)");
});

test("solennité du jour et erreur globale", async () => {
  const r = await run({ now: new Date("2026-11-01T07:00:00Z") });
  assert.ok(r.created.includes("liturgie_2026-11-01"));
  sent = []; await run({ now: new Date("2026-11-01T08:00:00Z") });
  assert.equal(sent.length, 0);
  await db.collection("notifications").doc("f1").set({ title: "T", body: "B", category: "annonces", url: "/", source: "manuel", status: "pending", createdAt: T(-1), createdBy: "admin" });
  await runOnce({ db, FieldValue, Timestamp, now: NOW, log: () => {}, send: async () => ({ ok: false, kind: "fatal", code: "PERMISSION_DENIED" }) });
  const f = (await db.doc("notifications/f1").get()).data();
  assert.equal(f.status, "failed"); assert.ok((await db.doc("push_subscriptions/u2_bbbbbbbb").get()).exists, "aucun abonnement supprimé sur erreur globale");
});
