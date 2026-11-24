# Guardian Angel

Plateforme catholique web et mobile (application web installable) : **carte des églises de Paris**, **missel** (calendrier actuel et missel de 1962), **journal spirituel** privé, **missions paroissiales**, **passeport des églises** et parcours.

En ligne : https://guardian-angel-62a43.web.app — **version de démonstration**, non validée juridiquement ni liturgiquement (voir `docs/RISQUES_JURIDIQUES.md`).

| Document | Contenu |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architecture, décisions techniques, sources de données, plan par phases |
| [`docs/FONCTIONNALITES.md`](docs/FONCTIONNALITES.md) | Ce qui fonctionne réellement / ce qui reste à faire |
| [`docs/ECRANS.md`](docs/ECRANS.md) | Arborescence des écrans |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Blanc et or, bleu et blanc, rouge et noir ; composants |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · [`docs/schema.sql`](docs/schema.sql) | Modèle de données actuel (Firestore) et schéma cible PostgreSQL/PostGIS |
| [`docs/CONTENT_RIGHTS_REGISTER.md`](docs/CONTENT_RIGHTS_REGISTER.md) | Registre des licences et droits d'auteur |
| [`docs/AUTORISATIONS.md`](docs/AUTORISATIONS.md) | Autorisations à demander |
| [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) | Notifications push : fonctionnement, configuration, maintenance |
| [`docs/RGPD.md`](docs/RGPD.md) | Plan de conformité RGPD |
| [`docs/RISQUES_JURIDIQUES.md`](docs/RISQUES_JURIDIQUES.md) | Risques et points bloquants avant publication |

## Installation

Prérequis : Node.js 20+, Java 11+ (émulateurs), CLI Firebase (`npm i -g firebase-tools`).

```bash
npm install
npm run churches     # extrait les églises depuis OpenStreetMap → public/data/churches.json
npm run emulators    # copie Leaflet dans public/vendor, puis Hosting :5000, Firestore :8080, Auth :9099
```

Sur `localhost`, l'application utilise les émulateurs. Sans Firebase (`npx serve public`), tout fonctionne en mode local, hors missions et synchronisation.

```bash
npm test             # calendriers liturgiques, registre des droits, données, extraction OSM
npm run test:rules   # règles de sécurité Firestore (émulateur)
npm run rights       # régénère docs/CONTENT_RIGHTS_REGISTER.md
```

## Déploiement

Automatique : chaque `git push` sur `main` lance `.github/workflows/deploy.yml` (tests → copie de Leaflet → extraction OpenStreetMap → déploiement Hosting + règles Firestore). L'extraction est rafraîchie chaque lundi.

Configuration GitHub (déjà en place) : secret `FIREBASE_SERVICE_ACCOUNT`, variable `FIREBASE_PROJECT_ID`.
Manuel : `firebase login` puis `npm run deploy`.

**Désigner un administrateur** (publication des missions, lecture des signalements) : console Firebase → Firestore → créer le document `admins/{UID}` (l'UID se lit dans Authentication → Utilisateurs), avec un champ quelconque, par exemple `role: "admin"`.

## Sauvegardes de la base (onglet Actions)

- **Sauvegarde de la base** (`sauvegarde.yml`) : chaque nuit (02:23 UTC), copie de **toute** la base Firestore, sous-collections comprises, chiffrée en AES-256 (PBKDF2). Copie faite seulement si la base a changé.
  - la plus récente : branche **`sauvegardes`** (une seule version, réécrite à chaque fois ; ne jamais la fusionner dans `main`) ;
  - les copies quotidiennes : **artefacts** des exécutions, nommés `sauvegarde-AAAA-MM-JJ`, effacés automatiquement au bout de **30 jours**.
- **Vérifier la sauvegarde** (`verifier-sauvegarde.yml`) : chaque lundi et à la main (champ vide = la plus récente, ou une date `AAAA-MM-JJ`) ; déchiffre, contrôle le format, prépare la restauration sans rien écrire et compare à la base actuelle (nombres uniquement dans le journal).
- **Restaurer la base** (`restaurer.yml`) : à la main, en tapant `RESTAURER` (même choix de version) ; réécrit chaque document sauvegardé (les documents créés depuis restent).
- Secrets requis : `SAUVEGARDE_CLE` (clé de chiffrement, **conservée aussi hors de GitHub** : sans elle les sauvegardes sont illisibles) et `FIREBASE_SERVICE_ACCOUNT`.
- Code : `server/sauvegarde.mjs`, `server/sauvegarde-lib.mjs` (testé par `tests/sauvegarde.test.mjs`), `scripts/recuperer-sauvegarde.sh`.
- Historique : une seule copie chiffrée du 25/11/2026 reste dans l'historique de `main` (commit `c2359d2`, dossier `sauvegarde/`, supprimé depuis) ; elle se restaure en donnant cet identifiant comme version.

## Structure

```
public/            application (aucune étape de build)
  css/ds.css       design system
  js/app.js        routeur, session, consentement
  js/cloud.js      Firebase (chargé à la demande)
  js/store.js      données personnelles : local ou compte, export, suppression
  js/liturgie-*.js moteurs de calendrier (actuel, 1962)
  js/ordo.js       ordinaire de la messe (latin du domaine public, explications originales)
  js/views/        accueil, carte, missel, journal, missions, passeport, profil
  data/            églises (OSM), lectures (références), parcours, registre des droits
server/            serveur de notifications (exécuté par GitHub Actions)
scripts/           extraction OpenStreetMap, génération du registre, vérification du SDK
tests/             tests unitaires et tests des règles Firestore
docs/              livrables de conception et de conformité
```
