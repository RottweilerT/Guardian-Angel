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
