// Tests des règles Firestore — npm run test:rules (démarre l'émulateur ; Java requis)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: "demo-guardian", firestore: { rules, host: "127.0.0.1", port: 8080 } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, "admins/boss"), { ok: true });
    await setDoc(doc(db, "missions/m1"), { titre: "Chorale", status: "published" });
    await setDoc(doc(db, "missions/m2"), { titre: "Brouillon", status: "draft" });
    await setDoc(doc(db, "users/alice/meta/consent"), { version: 1 });
  });
});
const as = uid => env.authenticatedContext(uid, { email: uid + "@example.com" }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const entry = { id: "e1", date: "2026-11-08", categorie: "Messe", eglise: "Saint-Sulpice", notes: "Veiller" };

test("journal : privé, propriétaire seulement, consentement requis", async () => {
  await assertSucceeds(setDoc(doc(as("alice"), "users/alice/journal/e1"), entry));
  await assertSucceeds(getDoc(doc(as("alice"), "users/alice/journal/e1")));
  await assertFails(getDoc(doc(as("eve"), "users/alice/journal/e1")));
  await assertFails(getDoc(doc(as("boss"), "users/alice/journal/e1")));       // même un administrateur ne lit pas le journal
  await assertFails(getDoc(doc(anon(), "users/alice/journal/e1")));
  await assertFails(setDoc(doc(as("bob"), "users/bob/journal/e1"), entry));   // pas de consentement enregistré
  await assertSucceeds(setDoc(doc(as("bob"), "users/bob/meta/consent"), { version: 1, scope: "journal-spirituel" }));
  await assertSucceeds(setDoc(doc(as("bob"), "users/bob/journal/e1"), entry));
});
test("journal et visites : validation", async () => {
  await assertFails(setDoc(doc(as("alice"), "users/alice/journal/e1"), { ...entry, id: "autre" }));
  await assertFails(setDoc(doc(as("alice"), "users/alice/journal/e1"), { ...entry, date: "hier" }));
  await assertFails(setDoc(doc(as("alice"), "users/alice/journal/e1"), { ...entry, admin: true }));
  await assertSucceeds(setDoc(doc(as("alice"), "users/alice/visits/w1"), { churchId: "w1", nom: "Notre-Dame", date: "2026-11-01", note: "" }));
  await assertFails(setDoc(doc(as("alice"), "users/alice/visits/w1"), { churchId: "w2", nom: "x", date: "2026-11-01" }));
  await assertSucceeds(deleteDoc(doc(as("alice"), "users/alice/visits/w1")));
});
test("missions : publiées lisibles par tous, écriture réservée aux administrateurs", async () => {
  await assertSucceeds(getDoc(doc(anon(), "missions/m1")));
  await assertFails(getDoc(doc(anon(), "missions/m2")));
  await assertSucceeds(getDocs(query(collection(anon(), "missions"), where("status", "==", "published"))));
  await assertFails(setDoc(doc(as("alice"), "missions/m3"), { titre: "Faux", status: "published" }));
  await assertSucceeds(setDoc(doc(as("boss"), "missions/m3"), { titre: "Accueil", status: "published" }));
  await assertFails(setDoc(doc(as("alice"), "admins/alice"), { ok: true }));
});
test("candidatures et signalements", async () => {
  const app = { uid: "alice", missionId: "m1", email: "alice@example.com", message: "Je chante", competences: "", disponibilites: "", status: "envoyée" };
  await assertSucceeds(setDoc(doc(as("alice"), "applications/m1_alice"), app));
  await assertFails(setDoc(doc(as("eve"), "applications/m1_alice"), app));
  await assertFails(setDoc(doc(as("alice"), "applications/m2_alice"), { ...app, missionId: "m2" }));   // mission non publiée
  await assertFails(setDoc(doc(as("alice"), "applications/x"), app));
  await assertSucceeds(getDocs(query(collection(as("alice"), "applications"), where("uid", "==", "alice"))));
  await assertFails(getDoc(doc(as("eve"), "applications/m1_alice")));
  await assertSucceeds(getDoc(doc(as("boss"), "applications/m1_alice")));
  await assertSucceeds(deleteDoc(doc(as("alice"), "applications/m1_alice")));
  await assertSucceeds(setDoc(doc(as("alice"), "reports/r1"), { uid: "alice", churchId: "w1", churchName: "ND", message: "Horaire faux", status: "nouveau" }));
  await assertFails(getDoc(doc(as("alice"), "reports/r1")));
  await assertFails(setDoc(doc(anon(), "reports/r2"), { uid: "x", message: "spam", status: "nouveau" }));
});

const anonUser = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const subDoc = (uid, dev, extra = {}) => ({ uid, deviceId: dev, kind: "fid", target: "FID-0123456789", categories: ["missions"], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
test("abonnements push : privés, sans compte, validés", async () => {
  const a = anonUser("anon1");
  await assertSucceeds(setDoc(doc(a, "push_subscriptions/anon1_abcdefgh"), subDoc("anon1", "abcdefgh")));
  await assertSucceeds(getDoc(doc(a, "push_subscriptions/anon1_abcdefgh")));
  await assertSucceeds(updateDoc(doc(a, "push_subscriptions/anon1_abcdefgh"), { categories: ["missions", "annonces"], active: false, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(anon(), "push_subscriptions/anon1_abcdefgh")));          // non connecté
  await assertFails(getDoc(doc(as("eve"), "push_subscriptions/anon1_abcdefgh")));       // autre utilisateur
  await assertFails(getDoc(doc(as("boss"), "push_subscriptions/anon1_abcdefgh")));      // même un administrateur
  await assertFails(getDocs(collection(as("boss"), "push_subscriptions")));
  await assertFails(setDoc(doc(a, "push_subscriptions/anon1_zzzzzzzz"), subDoc("anon1", "abcdefgh")));   // id incohérent
  await assertFails(setDoc(doc(a, "push_subscriptions/eve_abcdefgh"), subDoc("eve", "abcdefgh")));       // pour quelqu'un d'autre
  await assertFails(setDoc(doc(a, "push_subscriptions/anon1_bbbbbbbb"), subDoc("anon1", "bbbbbbbb", { categories: ["pub"] })));
  await assertFails(setDoc(doc(a, "push_subscriptions/anon1_cccccccc"), subDoc("anon1", "cccccccc", { email: "x@y.z" })));
  await assertFails(updateDoc(doc(a, "push_subscriptions/anon1_abcdefgh"), { uid: "eve", updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(a, "push_subscriptions/anon1_abcdefgh")));
});
test("session anonyme : aucun accès aux données de compte", async () => {
  const a = anonUser("anon2");
  await assertFails(setDoc(doc(a, "users/anon2/meta/consent"), { version: 1 }));
  await assertFails(setDoc(doc(a, "reports/r9"), { uid: "anon2", churchId: "w1", churchName: "ND", message: "x", status: "nouveau" }));
  await assertSucceeds(getDoc(doc(a, "missions/m1")));
});
test("notifications : création et annulation réservées aux administrateurs, contenu contrôlé", async () => {
  const n = { title: "Annonce", body: "Texte", category: "annonces", url: "/#/missions", source: "manuel", status: "pending", createdBy: "boss", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(as("boss"), "notifications/n1"), n));
  await assertSucceeds(getDoc(doc(as("boss"), "notifications/n1")));
  await assertFails(getDoc(doc(as("alice"), "notifications/n1")));
  await assertFails(setDoc(doc(as("alice"), "notifications/n2"), { ...n, createdBy: "alice" }));
  await assertFails(setDoc(doc(anonUser("boss"), "notifications/n3"), n));                // session anonyme portant le même uid
  await assertFails(setDoc(doc(as("boss"), "notifications/n4"), { ...n, url: "https://evil.example" }));
  await assertFails(setDoc(doc(as("boss"), "notifications/n5"), { ...n, status: "sent" }));
  await assertFails(setDoc(doc(as("boss"), "notifications/n6"), { ...n, category: "pub" }));
  await assertFails(updateDoc(doc(as("boss"), "notifications/n1"), { status: "sent" }));
  await assertSucceeds(updateDoc(doc(as("boss"), "notifications/n1"), { status: "cancelled" }));
  await assertFails(updateDoc(doc(as("boss"), "notifications/n1"), { status: "pending" }));
  await assertFails(deleteDoc(doc(as("boss"), "notifications/n1")));
});
