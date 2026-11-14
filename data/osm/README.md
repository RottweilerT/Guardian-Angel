# Données OpenStreetMap utilisées par l'application

Fichiers téléchargés le 14/11/2026 (extraction du 2026-11-14T01:20 UTC), issus de l'extrait Geofabrik Île-de-France découpé sur la limite officielle de Paris (relation OSM 7444). Voir `rapport_extraction.md`.

- `eglises_paris.geojson` : 368 églises et chapelles chrétiennes ; l'application en retire 10 (Témoins de Jéhovah, mormons, Communauté des chrétiens, catholiques libéraux, mariavites) et les convertit en `public/data/churches.json`.
- `rues_paris.geojson` : 29 084 tronçons de voies nommées. L'application en tire `public/data/rues.json`, un index de 7 177 noms qui sert à la recherche « églises près d'une rue ».
- `complements.json` : l'accessibilité, les horaires bruts et le rattachement de l'extraction Overpass du 12/11, qui ne figurent pas dans l'extrait.

La conversion se fait avec `node scripts/build-osm-data.mjs`, lancé automatiquement à chaque déploiement.

Pour mettre à jour : relancer le workflow « Extraction OSM Paris » sur la branche `donnees-osm-paris`, copier ses fichiers `donnees/eglises_paris.geojson` et `donnees/rues_paris.geojson` ici, puis pousser sur `main`.

Données © les contributeurs d'OpenStreetMap (https://www.openstreetmap.org/copyright), licence ODbL 1.0. Les fichiers dérivés publiés par l'application sont diffusés sous la même licence.
