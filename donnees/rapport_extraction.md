# Rapport d'extraction — rues et églises de Paris (OpenStreetMap)

- Date d'extraction (UTC) : **2026-11-14T01:15:09+00:00**
- Source : OpenStreetMap — © les contributeurs d'OpenStreetMap — https://www.openstreetmap.org/copyright
- Licence : ODbL 1.0 (Open Database License)
- Périmètre : relation OSM 7444 « Paris » ; arrondissements : relations `admin_level=9` (`ref:INSEE` 75101 à 75120)
- Mode d'extraction : rues — extrait Geofabrik Île-de-France découpé sur la limite de Paris (osmium) ; églises — extrait Geofabrik Île-de-France découpé sur la limite de Paris (osmium)
- Système de coordonnées : WGS84 (EPSG:4326), RFC 7946

## Résultats

| Fichier | Objets | Taille |
| --- | --- | --- |
| rues_paris.geojson | 1384 tronçons de voies (359 noms distincts) | 0.8 Mo |
| eglises_paris.geojson | 17 églises et chapelles | 0.03 Mo |
| rues_et_eglises_paris.geojson | 1401 | 0.8 Mo |

Validation : **aucune erreur** (structure GeoJSON, géométries, anneaux fermés, coordonnées dans l'emprise de Paris, identifiants uniques).

## Rues par type de voie

| Type (`highway`) | Libellé | Tronçons |
| --- | --- | --- |
| residential | rue résidentielle | 346 |
| cycleway | piste cyclable | 332 |
| footway | chemin piéton | 152 |
| service | voie de desserte | 139 |
| pedestrian | voie piétonne | 114 |
| primary | voie principale | 112 |
| tertiary | voie tertiaire | 93 |
| living_street | zone de rencontre | 42 |
| secondary | voie secondaire | 40 |
| steps | escalier | 6 |
| unclassified | voie non classée | 6 |
| busway | voie de bus | 1 |
| primary_link | bretelle principale | 1 |

## Rues par arrondissement (milieu du tronçon)

| Arrondissement | Tronçons |
| --- | --- |
| 3 | 11 |
| 4 | 3 |
| 10 | 10 |
| 11 | 1332 |
| 12 | 24 |
| 20 | 4 |

## Églises par dénomination

| Dénomination | Nombre |
| --- | --- |
| catholic | 7 |
| non renseignée | 6 |
| protestant | 2 |
| orthodox | 1 |
| lutheran | 1 |

## Données manquantes ou incomplètes

- Églises sans nom : 1
- Églises sans adresse : 11 (l'adresse est rarement saisie sur les lieux de culte dans OSM)
- Églises sans dénomination : 6
- Églises représentées par un simple point (sans contour de bâtiment) : 4
- Bâtiments « église » sans balise lieu de culte (anciens édifices, chapelles privées, etc.) : 1
- Points « lieu de culte » fusionnés avec le bâtiment qui les contient : 0
- Tronçons de rue sans arrondissement déterminé : 0
- Les voies **sans nom** (bretelles, allées anonymes…) ne sont pas incluses, conformément à la demande (« noms des rues »).
- Une rue est découpée en plusieurs tronçons OSM (un objet par tronçon, avec son identifiant) : compter les **noms distincts** pour le nombre de rues.
- L'arrondissement d'un tronçon est celui de son point médian ; `arrondissements_traverses` liste ceux de ses extrémités et de son milieu.

