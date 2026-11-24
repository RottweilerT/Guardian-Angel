# Plan de conformité RGPD

> Document de travail ; à valider par un juriste ou un délégué à la protection des données.

## Principes appliqués dans le code

| Principe | Mise en œuvre |
| --- | --- |
| Fonctionnement sans compte | Carte, missel, parcours, missions (lecture), journal et passeport locaux |
| Données sensibles (art. 9) | Le journal et le passeport peuvent révéler des convictions religieuses : **consentement explicite** par case à cocher avant tout enregistrement serveur ; les règles Firestore refusent toute écriture sans document de consentement ; refus = aucune donnée transmise et déconnexion |
| Privé par défaut | Lecture limitée au propriétaire ; aucun partage, aucun profil public, aucun historique visible par des tiers ni par les administrateurs |
| Minimisation | Préférences et favoris conservés sur l'appareil ; pas de mesure d'audience ; pas de cookie de suivi ; aucune police ni script d'un CDN tiers (hors Google, sous-traitant) |
| Géolocalisation | Ponctuelle, sur demande, traitée dans le navigateur, jamais stockée ni transmise |
| Portabilité et effacement | Profil → export JSON ; suppression immédiate du compte et de toutes les données |
| Sécurité | HTTPS et HSTS, CSP stricte, règles d'accès testées, clé de service uniquement dans GitHub Secrets |
| Pas de profilage ni de publicité | Aucun traitement de ce type ; notes jamais envoyées à un service d'IA |

## Registre des traitements (synthèse)

| Traitement | Finalité | Base légale | Données | Conservation |
| --- | --- | --- | --- | --- |
| Compte | Authentifier | Contrat (6-1-b) | Identifiant, e-mail, nom (Google) | Jusqu'à suppression |
| Journal et passeport synchronisés | Retrouver ses notes sur ses appareils | Consentement explicite (9-2-a) | Dates, lieux, notes, intentions, visites | Jusqu'à suppression ; purge des comptes inactifs à définir (proposition : 3 ans, après notification) |
| Candidatures | Mise en relation avec une paroisse | Consentement | Message, compétences, disponibilités, e-mail | Jusqu'au retrait ; 12 mois au plus (à confirmer) |
| Signalements | Qualité des données | Intérêt légitime | Message, identifiant | 12 mois (à confirmer) |
| Notifications push | Alerter l'utilisateur selon ses choix | Consentement (bouton explicite + autorisation du navigateur), retirable | Identifiant FCM de l'appareil, catégories, état, dates, uid de session | Jusqu'au désabonnement ; purge automatique après 9 mois d'inactivité ou si invalide |

## Sous-traitants et transferts

- **Google Firebase** (Hosting, Authentication, Firestore — emplacement de la base : UE). Accepter l'avenant de traitement des données Google Cloud ; transferts hors UE encadrés par clauses contractuelles types et Data Privacy Framework ; à documenter.
- **Fondation OpenStreetMap** (tuiles) : destinataire de l'adresse IP à l'ouverture de la carte ; mentionné dans la politique. Alternative : fournisseur de tuiles européen sous contrat.
- **GitHub** : code source et automatisation ; le programme d'envoi des notifications lit les abonnements (identifiants techniques) au moment de l'envoi, sans les conserver. GitHub étant établi aux États-Unis, ce traitement relève des transferts hors UE à documenter.
- **Services push des navigateurs** (Google, Apple, Mozilla, Microsoft) : acheminent les notifications.

Les catégories suivies peuvent révéler un intérêt religieux (comme tout l'usage de l'application) : elles sont limitées à quatre thèmes génériques, ne sont liées à aucune identité sans compte, et ne sont jamais transmises aux services push.

## À faire avant ouverture au public

- [ ] Identifier le responsable du traitement et compléter les mentions légales et la politique.
- [ ] **AIPD** : très probablement requise (données sensibles à grande échelle, personnes potentiellement vulnérables) — à réaliser.
- [ ] Tenir le registre des traitements complet ; procédure de violation de données (72 h).
- [ ] Fixer et automatiser les durées de conservation (purge des comptes inactifs, des candidatures, des signalements).
- [ ] Politique de sauvegarde Firestore (export planifié chiffré) et test de restauration.
- [ ] Activer App Check et une alerte de budget ; journal d'audit des actions d'administration.
- [ ] Âge minimal (15 ans) et parcours pour les mineurs ; vérification à définir.
- [ ] Chiffrement de bout en bout du journal : à étudier (les données sont chiffrées au repos par Google, mais lisibles par le sous-traitant).
- [ ] Bandeau cookies : non nécessaire tant qu'aucun traceur non essentiel n'est déposé ; à réévaluer à chaque ajout de service.

## Enregistrement des sermons (ajouté le 16/11/2026)

- **Où sont les données** : l'audio, la transcription et les notes sont stockés uniquement sur l'appareil de l'utilisateur (IndexedDB, base « ga-sermons »). Ils ne sont jamais envoyés à Firebase ni à un serveur de l'application. Seul le compte rendu, si l'utilisateur choisit « Ajouter à mon journal », rejoint le journal (synchronisé avec le compte si l'utilisateur est connecté et a donné son consentement).
- **Accord du prédicateur** : l'enregistrement ne démarre qu'après une case à cocher confirmant l'accord du prédicateur et un usage personnel. La voix est une donnée personnelle et l'homélie une œuvre de l'esprit : aucune diffusion n'est prévue par l'application.
- **Transcription en direct** : elle utilise la reconnaissance vocale du navigateur (Web Speech API). Avec Chrome, le son est analysé par les serveurs de Google ; l'utilisateur en est informé et peut désactiver l'option avant de commencer.
- **Compte rendu** : l'application prépare un texte que l'utilisateur copie lui-même dans Claude (Anthropic). Ce transfert est une action volontaire de l'utilisateur, soumise aux conditions de Claude.
- **Suppression** : bouton « Supprimer ce sermon » (audio, notes et transcription) ; la suppression des données du site dans le navigateur efface aussi tout.
- **Transcription après le sermon (ajout du 16/11/2026)** : elle se fait sur l'appareil avec le modèle Whisper (Transformers.js). L'audio n'est envoyé nulle part. Au premier usage, le navigateur télécharge la bibliothèque depuis jsDelivr et le modèle (~80 Mo) depuis Hugging Face : ces services voient l'adresse IP de l'appareil, comme pour tout téléchargement. La transcription en direct (reconnaissance vocale du navigateur) est désormais décochée par défaut.

## Droit à l'effacement (16/11/2026)

Profil → « Supprimer définitivement toutes mes données » : confirmation en écrivant SUPPRIMER, puis suppression des signalements, du compte et de ses sous-collections, des candidatures, des abonnements push (et de la session anonyme), de toutes les bases IndexedDB (sermons, Firebase), de tous les caches et de tout le stockage local. Les règles Firestore permettent désormais à chacun de lire et supprimer ses propres signalements.

### Refonte de l'onglet Sermon (22/11/2026)
- Tout reste sur l'appareil (IndexedDB « ga-sermons ») : audio (morceaux de 5 s), transcription (enregistrée tranche par tranche), réponses de Claude collées par l'utilisateur, notes personnelles. Le navigateur est invité à rendre ce stockage persistant (`navigator.storage.persist`).
- Analyses par IA (explication d'un passage, plan détaillé, résumé, approfondissement avec les notes) : **aucun envoi automatique**. Chaque bouton prépare une demande, la copie dans le presse-papiers et ouvre claude.ai (le début de la demande peut figurer dans l'adresse ouverte, paramètre `q`). Le texte n'est transmis à Anthropic que si l'utilisateur l'envoie dans Claude ; pour « Approfondir avec mes notes », la demande contient les notes personnelles — l'utilisateur en est informé dans « Où vont mes données ? ».
- Suppression : un sermon entier, ou l'audio seul (le texte est gardé) ; « Supprimer toutes mes données » efface la base.

## Sauvegardes de Firestore (ajouté le 25/11/2026)
- **Quoi** : copie quotidienne de toute la base Firestore (comptes, journal, visites, abonnements aux notifications, missions, candidatures, signalements) par GitHub Actions, avec le compte de service.
- **Où** : fichier `sauvegarde/base.json.enc` dans le dépôt GitHub (public), **chiffré** en AES-256-CBC (clé dérivée par PBKDF2, 200 000 itérations) avec le secret `SAUVEGARDE_CLE`. Le contenu n'apparaît jamais en clair dans le dépôt ni dans les journaux des workflows (nombres seulement).
- **Durée de conservation** : l'historique Git garde toutes les versions. Conséquence à connaître : quand un utilisateur supprime ses données, elles disparaissent de la base et des sauvegardes suivantes, mais restent dans les anciennes copies chiffrées. À préciser dans la politique de confidentialité, ou à compléter par une purge périodique de l'historique (À DÉCIDER).
- **Accès** : seule la personne qui détient `SAUVEGARDE_CLE` peut déchiffrer ; restauration uniquement à la main (confirmation `RESTAURER`).
