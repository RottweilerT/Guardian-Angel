// Configuration publique des notifications. Ce fichier est RÉÉCRIT à chaque déploiement par GitHub Actions
// à partir des variables du dépôt FCM_VAPID_KEY et APPCHECK_SITE_KEY (valeurs publiques, non secrètes).
// Laisser vide en développement : l'interface affiche alors « notifications pas encore configurées ».
export const pushConfig = {
  vapidKey: "",
  appCheckSiteKey: ""
};
