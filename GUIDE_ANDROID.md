# Rues et églises de Paris sur un téléphone Android

Données © les contributeurs d'OpenStreetMap — licence ODbL 1.0 (https://www.openstreetmap.org/copyright).
Toute réutilisation doit mentionner : « © les contributeurs d'OpenStreetMap ». Si vous publiez une base dérivée (fichier modifié), elle doit rester sous ODbL.

## A. Extraire vous-même avec Overpass Turbo (Chrome)

1. Ouvrez **Chrome** et allez sur **https://overpass-turbo.eu**.
2. Fermez la fenêtre d'accueil éventuelle. L'éditeur de requête est à gauche (ou en haut en mode portrait).
   Astuce : menu ⋮ de Chrome → cochez **Version pour ordinateur** pour avoir les boutons à l'écran.
3. Appuyez dans l'éditeur, sélectionnez tout (appui long → **Tout sélectionner**) et effacez.
4. Collez une requête du dossier `overpass-turbo/` :
   - `1_eglises_paris.overpassql` — églises (léger, recommandé en premier) ;
   - `3_rues_un_arrondissement.overpassql` — rues d'un arrondissement (remplacez `75104` par le code voulu : 75101 = 1er … 75120 = 20e) ;
   - `2_rues_paris.overpassql` — toutes les rues de Paris (≈ 30 Mo : souvent trop lourd pour un téléphone) ;
   - `4_rues_et_eglises_paris.overpassql` — tout en un (très lourd).
5. Appuyez sur **Exécuter** (en haut). Si un message signale « beaucoup de données », appuyez sur **Continuer quand même**.
   Si une erreur « timeout » ou « 504 » apparaît, le serveur est saturé : réessayez quelques minutes plus tard.
6. Appuyez sur **Exporter** → onglet **Données** → **GeoJSON** → **télécharger**.
7. Le fichier (`export.geojson`) arrive dans **Téléchargements**. Renommez-le si besoin (`eglises_paris.geojson`…).

## B. Utiliser les fichiers préparés

Les fichiers prêts à l'emploi (`rues_paris.geojson`, `eglises_paris.geojson`, `rues_et_eglises_paris.geojson`) sont dans le dossier `donnees/` de la branche **donnees-osm-paris** du dépôt GitHub, avec `rapport_extraction.md` (date, comptages, données manquantes).
Sur GitHub : ouvrez le fichier → bouton **⋯** → **Download** (ou **Raw**, puis menu ⋮ → **Télécharger**).

## C. Retrouver les fichiers sur le téléphone

- Application **Fichiers** (ou **Files by Google**, ou **Mes fichiers** sur Samsung) → **Téléchargements**.
- Dans Chrome : menu ⋮ → **Téléchargements**.

## D. Voir les données sur une carte

| Application | Gratuite | Comment ouvrir un GeoJSON |
| --- | --- | --- |
| **Organic Maps** | oui, sans publicité | menu → **Signets et traces** → **Importer** ; ou appuyez sur le fichier dans Fichiers → **Ouvrir avec Organic Maps** (les points s'affichent ; les lignes de rues aussi, mais lourdes) |
| **QField** (QGIS mobile) | oui | **Ouvrir un fichier local** → choisissez le `.geojson` ; affiche lignes, polygones et attributs |
| **geojson.io** (site web, dans Chrome) | oui | **Open** → **File** → choisissez le fichier (idéal pour les églises ; les rues de tout Paris sont trop lourdes) |
| **QGIS** (ordinateur) | oui | glissez le fichier dans la fenêtre ; le système de coordonnées est reconnu automatiquement (EPSG:4326) |

Conseil : sur téléphone, ouvrez d'abord `eglises_paris.geojson` (petit) ; les rues de tout Paris représentent plusieurs dizaines de mégaoctets.

## E. Contenu des fichiers

Tous les fichiers : GeoJSON RFC 7946, WGS84 (EPSG:4326), coordonnées [longitude, latitude], un bloc `metadata` (source, licence, date d'extraction).

**rues_paris.geojson** — un objet par tronçon de voie OSM nommé (une rue est souvent découpée en plusieurs tronçons) :
`nom`, `autres_noms`, `type_voie` (valeur `highway`), `type_voie_fr`, `osm_id` (ex. `way/123`), `osm_ref`, `arrondissement`, `code_insee`, `arrondissements_traverses`, `sens_unique`, `revetement`, `ref_voie`, `longueur_m`, `lat`/`lon` (point milieu). Géométrie : ligne (ou polygone pour les places piétonnes).

**eglises_paris.geojson** — lieux de culte chrétiens et bâtiments d'église :
`nom`, `autres_noms`, `denomination` (catholic, protestant, orthodox…), `religion`, `lieu_de_culte`, `batiment`, `adresse`, `code_postal`, `arrondissement`, `code_insee`, `site_web`, `wikidata`, `osm_id`, `elements_fusionnes`, `lat`/`lon`. Géométrie : contour du bâtiment (polygone) quand il existe, sinon point.

**rues_et_eglises_paris.geojson** — les deux réunis, distingués par `categorie` (`rue` ou `eglise`).

## F. Refaire l'extraction complète (ordinateur)

```bash
python3 osm_paris.py --dossier donnees            # rues par arrondissement, églises en une requête
python3 osm_paris.py --par-arrondissement         # tout par arrondissement (serveur saturé)
```
Python 3.8+, aucune installation. Sur GitHub : onglet **Actions** → **Extraction OSM Paris** → **Run workflow**.

Méthode de secours si Overpass est indisponible : télécharger l'extrait **Île-de-France** de Geofabrik (https://download.geofabrik.de/europe/france/ile-de-france.html), puis dans **QGIS** : extension **QuickOSM** → onglet **Fichier OSM**, ou découper avec `osmium extract` sur la limite de Paris.
