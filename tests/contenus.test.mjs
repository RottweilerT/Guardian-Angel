import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ORDO } from "../public/js/ordo.js";
import { normalize, QUERY_ARR } from "../scripts/fetch-churches.mjs";
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
test("extraction OpenStreetMap : normalisation", () => {
  assert.ok(QUERY_ARR.includes("75101") && QUERY_ARR.includes("75120"));
  const els = [
    { type: "way", id: 1, center: { lat: 48.853, lon: 2.3499 }, tags: { name: "Cathédrale Notre-Dame de Paris", website: "https://x.example", wheelchair: "yes", service_times: "Su 10:00", wikidata: "Q2981" } },
    { type: "count", id: 0 }, { type: "count", id: 0 },
    { type: "node", id: 2, lat: 48.86, lon: 2.34, tags: { name: "Saint-Eustache", "addr:postcode": "75001", wheelchair: "peut-être" } },
    { type: "node", id: 2, lat: 48.86, lon: 2.34, tags: {} }, { type: "relation", id: 3, tags: { name: "Sans coordonnées" } }
  ];
  const r = normalize(els, { byArr: true });
  assert.equal(r.length, 2);
  const nd = r.find(c => c.id === "w1"), eu = r.find(c => c.id === "n2");
  assert.equal(nd.arr, 1); assert.equal(eu.arr, 3); assert.equal(nd.serviceTimes, "Su 10:00"); assert.equal(eu.wheelchair, undefined);
  assert.equal(normalize(els)[1].arr ?? normalize(els)[0].arr, 1);
});
