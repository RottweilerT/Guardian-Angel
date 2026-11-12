# État des fonctionnalités

Vérifié le 11 novembre 2026 par les tests automatisés et un parcours complet dans un navigateur (avec Firebase simulé). Le comportement sur le service en ligne reste à confirmer par un essai manuel après déploiement.

## Opérationnel

**Carte des églises**
- Extraction des lieux de culte catholiques de Paris depuis OpenStreetMap, à chaque mise en ligne et chaque lundi.
- Carte interactive, liste, recherche par nom ou adresse, filtre par arrondissement, par accessibilité, par offices renseignés, par favorites ; tri par distance sur demande (position non enregistrée).
- Fiche : adresse, site officiel, accessibilité, offices bruts d'OSM marqués « non vérifié » avec source et date, sinon « Horaire non renseigné » ; lien d'itinéraire.
- Favorites ; signalement d'une erreur (compte requis).

**Missel**
- Deux calendriers distincts : romain actuel (général + France) et 1962 (temporal, fêtes de 1re et 2e classe).
- Navigation par date, couleur et rang du jour, parties fixes conditionnelles (Gloria, Credo).
- Ordinaire en latin pour les textes anciens du domaine public ; modes latin / bilingue / français (le français affiche l'emplacement réservé « autorisation à demander ») ; explications originales ; taille du texte ; jours favoris ; hors ligne.
- Références bibliques et résumés originaux pour les jours préparés (8 au 15 novembre 2026, missel actuel).

**Journal spirituel**
- Entrées : date, catégorie, église (liée à la carte), notes, passages bibliques, réflexions, intentions ; recherche, filtre, modification, suppression.
- Sans compte : stockage sur l'appareil. Avec compte : synchronisation après consentement explicite.

**Missions paroissiales**
- Liste publique des missions publiées, filtre par domaine ; candidature (message, compétences, disponibilités), retrait ; publication, suppression et lecture des candidatures par un administrateur.

**Passeport et parcours**
- Marquer une église comme visitée (date, note), carnet des visites ; trois parcours thématiques reliés aux fiches.

**Notifications push** (code en place ; envoi réel à confirmer après génération de la clé Web Push — voir `NOTIFICATIONS.md`)
- Abonnement volontaire par bouton, sans compte (session anonyme), multi-appareils ; catégories missions, solennités, informations importantes, nouveautés ; pause ; désabonnement.
- Envoi automatique à la publication d'une mission et le matin des solennités ; envoi manuel par les administrateurs avec aperçu, confirmation, historique et annulation.
- Aide à l'installation sur iPhone/iPad ; message dans l'application lorsqu'elle est au premier plan.

**Compte et confidentialité**
- Utilisation complète sans compte pour les fonctions publiques ; connexion Google facultative ; préférences liturgiques ; export JSON ; suppression du compte et des données ; pages légales (projets) ; registre des sources consultable dans l'application.

## Restant à développer

| Sujet | Blocage |
| --- | --- |
| Horaires fiables (messes, confessions, adorations), filtres par date, heure, langue, tradition liturgique | Autorisation et source de données |
| Traductions françaises ; propres du jour ; prières eucharistiques ; offertoire et canon de 1962 | Droits (AELF, LEV) ; source vérifiée pour le latin ancien |
| Fêtes de 3e classe, mémoires, commémoraisons, calendriers diocésains, variantes | Développement + validation par un liturgiste |
| Histoire des églises, œuvres, saints patrons, photographies | Rédaction et licences |
| Itinéraire tracé des parcours ; photos personnelles du passeport | Développement (stockage de fichiers) |
| Enregistrement, transcription, résumé d'homélies | Accords, prestataire, serveur |
| Comptes paroissiaux vérifiés, espace d'administration, événements, actualités, modération outillée | Développement + procédure de vérification |
| Dons | Cadre juridique et prestataire de paiement |
| Connexion e-mail / mot de passe et réinitialisation | Activation du fournisseur dans Firebase + écran dédié |
| Application native (magasins) | Migration Expo |
| Notifications : envoi instantané (aujourd'hui 5 à 20 min) | Cloud Functions, forfait Blaze |
| Surveillance des erreurs, App Check, alerte de budget | Configuration |
| Audit d'accessibilité, internationalisation | À planifier |
