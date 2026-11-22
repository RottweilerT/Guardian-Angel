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

import { ETAPES } from "../public/js/messe-etapes.js";
test("missel : déroulement des deux formes, titres seulement", () => {
  for (const f of ["ordinaire", "extraordinaire"]) {
    const all = ETAPES[f].sections.flatMap(([s, e]) => e);
    assert.ok(all.length >= 25, f);
    for (const [t] of all) assert.ok(typeof t === "string" && t.length > 2);
  }
  const ef = ETAPES.extraordinaire.sections.flatMap(([, e]) => e.map(x => x[0]));
  assert.ok(ef.includes("Dernier Évangile") && ef.includes("Introït"));
});

test("missel de 1962 : données jour par jour (latin + lectures Fillion, aucune traduction protégée)", () => {
  const dir = new URL("../public/missel1962/jours/", import.meta.url);
  const fichiers = readdirSync(dir);
  assert.ok(fichiers.length >= 365, "au moins un an de données");
  for (const f of fichiers) {
    const d = J("../public/missel1962/jours/" + f);
    assert.equal(d.date + ".json", f);
    assert.ok(d.titre_fr, f + " : intitulé français");
    assert.ok(d.messes.length >= 1, f);
    for (const m of d.messes) for (const s of m.sections) {
      assert.ok(s.id && s.titre && typeof s.la === "string", f + " " + s.id);
      if ("fr" in s) assert.ok(/^(Lectio|Evangelium|Passio)/.test(s.id), f + " : français hors lectures bibliques (" + s.id + ")");
    }
  }
  const o = J("../public/missel1962/ordo.json");
  assert.ok(o.parties.length >= 25);
  for (const p of o.parties) for (const t of p.la) assert.ok(!/today|Mass|Priest/.test(t), "rubrique anglaise dans l'ordinaire : " + t.slice(0, 40));
  assert.deepEqual(J("../public/missel1962/jours/2026-11-22.json").messes[0].sections.find(s => s.id === "Evangelium").ref, "Matt 24:15-35");
});

test("missel (forme ordinaire) : lectures du jour, références + Bible Fillion seulement", () => {
  const dir = new URL("../public/missel-ordinaire/jours/", import.meta.url);
  const fichiers = readdirSync(dir);
  assert.ok(fichiers.length >= 300);
  let avecTexte = 0, total = 0;
  for (const f of fichiers) {
    const d = J("../public/missel-ordinaire/jours/" + f);
    assert.equal(d.date + ".json", f);
    assert.ok(d.lectures.some(l => l.id === "gospel"), f + " : évangile");
    for (const l of d.lectures) {
      assert.deepEqual(Object.keys(l).filter(k => !["id", "titre", "ref", "ref_fr", "livre", "ref_vulgate", "courte", "fr"].includes(k)), [], f);
      total++; if (l.fr) avecTexte++;
    }
  }
  assert.ok(avecTexte / total > 0.95, "au moins 95 % des lectures avec leur texte");
  // 1er dimanche de l'Avent 2026 (année B) : Isaïe 63-64, Psaume 80 (79 Vulgate), 1 Co 1, Marc 13
  const a = J("../public/missel-ordinaire/jours/2026-11-29.json").lectures;
  assert.match(a[0].fr, /Vous êtes notre père/);
  assert.equal(a[1].ref_vulgate.split(":")[0], "79");
  assert.match(a.find(l => l.id === "gospel").ref, /^Mark 13/);
  // France : Saint-Sacrement le dimanche 30 mai 2027, Épiphanie le 3 janvier 2027
  assert.match(J("../public/missel-ordinaire/jours/2027-05-30.json").celebration_en, /Body and Blood/);
  assert.match(J("../public/missel-ordinaire/jours/2027-01-03.json").celebration_en, /^The Epiphany/);
});
