#!/usr/bin/env node
// Importe les fichiers data/lectures/*.json dans Firestore (collection `jours`).
//
//   node scripts/import-lectures.mjs              → importe tous les fichiers
//   node scripts/import-lectures.mjs --since 2026-11-01   → seulement à partir de cette date
//   node scripts/import-lectures.mjs --check      → vérifie les fichiers sans rien écrire
//
// Identifiants : FIREBASE_SERVICE_ACCOUNT (JSON de la clé) ou GOOGLE_APPLICATION_CREDENTIALS,
// ou l'émulateur (FIRESTORE_EMULATOR_HOST). Projet : FIREBASE_PROJECT_ID ou celui de la clé.
//
// À VENIR : un script de récupération automatique (scraping) écrira ces mêmes fichiers
// ou directement la collection `jours`. La source reste à définir.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDay } from "./lectures-schema.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };
const CHECK = args.includes("--check");
const SINCE = opt("since", "");
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "lectures");

function loadFiles() {
  const files = readdirSync(DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const out = [], errors = [];
  for (const f of files) {
    const date = f.slice(0, 10);
    if (SINCE && date < SINCE) continue;
    let doc;
    try { doc = JSON.parse(readFileSync(join(DIR, f), "utf8")); }
    catch (e) { errors.push(`${f} : JSON invalide (${e.message})`); continue; }
    const err = validateDay(doc, date);
    if (err.length) errors.push(...err.map(e => `${f} : ${e}`));
    else out.push(doc);
  }
  return { docs: out, errors };
}

async function getDb() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  let projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST) { initializeApp({ projectId: projectId || "demo-guardian" }); return getFirestore(); }
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = cert(sa); projectId = projectId || sa.project_id;
  } else credential = applicationDefault();
  initializeApp({ credential, projectId });
  return getFirestore();
}

async function main() {
  const { docs, errors } = loadFiles();
  if (errors.length) { console.error("Fichiers invalides :\n- " + errors.join("\n- ")); process.exit(1); }
  console.log(`${docs.length} fichier(s) valide(s).`);
  if (CHECK) return;
  const db = await getDb();
  const { FieldValue } = await import("firebase-admin/firestore");
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(d => batch.set(db.doc(`jours/${d.date}`), { ...d, source: "fichier", importedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }
  docs.forEach(d => console.log(`✓ ${d.date}${d.titre ? " — " + d.titre : ""}`));
  console.log(`\nTerminé : ${docs.length} jour(s) écrit(s) dans Firestore.`);
}

main().catch(e => { console.error(e); process.exit(1); });
