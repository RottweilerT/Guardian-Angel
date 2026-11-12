# Notifications push

## Ce qui a été trouvé dans le projet (analyse préalable)

| Élément | Constat | Conséquence |
| --- | --- | --- |
| Technologies | HTML, CSS et modules JavaScript natifs, sans framework ni étape de build | Le code des notifications suit le même modèle (`public/js/push.js`, vue `notifications`) |
| Firebase | Hosting, Authentication (Google), Firestore ; projet `guardian-angel-62a43`, forfait **Spark** | Réutilisés ; **Cloud Functions indisponibles** sans forfait Blaze |
| Serveur | Aucun ; automatisations par GitHub Actions avec le compte de service `github-actions` (secret existant) | Le serveur d'envoi est un programme Node exécuté par GitHub Actions |
| PWA | Manifeste + service worker `public/sw.js` | Le **même** service worker gère désormais les notifications (pas de second service worker) |
| Publications | Missions paroissiales publiées par un administrateur (`missions`, statut `draft`/`published`) ; calendrier liturgique calculé | Envois automatiques : nouvelle mission publiée, matin des solennités |
| Espace administrateur | Administrateurs déclarés dans `admins/{uid}` | Rédaction et historique des envois intégrés à la page Notifications pour eux |

## Architecture

```
Visiteur ── bouton « Activer » ─▶ autorisation du navigateur ─▶ FCM register() / onRegistered() ─▶ Firebase Installation ID
   │                                                                                                │
   └─ session anonyme Firebase (ou compte Google) ── écrit ──▶ Firestore push_subscriptions/{uid}_{appareil}  (privé)

Administrateur ── page Notifications ──▶ notifications/{id} (status: pending)        ← règles : administrateurs seulement
Mission publiée ─────────────────────▶ notifications/mission_{id} (créée une seule fois par le serveur)
Matin d'une solennité ───────────────▶ notifications/liturgie_{date}

GitHub Actions « Notifications push » (toutes les 10 min) ─ server/notify.mjs ─▶ API FCM HTTP v1 ─▶ navigateurs
                                                                 └─▶ statut, statistiques, nettoyage des abonnements
Service worker sw.js : événement push ─▶ notification système (ou message dans l'application si elle est au premier plan)
                       clic ─▶ ouverture de la page liée (lien interne uniquement)
```

**API utilisée** : la documentation Firebase actuelle déprécie `getToken()` au profit de `register()` + `onRegistered()`, qui renvoient un identifiant d'installation Firebase (FID) ; le serveur cible ce FID (champ `fid` de l'API HTTP v1). Le site charge le SDK Firebase **13.1.0**, le premier qui expose ces fonctions (vérifié). `getToken()` reste en repli si `register()` était absent. Le déploiement vérifie automatiquement que le SDK et ses exports sont disponibles (`scripts/check-firebase-sdk.mjs`).

**Pourquoi GitHub Actions et pas Cloud Functions** : Cloud Functions exige le forfait Blaze (facturation). Le programme `server/notify.mjs` fait le même travail côté serveur, avec le compte de service déjà en place. Contrepartie : un délai de **5 à 20 minutes** entre la publication et la notification (le planificateur de GitHub n'est pas ponctuel). Le passage à Cloud Functions est possible plus tard en appelant `runOnce()` depuis une fonction planifiée.

## Données (Firestore)

`push_subscriptions/{uid}_{deviceId}` — lisible et modifiable par son seul propriétaire, jamais par un administrateur ni publiquement :

| Champ | Contenu |
| --- | --- |
| `uid` | identifiant de la session (anonyme ou compte) |
| `deviceId` | identifiant aléatoire de l'appareil (plusieurs appareils par personne) |
| `kind`, `target` | `fid` (ou `token`) et l'identifiant FCM |
| `categories` | `missions`, `liturgie`, `annonces`, `nouveautes` |
| `active` | `true`, ou `false` en pause |
| `createdAt`, `updatedAt` | horodatages serveur |

`notifications/{id}` — lisible par les administrateurs : `title`, `body`, `category`, `url`, `source` (`manuel`, `mission`, `liturgie`), `status` (`pending`, `sending`, `sent`, `failed`, `cancelled`, `refused`), `stats` (`targets`, `success`, `failure`, `removed`), `cursor`, `createdAt`, `sentAt`, `error`.

## Garanties

- **Pas de doublon** : identifiant déterministe pour les envois automatiques (`mission_{id}`, `liturgie_{date}`) créé avec `create()` ; mission marquée `notifiedAt` ; réservation transactionnelle (bail de 10 min) avant envoi ; curseur de reprise après interruption ; une seule cible par appareil (dédoublonnage) ; le service worker ignore un message déjà affiché (étiquette `nid`).
- **Pas d'envoi** pour un brouillon, une modification, une mission publiée depuis plus de 72 h, une notification annulée ou invalide.
- **Abus** : création des notifications réservée aux administrateurs par les règles Firestore (le bouton masqué ne suffit pas) ; 5 envois manuels au plus par 24 h ; champs et longueurs validés côté règles **et** côté serveur ; liens limités aux chemins internes (`/` ou `/#/…`) à la saisie, dans les règles, sur le serveur et dans le service worker.
- **Nettoyage** : abonnement supprimé si FCM le déclare invalide (`UNREGISTERED`, `SENDER_ID_MISMATCH`), en double, ou non renouvelé depuis 9 mois. Une erreur ambiguë (400) ou globale (401/403) ne supprime jamais d'abonnement.
- **Erreurs réseau** : 4 tentatives avec attente croissante (et `Retry-After`) ; traitement par lots de 100, 20 envois simultanés.
- **Quotas** : aucune lecture Firestore côté site hors de la page Notifications ; renouvellement de l'abonnement au plus une fois par semaine ; le serveur ne lit les abonnements que s'il y a quelque chose à envoyer.

## Compatibilité

| Plateforme | Notifications web |
| --- | --- |
| Android : Chrome, Edge, Firefox, Samsung Internet | Oui |
| Windows, macOS, Linux : Chrome, Edge, Firefox | Oui (navigateur ouvert ou en arrière-plan selon le système) |
| macOS : Safari 16 et plus | Oui |
| iPhone, iPad : iOS / iPadOS 16.4 et plus | Oui, **uniquement** depuis l'application ajoutée à l'écran d'accueil (la page affiche la marche à suivre) |
| Navigation privée, anciens navigateurs, certains navigateurs intégrés | Non — la page indique « Non compatibles » |

## Opérations manuelles

### 1. Générer la clé Web Push (obligatoire)

1. [Console Firebase](https://console.firebase.google.com/project/guardian-angel-62a43/settings/cloudmessaging) → ⚙ **Paramètres du projet** → onglet **Cloud Messaging**.
2. Section **Configuration Web** → onglet **Certificats Web Push** → bouton **Générer une paire de clés**.
3. Copier la **paire de clés** affichée (clé publique, environ 88 caractères commençant souvent par `B`). La clé privée reste chez Google : ne rien copier d'autre.
4. GitHub → dépôt → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** :
   - **Name** : `FCM_VAPID_KEY`
   - **Value** : la clé publique copiée → **Add variable**.
5. **Actions** → **Déploiement Firebase** → **Run workflow**.

### 2. Autoriser les sessions anonymes (obligatoire pour s'abonner sans compte)

Console Firebase → **Authentication** → onglet **Sign-in method** → **Ajouter un fournisseur** → **Anonyme** → activer l'interrupteur → **Enregistrer**.

### 3. Vérifier l'API d'inscription FCM

Google Cloud → **API et services** → **Bibliothèque** → « **FCM Registration API** » et « **Firebase Cloud Messaging API** » → **Activer** si le bouton l'affiche (elles étaient déjà actives lors de la mise en place).

### 4. Devenir administrateur (pour envoyer)

Console Firebase → **Authentication** → **Utilisateurs** → copier l'**UID** de votre compte Google → **Firestore Database** → **Commencer une collection** `admins` → **ID du document** : l'UID → champ `role` (chaîne) = `admin` → **Enregistrer**.

### 5. App Check (recommandé avant une large diffusion)

1. Google Cloud → **Sécurité** → **reCAPTCHA** → **Créer une clé** (type Site Web, domaine `guardian-angel-62a43.web.app`), copier la clé.
2. Console Firebase → **App Check** → **Applications** → l'application Web → **reCAPTCHA Enterprise** → coller la clé → **Enregistrer**.
3. GitHub → variable `APPCHECK_SITE_KEY` = cette clé, puis relancer le déploiement.
4. Après quelques jours de métriques sans requêtes rejetées : App Check → **API** → **Cloud Firestore** et **Authentication** → **Appliquer**.

## Utilisation

- **Visiteur** : cloche en haut de l'écran → choisir les catégories → **Activer les notifications** → accepter la demande du navigateur. Ensuite : **Enregistrer mes choix**, **Mettre en pause**, **Se désabonner**.
- **Administrateur** : même page → **Administration** → titre, message, catégorie, lien → aperçu → **Envoyer** puis **Confirmer l'envoi**. L'historique affiche le statut et le nombre d'appareils atteints ; un envoi en attente peut être annulé.
- **Envoi immédiat** : GitHub → **Actions** → **Notifications push** → **Run workflow** (sinon, prochain passage automatique).

## Tests

| Test | Comment | Résultat |
| --- | --- | --- |
| Activation, catégories, pause, reprise, désabonnement | Navigateur Chromium automatisé, SDK Firebase simulé | Vérifié |
| Refus d'autorisation | Navigateur avec notifications bloquées | État « Refusées » affiché, bouton masqué |
| Réception au premier plan / en arrière-plan, doublon, lien externe | Messages push injectés dans le service worker (protocole DevTools) | Vérifié |
| Règles : abonnements privés, sessions anonymes, notifications réservées aux administrateurs | `tests/rules.spec.mjs` sur émulateur (CI) | Vérifié en CI |
| Serveur : envoi automatique et manuel, pas de doublon, reprise, quota, nettoyage, erreur globale | `tests/notify.spec.mjs` sur émulateur, envoi simulé (CI) | Vérifié en CI |
| Fonctions pures du serveur | `tests/notify-lib.test.mjs` | Vérifié |
| **Envoi réel FCM et affichage sur un vrai téléphone** | Nécessite la clé VAPID, une session anonyme activée et un appareil réel | **À faire par vous** (voir ci-dessous) |
| Clic sur une notification système | Non automatisable ici | À vérifier sur appareil |

**Essai de bout en bout** (après les opérations 1, 2 et 4) : sur votre téléphone, activez les notifications (catégorie « Informations importantes ») ; depuis l'ordinateur, envoyez une notification d'essai ; lancez **Actions → Notifications push → Run workflow** ; la notification doit arriver, et le clic doit ouvrir la page choisie. L'historique doit indiquer « 1 reçue(s) sur 1 ».
