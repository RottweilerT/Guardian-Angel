// Configuration Firebase utilisée HORS de Firebase Hosting (ex. serveur local sans émulateur).
// Sur Firebase Hosting, l'application lit automatiquement /__/firebase/init.json : ce fichier est alors ignoré.
// Ces valeurs ne sont pas secrètes (elles identifient le projet) ; la sécurité repose sur firestore.rules.
// Console Firebase → Paramètres du projet → Vos applications → Application Web → Configuration.
export const firebaseConfig = {
  apiKey: "AIzaSyBZ3GnfcaCtYnINGi8h2vOsTITpEojW-Po",
  authDomain: "guardian-angel-62a43.firebaseapp.com",
  projectId: "guardian-angel-62a43",
  storageBucket: "guardian-angel-62a43.firebasestorage.app",
  messagingSenderId: "148203669220",
  appId: "1:148203669220:web:b02c9bd7d0ea9420004ef1"
};

// Mettre à true pour utiliser les émulateurs locaux (npm run emulators).
export const useEmulators = location.hostname === "localhost" || location.hostname === "127.0.0.1";
