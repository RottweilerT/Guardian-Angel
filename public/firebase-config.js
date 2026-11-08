// Configuration Firebase utilisée HORS de Firebase Hosting (ex. serveur local sans émulateur).
// Sur Firebase Hosting, l'application lit automatiquement /__/firebase/init.json : ce fichier est alors ignoré.
// Ces valeurs ne sont pas secrètes (elles identifient le projet) ; la sécurité repose sur firestore.rules.
// Console Firebase → Paramètres du projet → Vos applications → Application Web → Configuration.
export const firebaseConfig = {
  apiKey: "REMPLACER",
  authDomain: "REMPLACER.firebaseapp.com",
  projectId: "REMPLACER",
  storageBucket: "REMPLACER.appspot.com",
  messagingSenderId: "REMPLACER",
  appId: "REMPLACER"
};

// Mettre à true pour utiliser les émulateurs locaux (npm run emulators).
export const useEmulators = location.hostname === "localhost" || location.hostname === "127.0.0.1";
