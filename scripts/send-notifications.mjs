#!/usr/bin/env node
// Envoi des notifications push (lancé toutes les 15 minutes par .github/workflows/notifications.yml).
// Identifiants : FIREBASE_SERVICE_ACCOUNT (secret GitHub) — jamais dans le code ni côté navigateur.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { runSender } from "./notify-core.mjs";
import { firestoreStore } from "./notify-store.mjs";

let projectId = process.env.FIREBASE_PROJECT_ID, credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) { const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); credential = cert(sa); projectId = projectId || sa.project_id; }
else credential = applicationDefault();
initializeApp({ credential, projectId });

const r = await runSender({ store: firestoreStore(getFirestore()), messaging: getMessaging(), log: m => console.log(m) });
console.log(`Notifications — mises en file : ${r.enqueued}, envoyées : ${r.sent}, échecs : ${r.failed}, destinataires atteints : ${r.recipients}, abonnements retirés : ${r.removed}`);
if (r.sent || r.failed) console.log(`::notice::Notifications : ${r.sent} envoyée(s), ${r.failed} échec(s), ${r.recipients} appareil(s) atteint(s), ${r.removed} abonnement(s) invalide(s) retiré(s).`);
