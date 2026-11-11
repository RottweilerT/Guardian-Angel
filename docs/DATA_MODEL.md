# Modèle de données

## Version actuelle (Firestore + fichiers statiques)

Les données **publiques** sont des fichiers statiques versionnés ; les données **privées** vivent sous `users/{uid}` et ne sont lisibles que par leur propriétaire (pas même par un administrateur). Règles : `firestore.rules`, testées par `tests/rules.spec.mjs`.

| Entité du cahier des charges | Mise en œuvre actuelle | État |
| --- | --- | --- |
| Users | Firebase Authentication | Fait |
| UserPreferences | Stockage local de l'appareil (minimisation) ; consentement dans `users/{uid}/meta/consent` | Fait |
| Churches | `public/data/churches.json` (`id`, `osm`, `name`, `lat`, `lon`, `arr`, `address`, `website`, `wheelchair`, `serviceTimes`, `operator`, `wikidata`) | Fait |
| Parishes, ParishAdministrators | `admins/{uid}` (administrateurs de l'application) | Partiel |
| MassSchedules, MassOccurrences, ConfessionSchedules, AdorationSchedules | Champ brut `serviceTimes` d'OSM uniquement | À faire (source) |
| ParishEvents, ParishProjects | — | À faire |
| LiturgicalCalendars, LiturgicalCelebrations | Code : `liturgie-romain.js`, `liturgie-1962.js` | Fait (périmètre limité) |
| LiturgicalTexts | `public/js/ordo.js` (`id`, `titre`, `section`, `la`, `droits`, `manque`, `explication`) ; `public/data/lectures/{date}.json` | Fait (domaine public) |
| ContentRights, DataSources | `public/data/content-rights.json` ; métadonnées `meta` de `churches.json` | Fait |
| PersonalMassEntries, SpiritualNotes | `users/{uid}/journal/{id}` : `id`, `date`, `categorie`, `eglise`, `egliseId`, `notes`, `passages`, `reflexions`, `intentions`, `updatedAt` | Fait |
| HomilyRecordings, HomilyTranscripts, HomilySummaries | — | Non engagé |
| VolunteerMissions | `missions/{id}` : `titre`, `paroisse`, `domaine`, `description`, `status`, `createdBy`, `createdAt` | Fait |
| VolunteerApplications | `applications/{missionId}_{uid}` : `uid`, `missionId`, `email`, `message`, `competences`, `disponibilites`, `status`, `createdAt` | Fait |
| ChurchVisits | `users/{uid}/visits/{churchId}` : `churchId`, `nom`, `date`, `note`, `updatedAt` | Fait |
| SpiritualRoutes, RouteStops | `public/data/routes.json` | Fait |
| AuditLogs | — (signalements : `reports/{id}`) | À faire |

**Suppression** : la suppression du compte efface `journal`, `visits`, `meta`, les anciennes `notes`, les candidatures, puis le compte. Firestore n'a pas de migrations : les évolutions de structure passent par les règles et par des scripts ponctuels.

## Cible (PostgreSQL + PostGIS)

`docs/schema.sql` décrit les 26 entités avec relations, contraintes, index, isolation des données privées (schéma `priv`, sécurité au niveau des lignes) et politiques de suppression (`ON DELETE CASCADE` pour tout ce qui appartient à l'utilisateur). Ce schéma n'est pas exécuté dans la version actuelle ; il sert de référence pour la migration décrite dans `ARCHITECTURE.md`.
