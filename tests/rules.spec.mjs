// Tests des règles Firestore — lancer avec : npm run test:rules (démarre l'émulateur automatiquement)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-guardian", firestore: { rules, host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "jours/2026-11-08"), { titre: "Test" }); });
});

const me = () => env.authenticatedContext("alice", { email: "alice@example.com", email_verified: true }).firestore();
const eve = () => env.authenticatedContext("eve", { email: "eve@example.com", email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const note = { date: "2026-11-08", titreJour: "32e dimanche", eglise: "", celebrant: "", homelie: "Veiller", perso: "" };

test("lectures : lisibles par tous, même sans compte, jamais modifiables", async () => {
  await assertSucceeds(getDoc(doc(anon(), "jours/2026-11-08")));
  await assertSucceeds(getDoc(doc(me(), "jours/2026-11-08")));
  await assertFails(setDoc(doc(me(), "jours/2026-11-08"), { titre: "x" }));
  await assertFails(setDoc(doc(anon(), "jours/2026-11-08"), { titre: "x" }));
});

test("notes : chacun ses notes", async () => {
  await assertSucceeds(setDoc(doc(me(), "users/alice/notes/2026-11-08"), note));
  await assertSucceeds(getDoc(doc(me(), "users/alice/notes/2026-11-08")));
  await assertSucceeds(deleteDoc(doc(me(), "users/alice/notes/2026-11-08")));
  await assertSucceeds(setDoc(doc(eve(), "users/eve/notes/2026-11-08"), note));
  await assertFails(getDoc(doc(eve(), "users/alice/notes/2026-11-08")));
  await assertFails(setDoc(doc(me(), "users/eve/notes/2026-11-08"), note));
  await assertFails(setDoc(doc(anon(), "users/alice/notes/2026-11-08"), note));
});

test("notes : validation du contenu", async () => {
  await assertFails(setDoc(doc(me(), "users/alice/notes/2026-11-09"), note));                 // date ≠ id
  await assertFails(setDoc(doc(me(), "users/alice/notes/pas-une-date"), { ...note, date: "pas-une-date" }));
  await assertFails(setDoc(doc(me(), "users/alice/notes/2026-11-08"), { ...note, admin: true }));
  await assertFails(setDoc(doc(me(), "users/alice/notes/2026-11-08"), { ...note, homelie: 42 }));
});
