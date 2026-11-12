// Accès à Firebase (Auth + Firestore + Messaging), chargé à la demande : l'application fonctionne sans.
//  - cloud.user     : compte « réel » (Google). Les sessions anonymes n'en sont pas un.
//  - cloud.authUser : toute session Firebase, y compris anonyme (utilisée uniquement pour les notifications).
import { firebaseConfig as localConfig, useEmulators } from "./firebase-config.js";
import { pushConfig } from "./push-config.js";
export const SDK_VERSION = "13.1.0";
const V = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/`;
export const cloud = { ready: false, user: null, authUser: null, db: null, auth: null, app: null, fs: null, au: null, admin: false };

async function loadConfig() {
  try { const r = await fetch("/__/firebase/init.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch { /* hors Hosting */ }
  return localConfig && !String(localConfig.apiKey).startsWith("REMPLACER") ? localConfig : null;
}

// App Check (facultatif) : activé seulement si une clé de site reCAPTCHA Enterprise est configurée.
async function initAppCheck(app) {
  if (!pushConfig.appCheckSiteKey || useEmulators) return;
  try {
    const ac = await import(V + "firebase-app-check.js");
    ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(pushConfig.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  } catch (e) { console.warn("App Check indisponible", e); }
}

export async function initCloud(onUser) {
  try {
    const cfg = await loadConfig();
    if (!cfg) return false;
    const [appM, au, fs] = await Promise.all([import(V + "firebase-app.js"), import(V + "firebase-auth.js"), import(V + "firebase-firestore.js")]);
    const app = appM.initializeApp(cfg);
    cloud.app = app; cloud.au = au; cloud.fs = fs; cloud.auth = au.getAuth(app);
    await initAppCheck(app);
    try { cloud.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch { cloud.db = fs.initializeFirestore(app, {}); }
    if (useEmulators) {
      try { au.connectAuthEmulator(cloud.auth, "http://127.0.0.1:9099", { disableWarnings: true }); fs.connectFirestoreEmulator(cloud.db, "127.0.0.1", 8080); } catch { /* déjà connecté */ }
    }
    cloud.ready = true;
    au.getRedirectResult(cloud.auth).catch(() => {});
    let last;
    au.onAuthStateChanged(cloud.auth, async user => {
      cloud.authUser = user;
      const real = user && !user.isAnonymous ? user : null;
      window.dispatchEvent(new Event("ga:auth"));
      if (real === last || (real && last && real.uid === last.uid)) return;   // changement anonyme ↔ anonyme : rien pour le compte
      last = real; cloud.user = real; cloud.admin = false;
      if (real) { try { cloud.admin = (await fs.getDoc(fs.doc(cloud.db, "admins", real.uid))).exists(); } catch { /* non admin */ } }
      onUser(real);
    });
    return true;
  } catch (e) { console.warn("Firebase indisponible", e); return false; }
}

// Session minimale pour les notifications : le compte Google s'il existe, sinon une session anonyme.
export async function ensureAuth() {
  if (!cloud.ready) throw Object.assign(new Error("Service indisponible"), { code: "ga/offline" });
  if (cloud.auth.currentUser) return cloud.auth.currentUser;
  const cred = await cloud.au.signInAnonymously(cloud.auth);
  return cred.user;
}

let messagingP = null;
export function loadMessaging() {
  if (!messagingP) messagingP = import(V + "firebase-messaging.js").then(async mm => {
    if (!(await mm.isSupported())) return null;
    return { mm, messaging: mm.getMessaging(cloud.app) };
  }).catch(e => { messagingP = null; throw e; });
  return messagingP;
}

export async function signIn() {
  const { au, auth } = cloud; const p = new au.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { await au.signInWithPopup(auth, p); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) await au.signInWithRedirect(auth, p);
    else if (e.code !== "auth/popup-closed-by-user") throw e;
  }
}
export const signOutUser = () => cloud.au.signOut(cloud.auth);
