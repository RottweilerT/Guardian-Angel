# Architecture et décisions techniques

## Décision principale

Le cahier des charges évoque Next.js, React Native/Expo et PostgreSQL/PostGIS. Pour cette **première version réellement utilisable**, l'architecture retenue est différente, et assumée :

| Besoin | Choix v1 | Pourquoi |
| --- | --- | --- |
| Web + mobile | **Une application web progressive (PWA)** en modules JavaScript natifs, sans framework ni étape de build | Un seul code pour le navigateur, iPhone et Android (installable sur l'écran d'accueil, hors ligne). Aucun coût, aucune chaîne de compilation à maintenir. |
| Données et comptes | **Firebase** : Hosting, Authentication, Cloud Firestore (UE) | Le projet `guardian-angel-62a43` est déjà provisionné et déployé en continu. Les contrôles d'accès sont appliqués côté serveur par `firestore.rules` (testées). |
| Données publiques | **Fichiers JSON statiques** générés à la mise en ligne | Zéro lecture de base pour la carte, le missel et les parcours ; fonctionne hors ligne ; traçabilité des sources. |
| Recherche géographique | Calcul de distance dans le navigateur | ≈ 200 à 300 églises à Paris : PostGIS est inutile à cette échelle. |
| Carte | Leaflet (copie locale) + tuiles OpenStreetMap | Licences ouvertes, pas de clé d'API, pas de CDN tiers pour le code. |

Limites assumées : pas d'application native en magasin, pas de tâches serveur (transcription audio), pas de recherche plein texte côté serveur, administration des paroisses minimale.

**Trajectoire** : lorsque l'extension France entière, les comptes paroissiaux et la transcription seront engagés, migrer vers l'architecture cible — API commune (Next.js / TypeScript), PostgreSQL + PostGIS (schéma prêt : `docs/schema.sql`), stockage objet, file de tâches, application Expo. Les modules sont déjà séparés pour cela.

## Séparation des responsabilités

| Couche | Fichiers |
| --- | --- |
| Interface | `public/index.html`, `public/css/ds.css`, `public/js/views/*` |
| Logique métier | `public/js/app.js` (routeur, consentement), `public/js/store.js` (données personnelles) |
| Moteur liturgique | `public/js/liturgie-romain.js`, `public/js/liturgie-1962.js` (fonctions pures, testées) |
| Textes | `public/js/ordo.js` — deux formes modélisées séparément |
| Gestion des droits | `public/data/content-rights.json` → `docs/CONTENT_RIGHTS_REGISTER.md` ; test bloquant si une ressource non autorisée est utilisée |
| Services externes | `public/js/cloud.js` (Firebase), `scripts/fetch-churches.mjs` (OpenStreetMap) |
| IA | Aucune fonction active (voir `docs/RISQUES_JURIDIQUES.md`) |
| Sécurité | `firestore.rules`, en-têtes HTTP et CSP dans `firebase.json` ; aucun secret côté client (la clé de service n'existe que dans GitHub Secrets) |

## Sources de données

| Donnée | Source | Statut |
| --- | --- | --- |
| Églises de Paris (nom, position, adresse, site, accessibilité) | OpenStreetMap via Overpass, ODbL | **Utilisée** |
| Offices | Champ contributif OSM `service_times`, affiché « non vérifié » | Utilisée, partielle |
| Horaires fiables des messes, confessions, adorations | MessesInfo (CEF), diocèse, paroisses | Autorisation à demander |
| Calendriers liturgiques | Calcul original | Utilisé, à valider |
| Ordinaire latin ancien | Domaine public | Utilisé, à collationner |
| Traductions françaises, propres du jour | AELF, éditeurs | Autorisation à demander |
| Histoire, photographies | À rédiger / Wikimedia Commons au cas par cas | Non intégré |
| Patrimoine (base Mérimée, data.gouv.fr) | Licence Ouverte à confirmer | À étudier |

## Plan d'exécution

| Phase | Contenu | État |
| --- | --- | --- |
| 1 — Fondations | Projet, design system, navigation, base, authentification, sources et licences | Fait |
| 2 — Carte | Carte, recherche, fiches, filtres, sources, signalement | Fait hors horaires fiables |
| 3 — Missel | Deux calendriers, structure des textes, modes de langue, droits, hors ligne | Fait hors textes sous droits |
| 4 — Journal | Historique, notes, favoris, confidentialité | Fait ; audio et IA non engagés |
| 5 — Paroisses et patrimoine | Missions, candidatures, passeport, parcours | Socle fait ; comptes paroissiaux à construire |

Le détail figure dans `docs/FONCTIONNALITES.md`.

## Qualité

- Tests : `node --test` (calendriers sur 2020-2040, registre des droits, données, extraction), règles Firestore sur émulateur, exécutés par la CI à chaque push.
- Accessibilité : HTML sémantique, navigation clavier, lien d'évitement, contrastes AA (l'or `#B89549` sert aux filets ; le texte doré utilise `#7A5F22`), `prefers-reduced-motion`. Audit RGAA à faire.
- Internationalisation : textes d'interface regroupés par vue ; extraction dans des fichiers de langue à faire avant une seconde langue.
- Journalisation et surveillance des erreurs : non mises en place (à choisir avec un prestataire conforme au RGPD).
