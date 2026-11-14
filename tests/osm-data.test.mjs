import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildChurches, buildStreets, CATHOLIQUES } from "../scripts/build-osm-data.mjs";
const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("données OSM : églises construites depuis le fichier téléchargé", () => {
  const fc = J("../data/osm/eglises_paris.geojson"), out = buildChurches(fc, J("../data/osm/complements.json").par_osm);
  assert.equal(out.length, fc.features.length);
  assert.equal(new Set(out.map(c => c.id)).size, out.length);
  for (const c of out) {
    assert.ok(c.lat > 48.8 && c.lat < 48.91 && c.lon > 2.22 && c.lon < 2.47, c.id);
    assert.equal(c.catholique, c.denomination ? CATHOLIQUES.has(c.denomination) : undefined);
    if (c.geom) for (const pl of c.geom) for (const r of pl) assert.deepEqual(r[0], r.at(-1));
  }
  assert.ok(out.some(c => c.name === "Basilique du Sacré-Cœur" && c.catholique));
  assert.ok(out.some(c => c.name === "Cathédrale Notre-Dame de Paris" && c.catholique !== false));  // confession non saisie dans OSM : reste visible avec « Catholiques »;
});

test("données OSM : index des rues", () => {
  const out = buildStreets(J("../data/osm/rues_paris.geojson"));
  assert.ok(out.length > 5000);
  const r = out.find(x => x[0] === "Rue de Rivoli");
  assert.ok(r && r[3].includes(1) && r[3].includes(4));
});

test("données publiées à jour et attribuées", () => {
  for (const f of ["churches", "rues"]) {
    const d = J(`../public/data/${f}.json`);
    assert.match(d.meta.attribution, /contributeurs d'OpenStreetMap/);
    assert.equal(d.meta.licence, "ODbL 1.0");
  }
});
