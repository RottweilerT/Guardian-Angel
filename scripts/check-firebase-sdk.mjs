#!/usr/bin/env node
// Vérifie, avant déploiement, que la version du SDK Firebase utilisée par le site existe sur le CDN
// et expose les fonctions dont l'application a besoin (évite de publier un site cassé).
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/js/cloud.js", import.meta.url), "utf8");
const version = src.match(/SDK_VERSION = "([\d.]+)"/)[1];
const REQUIRED = {
  app: ["initializeApp"],
  auth: ["getAuth", "signInWithPopup", "signInWithRedirect", "getRedirectResult", "onAuthStateChanged", "signOut", "signInAnonymously", "deleteUser", "reauthenticateWithPopup", "GoogleAuthProvider"],
  firestore: ["initializeFirestore", "persistentLocalCache", "persistentMultipleTabManager", "doc", "collection", "getDoc", "getDocs", "setDoc", "updateDoc", "deleteDoc", "addDoc", "onSnapshot", "query", "where", "orderBy", "limit", "writeBatch", "serverTimestamp"],
  messaging: ["getMessaging", "isSupported", "register", "onRegistered", "unregister", "getToken", "deleteToken"],
  "app-check": ["initializeAppCheck", "ReCaptchaEnterpriseProvider"]
};
let bad = 0;
for (const [mod, names] of Object.entries(REQUIRED)) {
  const r = await fetch(`https://www.gstatic.com/firebasejs/${version}/firebase-${mod}.js`);
  if (!r.ok) { console.log(`::error::firebase-${mod}.js ${version} introuvable (HTTP ${r.status})`); bad++; continue; }
  const exp = ((await r.text()).match(/export\s*\{([^}]*)\}\s*;?\s*(\/\/.*)?\s*$/) || [, ""])[1].split(",").map(x => x.trim().split(/\s+as\s+/).pop());
  const missing = names.filter(n => !exp.includes(n));
  if (missing.length) { console.log(`::error::firebase-${mod} ${version} : exports manquants ${missing.join(", ")}`); bad++; }
}
if (bad) process.exit(1);
console.log(`SDK Firebase ${version} : tous les exports requis sont présents.`);
