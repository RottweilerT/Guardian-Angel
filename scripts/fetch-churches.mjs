#!/usr/bin/env node
// Extrait d'OpenStreetMap (API Overpass) les lieux de culte catholiques de Paris → public/data/churches.json
// Licence des données : ODbL 1.0 — « © les contributeurs d'OpenStreetMap ». Une seule requête par exécution.
//   node scripts/fetch-churches.mjs            → écrit le fichier (conserve l'ancien en cas d'échec)
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/data/churches.json", import.meta.url));
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const SEL = 'nwr(area.a)["amenity"="place_of_worship"]["religion"="christian"]["denomination"~"^(catholic|roman_catholic)$"]';
const insee = i => "751" + String(i).padStart(2, "0");
export const QUERY_ARR = "[out:json][timeout:120];\n" + Array.from({ length: 20 }, (_, i) => `area["ref:INSEE"="${insee(i + 1)}"]["admin_level"="9"]->.a;${SEL};out center tags;out count;`).join("\n");
export const QUERY_ALL = `[out:json][timeout:120];area["ref:INSEE"="75056"]["admin_level"~"^(6|8)$"]->.a;${SEL};out center tags;`;

const clean = (s, n = 300) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "") || undefined;

// Transforme la réponse Overpass en liste d'églises. Les éléments "count" séparent les arrondissements (requête QUERY_ARR).
export function normalize(elements, { byArr = false } = {}) {
  const out = new Map(); let arr = 1;
  for (const e of elements || []) {
    if (e.type === "count") { arr++; continue; }
    const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const id = e.type[0] + e.id;
    if (out.has(id)) continue;
    const cp = clean(t["addr:postcode"], 5);
    const a = byArr ? arr : (/^750(0[1-9]|1\d|20)$/.test(cp || "") ? +cp.slice(3) : /^75116$/.test(cp || "") ? 16 : undefined);
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
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "guardian-angel-app/1.0 (extraction hebdomadaire)" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).elements || [];
    } catch (e) { last = e; console.warn(url, "→", e.message); }
  }
  throw last;
}

async function main() {
  let churches = [];
  try {
    churches = normalize(await overpass(QUERY_ARR), { byArr: true });
    if (churches.length < 50) { console.warn(`Seulement ${churches.length} résultats par arrondissement : requête de repli.`); churches = normalize(await overpass(QUERY_ALL)); }
  } catch (e) { console.warn("Extraction impossible :", e.message); }
  if (churches.length < 50) {
    if (existsSync(OUT) && JSON.parse(readFileSync(OUT, "utf8")).churches?.length) { console.log("Fichier existant conservé."); return; }
    console.log("Aucune donnée : le site affichera un état vide."); return;
  }
  const meta = { source: "OpenStreetMap (API Overpass)", licence: "ODbL 1.0", attribution: "© les contributeurs d'OpenStreetMap", extractedAt: new Date().toISOString(), count: churches.length, perimetre: "Paris — amenity=place_of_worship, religion=christian, denomination=catholic|roman_catholic" };
  writeFileSync(OUT, JSON.stringify({ meta, churches }));
  console.log(`✓ ${churches.length} lieux de culte écrits dans public/data/churches.json`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
