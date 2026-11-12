import { test } from "node:test";
import assert from "node:assert/strict";
import { runSender, validateNotification, safeLink, buildMessage, missionNotification, CATEGORIES } from "../scripts/notify-core.mjs";

// Base en mémoire reproduisant le contrat de scripts/notify-store.mjs
function memStore({ missions = [], notifs = [], subs = [], admins = ["boss"] } = {}) {
  const N = new Map(notifs.map(n => [n.id, { ...n }])), S = new Map(subs.map(s => [s.id, { ...s }])), M = new Map(missions.map(m => [m.id, { ...m }]));
  return { N, S, M,
    listNewMissions: async since => [...M.values()].filter(m => m.status === "published" && !m.notifiedAt && m.createdAt >= since),
    enqueueOnce: async (n, mid, now) => { const m = M.get(mid); if (!m || m.notifiedAt) return false; m.notifiedAt = now; if (N.has(n.id)) return false; N.set(n.id, { ...n, status: "queued", createdAt: now }); return true; },
    failStale: async (before, error) => { for (const n of N.values()) if (n.status === "sending" && (n.claimedAt || 0) < before) Object.assign(n, { status: "failed", error }); },
    countSince: async since => [...N.values()].filter(n => (n.finishedAt || 0) >= since).length,
    listQueued: async l => [...N.values()].filter(n => n.status === "queued").slice(0, l).map(n => ({ ...n })),
    claim: async (id, now) => { const n = N.get(id); if (!n || n.status !== "queued") return false; n.status = "sending"; n.claimedAt = now; return true; },
    isAdmin: async uid => admins.includes(uid),
    listSubscribers: async c => [...S.values()].filter(s => s.active && s.categories.includes(c)).map(s => ({ id: s.id, fid: s.fid })),
    deactivate: async id => { S.delete(id); },
    complete: async (id, r) => { Object.assign(N.get(id), r); } };
}
function fakeMessaging(dead = []) {
  const calls = [];
  return { calls, sendEachForMulticast: async msg => { calls.push(msg); return { responses: msg.fids.map(f => dead.includes(f) ? { success: false, error: { code: "messaging/installation-id-not-registered" } } : { success: true }) }; } };
}
const sub = (i, cats = ["infos"], active = true) => ({ id: "h" + i, fid: "fid" + i, categories: cats, active });
const manual = (id, o = {}) => ({ id, source: "manual", createdBy: "boss", status: "queued", title: "Messe de minuit", body: "Horaires de Noël publiés", category: "infos", link: "/#/carte", ...o });
const NOW = 1_800_000_000_000;

test("validation et contrôle des liens", () => {
  assert.deepEqual(validateNotification(manual("a")), []);
  assert.ok(validateNotification(manual("a", { title: "" })).length);
  assert.ok(validateNotification(manual("a", { body: "x".repeat(241) })).length);
  assert.ok(validateNotification(manual("a", { category: "pub" })).length);
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/#/a?b=<script>"]) { assert.ok(validateNotification(manual("a", { link: bad })).length, bad); assert.equal(safeLink(bad), "/"); }
  assert.equal(safeLink("/#/missions"), "/#/missions"); assert.equal(safeLink("/"), "/");
  const m = buildMessage(manual("n1"), ["f1"]);
  assert.equal(m.data.tag, "n1"); assert.ok(!("notification" in m), "message « données seules » : un seul affichage"); assert.deepEqual(m.fids, ["f1"]);
  assert.equal(Object.keys(CATEGORIES).length, 4);
});

test("envoi manuel : seuls les abonnés de la catégorie, une seule fois", async () => {
  const store = memStore({ notifs: [manual("n1")], subs: [sub(1), sub(2, ["missions"]), sub(3, ["infos"], false), sub(4, ["infos", "app"])] });
  const fm = fakeMessaging();
  const r1 = await runSender({ store, messaging: fm, now: NOW });
  assert.equal(r1.sent, 1); assert.deepEqual(fm.calls[0].fids, ["fid1", "fid4"]);
  assert.equal(store.N.get("n1").status, "sent"); assert.equal(store.N.get("n1").success, 2);
  const r2 = await runSender({ store, messaging: fm, now: NOW + 1000 });
  assert.equal(r2.sent, 0); assert.equal(fm.calls.length, 1, "aucun doublon au passage suivant");
});

test("abonnements invalides retirés, lots de 500", async () => {
  const subs = Array.from({ length: 1201 }, (_, i) => sub(i));
  const store = memStore({ notifs: [manual("n1")], subs }), fm = fakeMessaging(["fid7", "fid900"]);
  const r = await runSender({ store, messaging: fm, now: NOW });
  assert.deepEqual(fm.calls.map(c => c.fids.length), [500, 500, 201]);
  assert.equal(r.removed, 2); assert.ok(!store.S.has("h7") && !store.S.has("h900")); assert.equal(store.N.get("n1").failure, 2);
});

test("protections : auteur non administrateur, contenu invalide, envoi interrompu", async () => {
  const store = memStore({ subs: [sub(1)], notifs: [manual("x", { createdBy: "eve" }), manual("y", { link: "https://evil.example" }), manual("z", { status: "sending", claimedAt: NOW - 3600e3 })] });
  const fm = fakeMessaging();
  const r = await runSender({ store, messaging: fm, now: NOW });
  assert.equal(fm.calls.length, 0); assert.equal(r.failed, 2);
  assert.equal(store.N.get("x").status, "failed"); assert.equal(store.N.get("y").status, "failed");
  assert.equal(store.N.get("z").status, "failed", "un envoi interrompu n'est pas relancé");
});

test("envoi automatique : mission publiée une fois ; ni brouillon, ni ancienne, ni déjà notifiée", async () => {
  const store = memStore({ subs: [sub(1, ["missions"])], missions: [
    { id: "m1", status: "published", titre: "Chorale", paroisse: "Saint-Sulpice", domaine: "Chorale", createdAt: NOW - 1000 },
    { id: "m2", status: "draft", titre: "Brouillon", createdAt: NOW - 1000 },
    { id: "m3", status: "published", titre: "Ancienne", createdAt: NOW - 72 * 3600e3 },
    { id: "m4", status: "published", titre: "Déjà", createdAt: NOW - 1000, notifiedAt: NOW - 500 }] });
  const fm = fakeMessaging();
  const r = await runSender({ store, messaging: fm, now: NOW });
  assert.equal(r.enqueued, 1); assert.equal(fm.calls.length, 1);
  assert.equal(fm.calls[0].data.title, "Nouvelle mission : Chorale"); assert.equal(fm.calls[0].data.link, "/#/missions");
  store.M.get("m1").titre = "Chorale (modifiée)";
  await runSender({ store, messaging: fm, now: NOW + 60000 });
  assert.equal(fm.calls.length, 1, "une modification ne renvoie rien");
  assert.equal(missionNotification({ id: "a" }).id, "mission_a");
});

test("plafond quotidien", async () => {
  const done = Array.from({ length: 30 }, (_, i) => manual("d" + i, { status: "sent", finishedAt: NOW - 1000 }));
  const store = memStore({ subs: [sub(1)], notifs: [...done, manual("n")] }), fm = fakeMessaging();
  await runSender({ store, messaging: fm, now: NOW });
  assert.equal(fm.calls.length, 0); assert.equal(store.N.get("n").status, "failed");
});
