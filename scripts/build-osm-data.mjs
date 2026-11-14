#!/usr/bin/env node
// Construit les données de l'application à partir des fichiers OpenStreetMap téléchargés (data/osm/) :
//   data/osm/eglises_paris.geojson (+ complements.json) → public/data/churches.json
//   data/osm/rues_paris.geojson                         → public/data/rues.json (index des noms de voies)
// Données © les contributeurs d'OpenStreetMap — ODbL 1.0. Aucun accès réseau.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const P = p => fileURLToPath(new URL("../" + p, import.meta.url));
const J = p => JSON.parse(readFileSync(P(p), "utf8"));
const ATTRIBUTION = "© les contributeurs d'OpenStreetMap", LICENCE = "ODbL 1.0";

// Confessions en communion avec Rome (rite latin et Églises catholiques orientales)
export const CATHOLIQUES = new Set(["catholic", "roman_catholic", "greek_catholic", "coptic_catholic", "maronite",
  "armenian_catholic", "chaldean_catholic", "syriac_catholic", "melkite", "ukrainian_greek_catholic", "ruthenian"]);
const LIBELLES = {
  catholic: "catholique", roman_catholic: "catholique", greek_catholic: "catholique de rite byzantin", coptic_catholic: "copte catholique",
  maronite: "maronite (catholique)", armenian_catholic: "arménienne catholique", melkite: "melkite (catholique)",
  protestant: "protestante", lutheran: "luthérienne", reformed: "réformée", evangelical: "évangélique", baptist: "baptiste",
  anglican: "anglicane", presbyterian: "presbytérienne", quaker: "quaker", seventh_day_adventist: "adventiste",
  orthodox: "orthodoxe", russian_orthodox: "orthodoxe russe", greek_orthodox: "orthodoxe grecque", serbian_orthodox: "orthodoxe serbe",
  armenian_apostolic: "apostolique arménienne", jehovahs_witness: "Témoins de Jéhovah", liberal_catholic: "catholique libérale (hors communion romaine)",
  mariavite: "mariavite (hors communion romaine)", christian_community: "Communauté des chrétiens"
};
export const confessionLabel = d => (d ? LIBELLES[d] || d.replace(/_/g, " ") : "non renseignée");

const r6 = v => Math.round(v * 1e6) / 1e6;
const ring = rg => rg.map(([lon, lat]) => [r6(lat), r6(lon)]);       // GeoJSON [lon,lat] → Leaflet [lat,lon]
const clean = (s, n = 300) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "") || undefined;

export function buildChurches(fc, comp = {}) {
  const out = [];
  for (const f of fc.features || []) {
    const p = f.properties || {}, g = f.geometry || {};
    if (typeof p.lat !== "number" || typeof p.lon !== "number") continue;
    const osm = p.osm_type + "/" + p.osm_ref, x = comp[osm] || {};
    const address = clean(p.adresse ? [p.adresse, p.code_postal].filter(Boolean).join(", ") : x.address, 200);
    const c = {
      id: p.osm_type[0] + p.osm_ref, osm, name: clean(p.nom, 160), lat: r6(p.lat), lon: r6(p.lon), arr: p.arrondissement || undefined,
      denomination: p.denomination || undefined, catholique: p.denomination ? CATHOLIQUES.has(p.denomination) : undefined,  // undefined = confession non renseignée culte: p.lieu_de_culte !== false,
      batiment: p.batiment || undefined, address, website: clean(p.site_web || x.website, 300),
      wheelchair: x.wheelchair, serviceTimes: clean(x.serviceTimes, 600), operator: clean(x.operator, 160), diocese: clean(x.diocese, 120),
      wikidata: /^Q\d+$/.test(p.wikidata || "") ? p.wikidata : undefined,
      geom: g.type === "Polygon" ? [g.coordinates.map(ring)] : g.type === "MultiPolygon" ? g.coordinates.map(pl => pl.map(ring)) : undefined
    };
    Object.keys(c).forEach(k => c[k] === undefined && delete c[k]);
    out.push(c);
  }
  return out.sort((a, b) => (a.name || "~").localeCompare(b.name || "~", "fr"));
}

// Index des voies : une entrée par nom, avec ses arrondissements et le point du tronçon le plus central.
export function buildStreets(fc) {
  const by = new Map();
  for (const f of fc.features || []) {
    const p = f.properties || {};
    if (!p.nom || typeof p.lat !== "number") continue;
    let e = by.get(p.nom);
    if (!e) by.set(p.nom, e = { pts: [], arr: new Set() });
    e.pts.push([p.lat, p.lon]);
    String(p.arrondissements_traverses || p.arrondissement || "").split(/[;,\s]+/).filter(Boolean).forEach(a => e.arr.add(+a));
  }
  const out = [];
  for (const [n, e] of by) {
    const la = e.pts.reduce((s, q) => s + q[0], 0) / e.pts.length, lo = e.pts.reduce((s, q) => s + q[1], 0) / e.pts.length;
    const c = e.pts.reduce((b, q) => ((q[0] - la) ** 2 + (q[1] - lo) ** 2 < (b[0] - la) ** 2 + (b[1] - lo) ** 2 ? q : b));
    out.push([n, r6(c[0]), r6(c[1]), [...e.arr].filter(a => a >= 1 && a <= 20).sort((a, b) => a - b)]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0], "fr"));
}

function main() {
  const fe = J("data/osm/eglises_paris.geojson"), fr = J("data/osm/rues_paris.geojson"), comp = J("data/osm/complements.json").par_osm || {};
  const date = fe.metadata?.date_extraction_utc || "";
  const churches = buildChurches(fe, comp), streets = buildStreets(fr);
  if (churches.length < 100 || streets.length < 3000) throw new Error(`données insuffisantes (${churches.length} églises, ${streets.length} voies)`);
  const meta = { source: fe.metadata?.source || "OpenStreetMap", licence: LICENCE, attribution: ATTRIBUTION, extractedAt: date,
    perimetre: "Commune de Paris — relation OSM 7444", fichiers: "data/osm/eglises_paris.geojson, data/osm/rues_paris.geojson" };
  writeFileSync(P("public/data/churches.json"), JSON.stringify({ meta: { ...meta, count: churches.length, catholiques: churches.filter(c => c.catholique).length, confession_inconnue: churches.filter(c => c.catholique === undefined).length }, churches }));
  writeFileSync(P("public/data/rues.json"), JSON.stringify({ meta: { ...meta, count: streets.length, format: "[nom, lat, lon, [arrondissements]]" }, rues: streets }));
  console.log(`::notice::Données OSM : ${churches.length} églises (${churches.filter(c => c.catholique).length} catholiques, ${churches.filter(c => c.geom).length} avec contour), ${streets.length} noms de voies — extraction du ${date.slice(0, 10)}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
