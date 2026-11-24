import { test } from "node:test";
import assert from "node:assert/strict";
import { encoder, decoder, lireTout, enveloppe, controler, comparer } from "../server/sauvegarde-lib.mjs";

// Faux Firestore minimal : documents à plat { "a/1": {...}, "a/1/b/2": {...} } ; null = document absent avec sous-collections
class Ts { constructor(s, n) { this.seconds = s; this.nanoseconds = n; } toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6; } }
class Geo { constructor(a, b) { this.latitude = a; this.longitude = b; } isEqual() { return true; } }
function fauxDb(donnees) {
  const db = {
    doc: chemin => ref(chemin),
    listCollections: async () => cols(""),
    getAll: async (...refs) => refs.map(r => ({ exists: donnees[r.path] != null, data: () => donnees[r.path] })),
  };
  const enfants = prefixe => [...new Set(Object.keys(donnees).filter(k => k.startsWith(prefixe)).map(k => k.slice(prefixe.length).split("/")[0]))];
  const cols = base => enfants(base ? base + "/" : "").map(c => ({ listDocuments: async () => enfants((base ? base + "/" : "") + c + "/").map(id => ref((base ? base + "/" : "") + c + "/" + id)) }));
  const ref = path => ({ path, firestore: db, collection() {}, listCollections: async () => cols(path) });
  return db;
}

test("sauvegarde : types Firestore conservés à l'aller et au retour", () => {
  const db = fauxDb({});
  const v = { quand: new Ts(1795380304, 123000000), ou: new Geo(48.85, 2.35), lien: db.doc("missions/m1"), brut: Buffer.from([1, 2, 255]),
    liste: [1, "a", null, { x: true }], __type: "champ réel", infini: Infinity };
  const e = encoder(v);
  assert.deepEqual(e.v.quand, { __type: "date", s: 1795380304, n: 123000000 });
  const d = decoder(JSON.parse(JSON.stringify(e)), { Timestamp: Ts, GeoPoint: Geo, db });
  assert.equal(d.quand.seconds, 1795380304); assert.equal(d.ou.longitude, 2.35); assert.equal(d.lien.path, "missions/m1");
  assert.deepEqual([...d.brut], [1, 2, 255]); assert.equal(d.__type, "champ réel"); assert.equal(d.infini, Infinity);
  assert.deepEqual(JSON.stringify(encoder(d)), JSON.stringify(e));   // reconstruction identique
});

test("sauvegarde : parcours complet, sous-collections et documents parents absents", async () => {
  const db = fauxDb({ "missions/m1": { titre: "Accueil" }, "users/u1/journal/j1": { notes: "x" }, "users/u1/visits/v1": { n: 1 }, "users/u2": { nom: "B" }, "users/u1": null });
  const docs = await lireTout(db, { parLot: 1 });
  assert.deepEqual(Object.keys(docs).sort(), ["missions/m1", "users/u1", "users/u1/journal/j1", "users/u1/visits/v1", "users/u2"]);
  assert.equal(docs["users/u1"], null);
  const b = enveloppe("guardian-angel-62a43", docs);
  assert.deepEqual(controler(b), []);
  assert.deepEqual(controler({ format: "autre" }), ["ce fichier n'est pas une sauvegarde de Guardian Angel"]);
  const apres = { ...docs, "missions/m1": { titre: "Accueil 2" }, "missions/m2": { titre: "Nouveau" } }; delete apres["users/u2"];
  const c = comparer(b.documents, apres);
  assert.deepEqual(c.missions, { sauvegarde: 1, base: 2, identiques: 0, modifies: 1, ajoutes: 1, disparus: 0 });
  assert.deepEqual(c.users, { sauvegarde: 3, base: 2, identiques: 2, modifies: 0, ajoutes: 0, disparus: 1 });
});
