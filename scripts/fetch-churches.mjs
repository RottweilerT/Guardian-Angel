#!/usr/bin/env node
// Extrait d'OpenStreetMap (API Overpass) les lieux de culte catholiques de Paris → public/data/churches.json
// Licence des données : ODbL 1.0 — « © les contributeurs d'OpenStreetMap ». Une seule requête par exécution.
//   node scripts/fetch-churches.mjs            → écrit le fichier (conserve l'ancien en cas d'échec)
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/data/churches.json", import.meta.url));
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const SEL = '["amenity"="place_of_worship"]["religion"="christian"]["denomination"~"^(catholic|roman_catholic)$"]';
// Paris = relation OSM 7444 (aire 3600007444). Requête simple ; l'arrondissement est ensuite calculé localement.
export const QUERY = `[out:json][timeout:90];area(id:3600007444)->.a;nwr(area.a)${SEL};out center tags;`;
export const QUERY_NAME = `[out:json][timeout:90];area["boundary"="administrative"]["admin_level"="8"]["name"="Paris"]["ref:INSEE"="75056"]->.a;nwr(area.a)${SEL};out center tags;`;
export const QUERY_ARR = `[out:json][timeout:90];area(id:3600007444)->.a;relation(area.a)["boundary"="administrative"]["admin_level"="9"]["ref:INSEE"];out geom;`;

// Point dans un polygone par lancer de rayon sur les segments des contours (l'ordre des segments est indifférent).
export function inside(lat, lon, rings) {
  let c = false;
  for (const g of rings) for (let i = 0; i + 1 < g.length; i++) {
    const a = g[i], b = g[i + 1];
    if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) c = !c;
  }
  return c;
}
export function arrondissements(elements) {
  return (elements || []).filter(e => e.type === "relation" && /^751\d\d$/.test(e.tags?.["ref:INSEE"] || ""))
    .map(e => ({ n: +e.tags["ref:INSEE"].slice(3), rings: (e.members || []).filter(m => m.type === "way" && m.role !== "inner" && m.geometry).map(m => m.geometry) }));
}

const clean = (s, n = 300) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "") || undefined;

// Transforme la réponse Overpass en liste d'églises ; `arrs` = contours des arrondissements (facultatif).
export function normalize(elements, arrs = []) {
  const out = new Map();
  for (const e of elements || []) {
    const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const id = e.type[0] + e.id;
    if (out.has(id)) continue;
    const cp = clean(t["addr:postcode"], 5);
    const geo = arrs.find(x => inside(lat, lon, x.rings));
    const a = geo ? geo.n : (/^750(0[1-9]|1\d|20)$/.test(cp || "") ? +cp.slice(3) : /^75116$/.test(cp || "") ? 16 : undefined);
    const address = [[t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), cp].filter(Boolean).join(", ");
    const c = {
      id, osm: e.type + "/" + e.id, name: clean(t["name:fr"] || t.name, 160), lat: +lat.toFixed(6), lon: +lon.toFixed(6), arr: a,
      address: clean(address, 200), website: clean(t.website || t["contact:website"] || t.url, 300),
      wheelchair: ["yes", "limited", "no"].includes(t.wheelchair) ? t.wheelchair : undefined,
      serviceTimes: clean(t.service_times, 600), operator: clean(t.operator, 160), diocese: clean(t.diocese, 120), wikidata: /^Q\d+$/.test(t.wikidata || "") ? t.wikidata : undefined
    };
    Object.keys(c).forEach(k => c[k] === undefined && delete c[k]);
    out.set(id, c);
  }
  return [...out.values()].sort((x, y) => (x.name || "~").localeCompare(y.name || "~", "fr"));
}

async function overpass(query) {
  let last;
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(100000), method: "POST", body: "data=" + encodeURIComponent(query), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "guardian-angel-app/1.0 (extraction hebdomadaire)" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).elements || [];
    } catch (e) { last = e; console.warn(url, "→", e.message); }
  }
  throw last;
}

async function main() {
  let churches = [], note = "";
  try {
    let els; try { els = await overpass(QUERY); } catch { els = []; }
    if (els.length < 50) els = await overpass(QUERY_NAME);
    let arrs = []; try { arrs = arrondissements(await overpass(QUERY_ARR)); } catch (e) { note = " (arrondissements indisponibles : " + e.message + ")"; }
    churches = normalize(els, arrs);
    note += ` — ${arrs.length} arrondissements, ${churches.filter(c => c.arr).length} églises situées`;
  } catch (e) { note = "Extraction impossible : " + e.message; }
  if (churches.length < 50) {
    const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).churches?.length || 0 : 0;
    console.log(`::warning::Églises : extraction insuffisante (${churches.length}). ${note} Fichier existant conservé (${old} églises).`); return;
  }
  const meta = { source: "OpenStreetMap (API Overpass)", licence: "ODbL 1.0", attribution: "© les contributeurs d'OpenStreetMap", extractedAt: new Date().toISOString(), count: churches.length, perimetre: "Paris — amenity=place_of_worship, religion=christian, denomination=catholic|roman_catholic" };
  writeFileSync(OUT, JSON.stringify({ meta, churches }));
  console.log(`::notice::Églises : ${churches.length} lieux de culte extraits d'OpenStreetMap${note}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
