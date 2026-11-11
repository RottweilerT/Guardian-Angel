// Accès à Firebase (Auth + Firestore), chargé à la demande : l'application fonctionne sans.
import { firebaseConfig as localConfig, useEmulators } from "./firebase-config.js";
const V = "https://www.gstatic.com/firebasejs/10.12.2/";
export const cloud = { ready: false, user: null, db: null, auth: null, fs: null, au: null, admin: false };

async function loadConfig() {
  try { const r = await fetch("/__/firebase/init.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch { /* hors Hosting */ }
  return localConfig && !String(localConfig.apiKey).startsWith("REMPLACER") ? localConfig : null;
}

export async function initCloud(onUser) {
  try {
    const cfg = await loadConfig();
    if (!cfg) return false;
    const [appM, au, fs] = await Promise.all([import(V + "firebase-app.js"), import(V + "firebase-auth.js"), import(V + "firebase-firestore.js")]);
    const app = appM.initializeApp(cfg);
    cloud.au = au; cloud.fs = fs; cloud.auth = au.getAuth(app);
    try { cloud.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch { cloud.db = fs.initializeFirestore(app, {}); }
    if (useEmulators) {
      try { au.connectAuthEmulator(cloud.auth, "http://127.0.0.1:9099", { disableWarnings: true }); fs.connectFirestoreEmulator(cloud.db, "127.0.0.1", 8080); } catch { /* déjà connecté */ }
    }
    cloud.ready = true;
    au.getRedirectResult(cloud.auth).catch(() => {});
    au.onAuthStateChanged(cloud.auth, async user => {
      cloud.user = user; cloud.admin = false;
      if (user) { try { cloud.admin = (await fs.getDoc(fs.doc(cloud.db, "admins", user.uid))).exists(); } catch { /* non admin */ } }
      onUser(user);
    });
    return true;
  } catch (e) { console.warn("Firebase indisponible", e); return false; }
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
