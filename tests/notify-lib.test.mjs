import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, pickRecipients, buildMessage, classify, liturgicalNotification, missionNotification, paris } from "../server/lib.mjs";

test("validation des notifications et des liens", () => {
  const ok = { title: "Titre", body: "Message", category: "annonces", url: "/#/missions" };
  assert.deepEqual(validate(ok), []);
  assert.ok(validate({ ...ok, url: "https://evil.example" }).includes("lien"));
  assert.ok(validate({ ...ok, url: "javascript:alert(1)" }).includes("lien"));
  assert.ok(validate({ ...ok, url: "//evil.example" }).includes("lien"));
  assert.ok(validate({ ...ok, category: "pub" }).includes("catégorie"));
  assert.ok(validate({ ...ok, title: "x".repeat(66) }).includes("titre"));
  assert.ok(validate({ ...ok, body: "" }).includes("message"));
});
test("destinataires : catégorie, actifs, sans doublon de cible", () => {
  const s = (id, target, cats, active, t) => ({ id, kind: "fid", target, categories: cats, active, updatedAt: t });
  const { recipients, duplicates } = pickRecipients([
    s("a_1", "F1", ["missions"], true, 1), s("b_1", "F1", ["missions", "annonces"], true, 5),  // même appareil, deux comptes : le plus récent
    s("c_1", "F2", ["annonces"], true, 1), s("d_1", "F3", ["missions"], false, 1),            // autre catégorie / en pause
    s("e_1", "F4", ["missions"], true, 1), { id: "x", kind: "autre", target: "F5" }
  ], "missions");
  assert.deepEqual(recipients.map(r => r.id), ["b_1", "e_1"]);
  assert.deepEqual(duplicates, ["a_1"]);
});
test("message FCM : cible fid ou token, données uniquement", () => {
  const n = { title: "T", body: "B", url: "/", category: "annonces" };
  const m = buildMessage({ kind: "fid", target: "FID1" }, n, "n1").message;
  assert.equal(m.fid, "FID1"); assert.equal(m.token, undefined); assert.equal(m.notification, undefined);
  assert.deepEqual(m.data, { nid: "n1", title: "T", body: "B", url: "/", category: "annonces" });
  assert.equal(buildMessage({ kind: "token", target: "TOK" }, n, "n1").message.token, "TOK");
});
test("classement des erreurs FCM", () => {
  assert.equal(classify(404, { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }).kind, "invalid");
  assert.equal(classify(403, { error: { status: "PERMISSION_DENIED", details: [{ errorCode: "SENDER_ID_MISMATCH" }] } }).kind, "invalid");
  assert.equal(classify(403, { error: { status: "PERMISSION_DENIED" } }).kind, "fatal");
  assert.equal(classify(401, null).kind, "fatal");
  assert.equal(classify(429, null).kind, "retry");
  assert.equal(classify(503, null).kind, "retry");
  assert.equal(classify(0, null).kind, "retry");
  assert.equal(classify(400, { error: { status: "INVALID_ARGUMENT" } }).kind, "skip");   // jamais de suppression sur erreur ambiguë
});
test("notifications automatiques", () => {
  assert.equal(paris(new Date("2026-11-01T06:30:00Z")).hour, 7);
  const t = liturgicalNotification(new Date("2026-11-01T07:00:00Z"));           // Toussaint, 8 h à Paris
  assert.equal(t.id, "liturgie_2026-11-01"); assert.equal(t.category, "liturgie");
  assert.equal(liturgicalNotification(new Date("2026-11-01T18:00:00Z")), null);  // l'après-midi : rien
  assert.equal(liturgicalNotification(new Date("2026-11-12T08:00:00Z")), null);  // férie : rien
  const m = missionNotification("abc", { titre: "Chorale", paroisse: "Saint-Sulpice" });
  assert.equal(m.id, "mission_abc"); assert.equal(m.url, "/#/missions"); assert.ok(m.body.includes("Saint-Sulpice"));
});
