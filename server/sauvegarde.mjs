#!/usr/bin/env node
// Sauvegarde de Firestore (projet guardian-angel-62a43), exécutée par GitHub Actions avec le compte de service.
//   node server/sauvegarde.mjs exporter  <sortie.json>   lit TOUTE la base (sous-collections comprises)
//   node server/sauvegarde.mjs verifier  <sauvegarde.json> contrôle la sauvegarde et la compare à la base (lecture seule)
//   node server/sauvegarde.mjs restaurer <sauvegarde.json> réécrit chaque document sauvegardé (les documents créés depuis restent)
// Le dépôt est public : le journal n'affiche que des nombres, jamais de contenu. Le chiffrement est fait par le workflow (openssl).
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { lireTout, enveloppe, controler, comparer, decoder, racine } from "./sauvegarde-lib.mjs";

const [, , action, fichier] = process.argv;
const resume = t => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, t + "\n"); };

async function base() {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const fs = await import("firebase-admin/firestore");
  let projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: projectId || "demo-guardian" });
  else {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    if (!sa.private_key) { console.log("::error::Le secret FIREBASE_SERVICE_ACCOUNT manque"); process.exit(1); }
    projectId = projectId || sa.project_id;
    initializeApp({ credential: cert(sa), projectId });
  }
  return { db: fs.getFirestore(), Timestamp: fs.Timestamp, GeoPoint: fs.GeoPoint, projectId };
}
const parRacine = docs => { const n = {}; for (const [c, d] of Object.entries(docs)) if (d !== null) n[racine(c)] = (n[racine(c)] || 0) + 1; return n; };

async function exporter() {
  const { db, projectId } = await base();
  const docs = await lireTout(db);
  writeFileSync(fichier, JSON.stringify(enveloppe(projectId, docs)));
  const n = parRacine(docs), total = Object.values(n).reduce((a, b) => a + b, 0);
  console.log(`::notice::Sauvegarde : ${total} documents lus (${Object.entries(n).map(([c, k]) => `${c} ${k}`).join(", ") || "base vide"})`);
}

async function verifier() {
  const b = JSON.parse(readFileSync(fichier, "utf8"));
  const pb = controler(b);
  if (pb.length && b?.format !== "guardian-angel-sauvegarde") { console.log("::error::" + pb[0]); process.exit(1); }
  const { db, Timestamp, GeoPoint, projectId } = await base();
  if (b.projet !== projectId) pb.push(`sauvegarde du projet ${b.projet}, base actuelle ${projectId}`);
  // préparation exacte des écritures de « Restaurer », sans envoi : décodage puis ré-encodage identique
  const { encoder } = await import("./sauvegarde-lib.mjs");
  let prets = 0, differents = 0;
  for (const d of Object.values(b.documents)) {
    if (d === null) continue;
    const pret = decoder(d, { Timestamp, GeoPoint, db });
    if (JSON.stringify(encoder(pret)) !== JSON.stringify(d)) differents++;
    prets++;
  }
  if (differents) pb.push(`${differents} document(s) ne se reconstruisent pas à l'identique`);
  const cmp = comparer(b.documents, await lireTout(db));
  resume("## Vérification de la sauvegarde (aucune écriture)\n");
  resume("- Déchiffrement : **réussi** (la clé est la bonne)");
  resume(`- Documents prêts à être restaurés : **${prets}**\n`);
  resume("| Collection | Dans la sauvegarde | Dans la base actuelle | Identiques | Modifiés depuis | Ajoutés depuis | Disparus depuis |\n|---|---|---|---|---|---|---|");
  for (const [c, x] of Object.entries(cmp)) {
    resume(`| ${c} | ${x.sauvegarde} | ${x.base} | ${x.identiques} | ${x.modifies} | ${x.ajoutes} | ${x.disparus} |`);
    console.log(`${c} : sauvegarde ${x.sauvegarde} · base ${x.base} · identiques ${x.identiques} · modifiés ${x.modifies} · ajoutés ${x.ajoutes} · disparus ${x.disparus}`);
  }
  resume("\n« Modifiés / ajoutés / disparus depuis » = changements faits dans l'appli après la sauvegarde : c'est normal.");
  if (pb.length) { resume("\n**Problèmes :** " + pb.join(" ; ")); pb.forEach(p => console.log("::error::" + p)); process.exit(1); }
  resume("\n**Résultat : la sauvegarde est complète et restaurable.**");
  console.log(`::notice::Sauvegarde complète et restaurable : ${prets} documents prêts, aucune écriture effectuée`);
}

async function restaurer() {
  const b = JSON.parse(readFileSync(fichier, "utf8"));
  const pb = controler(b);
  if (pb.length) { pb.forEach(p => console.log("::error::" + p)); process.exit(1); }
  const { db, Timestamp, GeoPoint, projectId } = await base();
  if (b.projet !== projectId) { console.log(`::error::Sauvegarde du projet ${b.projet}, base actuelle ${projectId} : restauration refusée`); process.exit(1); }
  const docs = Object.entries(b.documents).filter(([, d]) => d !== null);
  let ok = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const lot = db.batch();
    for (const [chemin, d] of docs.slice(i, i + 400)) lot.set(db.doc(chemin), decoder(d, { Timestamp, GeoPoint, db }));
    await lot.commit(); ok += Math.min(400, docs.length - i);
  }
  console.log(`::notice::Restauration : ${ok} documents réécrits`);
}

const actions = { exporter, verifier, restaurer };
if (!actions[action] || !fichier) { console.log("Usage : node server/sauvegarde.mjs exporter|verifier|restaurer <fichier.json>"); process.exit(2); }
actions[action]().catch(e => { console.log("::error::" + String(e && e.message || e).slice(0, 300)); process.exit(1); });
