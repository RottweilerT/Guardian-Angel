# Arborescence des écrans

Navigation principale : **Accueil · Carte · Missel · Journal · Profil**.

```
Accueil  #/accueil
├─ Recherche rapide d'une église → Carte filtrée
├─ Missel du jour · Carte · Journal · Passeport · Missions · Sources et droits
Carte  #/carte[/recherche]
├─ Filtres (nom, arrondissement, accessibilité, offices, favorites, autour de moi)
├─ Carte + liste
└─ Fiche église  #/eglise/{id}
   ├─ Favorite · Marquer visitée (fenêtre) · Ajouter au journal · Signaler une erreur (fenêtre)
   └─ Messes · Confessions · Adoration · Histoire et photographies
Missel  #/missel[/AAAA-MM-JJ]            (thème bleu et blanc)
├─ Jour précédent / suivant / choix de date
├─ Calendrier (actuel | 1962) · Langue (latin | bilingue | français) · Taille · Favori
└─ Parties de la messe (repliables) → lien vers le journal à l'homélie
Journal  #/journal                        (thème bleu et blanc)
├─ Recherche · Catégorie · Liste
└─ Entrée  #/journal/nouveau[/{église}] · #/journal/e/{id}
Missions  #/missions                      (thème rouge et noir)
├─ Filtre par domaine · Liste
└─ Proposer mon aide (fenêtre) · [admin] Publier / Candidatures / Supprimer
Passeport  #/passeport
├─ Mes visites
└─ Parcours  #/parcours/{id}              (thème rouge et noir)
Profil  #/profil
├─ Compte (connexion, déconnexion) · Consentement (fenêtre à la première connexion)
├─ Préférences liturgiques · Export · Suppression
└─ Sources et droits  #/sources · Confidentialité · CGU · Mentions légales (pages)
```
