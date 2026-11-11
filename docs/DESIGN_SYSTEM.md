# Design system

Source : `public/css/ds.css`. Une seule identité, trois directions appliquées par l'attribut `data-theme` sur la zone de contenu.

| Direction | Où | Jetons |
| --- | --- | --- |
| **Blanc et or** (principale) | Accueil, carte, fiches, passeport, profil, navigation | `#FFFFFF`, `#FAF8F2`, or `#B89549`, or clair `#D9C38A`, anthracite `#292929` |
| **Bleu et blanc** | Missel, journal | `#173B65`, `#527CA5`, `#FFFFFF`, `#F4F8FC` |
| **Rouge et noir** | Missions, parcours | `#8F2332`, `#641925`, `#171717`, `#292929` |

Règle de lisibilité : l'or `#B89549` est réservé aux filets, ornements et bordures (contraste insuffisant pour du texte sur blanc) ; le texte doré utilise `#7A5F22`. Dans la direction rouge et noir, seul le bandeau de titre est sombre ; le contenu reste sur fond blanc.

**Typographie** — titres et textes liturgiques : pile serif système (Iowan Old Style, Palatino, Georgia) ; interface : pile sans serif système. Aucune police tierce n'est téléchargée (pas de transfert d'adresse IP, pas de licence à gérer). Évolution possible : polices sous licence OFL hébergées sur le site.

**Espacements** `--s1…--s7` (4 à 48 px) · **rayon** 10 px · **ombre** légère unique.

**Composants** : `.hero` (bandeau de titre + ornement `.orn`), `.card`, `.grid`, `.btn` (plein, `.ghost`, `.gold`, `.danger`, `.sm`), `.chip`, `.seg` (choix exclusif), champs de formulaire, `.list`, `.kv` (fiche), `.notice` (information, `.rights` pour les mentions de droits, `.err`), `.empty` (état vide), `.skeleton` (chargement), `.toast`, `<dialog>` (fenêtre modale), `.nav` (navigation basse), `.missel` (texte liturgique : ℣ ℟ et rubriques en rouge, colonnes en mode bilingue, taille pilotée par `--lecture`).

**Icônes** : pictogrammes au trait dessinés pour l'application (navigation). **Logo** : illustration fournie par le porteur du projet (voir registre des droits).

**États** : chargement (squelette), vide (cadre pointillé + action), erreur (notice rouge), hors ligne (messages dédiés sur la carte et les missions). **Mouvements** : transitions courtes, désactivées si `prefers-reduced-motion`.
