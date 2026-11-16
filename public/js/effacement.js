// Suppression définitive de TOUTES les données de l'utilisateur, en ligne et sur l'appareil.
import { cloud } from "./cloud.js";
import * as store from "./store.js";
import { unsubscribe } from "./push.js";

// etape(libellé, "ok" | "erreur" | "en cours") permet d'afficher l'avancement
export async function toutEffacer(etape) {
  const erreurs = [];
  const faire = async (libelle, fn) => {
    etape(libelle, "en cours");
    try { await fn(); etape(libelle, "ok"); } catch (e) { console.error(libelle, e); erreurs.push(libelle + " : " + (e.code || e.message || e)); etape(libelle, "erreur"); }
  };

  // 1. Données en ligne (si un compte est connecté)
  if (cloud.ready && cloud.user) {
    const { fs, db, user } = cloud;
    await faire("Signalements envoyés", async () => {
      const q = await fs.getDocs(fs.query(fs.collection(db, "reports"), fs.where("uid", "==", user.uid)));
      for (const d of q.docs) await fs.deleteDoc(d.ref);
    });
    // Journal, visites, notes, candidatures, abonnements aux notifications, puis le compte lui-même
    await faire("Compte, journal, visites et candidatures", () => store.deleteAccount());
  }
  // 2. Notifications de cet appareil (y compris sans compte)
  await faire("Notifications de cet appareil", async () => {
    await unsubscribe().catch(() => {});
    if (cloud.ready && cloud.authUser && cloud.authUser.isAnonymous) await cloud.au.deleteUser(cloud.authUser).catch(() => {});
    if (cloud.ready && cloud.auth?.currentUser) await cloud.au.signOut(cloud.auth).catch(() => {});
  });
  // 3. Sermons (audio, notes, transcriptions) et toutes les bases locales
  await faire("Sermons enregistrés et bases locales", async () => {
    const noms = new Set(["ga-sermons"]);
    try { (await indexedDB.databases()).forEach(d => d.name && noms.add(d.name)); } catch {}
    await Promise.all([...noms].map(n => new Promise(res => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
  });
  // 4. Fichiers gardés en cache (pages, chapitres de la Bible, modèle de transcription)
  await faire("Fichiers en cache", async () => { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); });
  // 5. Préférences, favoris, messe en cours…
  await faire("Préférences de l'application", async () => { try { localStorage.clear(); } catch {} try { sessionStorage.clear(); } catch {} store.eraseLocal(); });
  return erreurs;
}
