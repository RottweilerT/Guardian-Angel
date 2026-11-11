import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ORDO } from "../public/js/ordo.js";
import { normalize, arrondissements, inside, QUERY } from "../scripts/fetch-churches.mjs";
const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const OK = ["PUBLIC_DOMAIN", "OPEN_LICENSE_VERIFIED", "PERMISSION_GRANTED"];
const STATUTS = [...OK, "PERMISSION_REQUIRED", "LEGAL_REVIEW_REQUIRED", "PROHIBITED"];

test("registre des droits : complet, et aucune ressource non autorisée n'est utilisée", () => {
  const reg = J("../public/data/content-rights.json");
  assert.ok(reg.ressources.length >= 10);
  for (const r of reg.ressources) {
    for (const k of ["nom", "type", "licence", "verifie_le", "statut"]) assert.ok(r[k], r.nom + " : champ " + k);
    assert.ok(STATUTS.includes(r.statut), r.nom);
    if (r.utilise) assert.ok(OK.includes(r.statut), r.nom + " est utilisée sans droits établis");
    if (r.statut === "PERMISSION_REQUIRED") assert.ok(r.demander_a, r.nom + " : destinataire de la demande manquant");
  }
});
test("missel : aucun texte français liturgique, latin seulement pour des parties du domaine public", () => {
  for (const cal of ["romain", "m1962"]) for (const p of ORDO[cal]) {
    assert.ok(!("fr" in p), p.id);
    if (p.la) assert.equal(p.droits, "PUBLIC_DOMAIN", p.id);
    if (p.propre) assert.ok(/AUTORISATION À DEMANDER/.test(p.manque), p.id);
  }
});
test("lectures : références et résumés seulement", () => {
  const dir = new URL("../public/data/lectures/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const d = J("../public/data/lectures/" + f);
    assert.equal(d.date + ".json", f);
    for (const l of d.lectures) assert.ok(!("contenu" in l), f + " contient un texte intégral");
  }
});
test("parcours : structure", () => {
  for (const r of J("../public/data/routes.json").routes) { assert.ok(r.id && r.titre && r.etapes.length >= 3); r.etapes.forEach(s => assert.ok(s.nom && s.texte && s.match.length)); }
});
test("extraction OpenStreetMap : normalisation et arrondissements", () => {
  const sq = (n, lat, lon) => ({ type: "relation", tags: { "ref:INSEE": "751" + String(n).padStart(2, "0") }, members: [
    { type: "way", role: "outer", geometry: [{ lat, lon }, { lat: lat + 0.01, lon }, { lat: lat + 0.01, lon: lon + 0.02 }] },
    { type: "way", role: "outer", geometry: [{ lat: lat + 0.01, lon: lon + 0.02 }, { lat, lon: lon + 0.02 }, { lat, lon }] }] });
  const arrs = arrondissements([sq(4, 48.85, 2.34), sq(1, 48.86, 2.33)]);
  assert.equal(arrs.length, 2);
  assert.ok(inside(48.853, 2.3499, arrs[0].rings)); assert.ok(!inside(48.853, 2.3499, arrs[1].rings));
  const els = [
    { type: "way", id: 1, center: { lat: 48.853, lon: 2.3499 }, tags: { name: "Cathédrale Notre-Dame de Paris", website: "https://x.example", wheelchair: "yes", service_times: "Su 10:00", wikidata: "Q2981" } },
    { type: "node", id: 2, lat: 48.8634, lon: 2.345, tags: { name: "Saint-Eustache", wheelchair: "peut-être" } },
    { type: "node", id: 5, lat: 48.9, lon: 2.4, tags: { name: "Hors contours", "addr:postcode": "75019" } },
    { type: "node", id: 2, lat: 48.86, lon: 2.34, tags: {} }, { type: "relation", id: 3, tags: { name: "Sans coordonnées" } }
  ];
  const r = normalize(els, arrs);
  assert.equal(r.length, 3);
  const by = id => r.find(c => c.id === id);
  assert.equal(by("w1").arr, 4); assert.equal(by("n2").arr, 1); assert.equal(by("n5").arr, 19);
  assert.equal(by("w1").serviceTimes, "Su 10:00"); assert.equal(by("n2").wheelchair, undefined);
  assert.ok(QUERY.includes("3600007444"));
});
