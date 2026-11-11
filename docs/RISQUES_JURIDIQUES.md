# Risques et points bloquants avant publication

> Ce rapport est une analyse préparatoire produite avec une assistance automatisée. **Il ne constitue pas un avis juridique** et ne remplace ni un avocat, ni un DPO, ni la relecture d'un liturgiste. L'application en ligne est une démonstration : ne pas la présenter comme prête à être publiée.

## Bloquants

| # | Sujet | Risque | Action |
| --- | --- | --- | --- |
| 1 | **Identité de l'éditeur et du responsable de traitement** | Mentions légales incomplètes (LCEN), politique de confidentialité sans responsable | Compléter les emplacements « À COMPLÉTER » |
| 2 | **Données sensibles (convictions religieuses)** | Traitement de l'article 9 RGPD ; AIPD probablement obligatoire | Réaliser l'AIPD ; faire valider le recueil du consentement |
| 3 | **Validation liturgique** | Calendriers calculés (1962 : périmètre réduit) ; textes latins saisis à la main | Relecture par une personne compétente ; collation des textes sur une édition de référence |
| 4 | **Origine du logo** | Droits non documentés (auteur ou outil de génération ; conditions d'usage commercial) | Fournir le justificatif ; à défaut, remplacer l'image |
| 5 | **Textes sous droits** | Aucune traduction française ni texte postérieur à 1969 n'est intégré ; le missel est donc incomplet | Demandes listées dans `AUTORISATIONS.md` |

## À traiter

| Sujet | Analyse | Action |
| --- | --- | --- |
| OpenStreetMap (ODbL) | Attribution affichée ; la base dérivée (`churches.json`) est publique dans le dépôt, ce qui répond au partage à l'identique | Conserver l'attribution sur chaque écran qui affiche les données |
| Tuiles OSM | Politique d'usage : pas de trafic important ni d'usage commercial intensif | Souscrire à un fournisseur de tuiles avant la montée en charge |
| Horaires | Le champ `service_times` peut être faux ou périmé | Affiché « non vérifié » avec source et date ; ne rien afficher d'autre sans accord des paroisses ou de MessesInfo ; pas d'extraction automatisée de sites tiers |
| Enregistrement des homélies | Droits d'auteur et droit à la voix du prédicateur ; données de tiers ; conditions des services d'IA | Fonction non développée ; exiger un accord écrit, usage privé par défaut, aucune publication automatique |
| Résumés des lectures et explications | Textes originaux, signalés comme non liturgiques | Faire relire ; ne jamais les présenter comme officiels |
| Missions et bénévolat | Responsabilité d'hébergeur pour les annonces ; usurpation de la qualité de représentant d'une paroisse ; protection des mineurs et des personnes vulnérables dans certaines missions | Publication réservée aux comptes vérifiés ; procédure de signalement et de retrait ; rappel des obligations propres à l'encadrement de mineurs |
| Dons | Réglementation des appels à la générosité, reçus fiscaux, lutte anti-blanchiment, conditions des prestataires | Non activé ; ne rien ouvrir sans cadre validé |
| Photographies | Droits des photographes, œuvres représentées, droit à l'image | Aucune image tierce ; vérifier chaque licence avant ajout |
| Accessibilité | Obligation d'accessibilité numérique selon la qualité de l'éditeur | Audit RGAA, déclaration d'accessibilité |
| Marque et nom | « Guardian Angel » : disponibilité non vérifiée | Recherche d'antériorité (INPI/EUIPO) avant communication |
| Dépendances | Leaflet (BSD-2), SDK Firebase (Apache-2.0), outils de test (MIT/Apache) | Conserver les notices de licence ; revue à chaque ajout |
| Conditions Google | Connexion Google : respect des règles de marque du bouton ; conditions Firebase | Vérifier avant publication |
| Indépendance vis-à-vis de l'Église | Risque de confusion avec un service officiel | Mention d'indépendance dans les CGU ; aucun logo diocésain sans accord |
