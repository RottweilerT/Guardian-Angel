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
scripts/           extraction OpenStreetMap, génération du registre
tests/             tests unitaires et tests des règles Firestore
docs/              livrables de conception et de conformité
```
