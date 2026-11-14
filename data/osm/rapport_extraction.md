# Rapport d'extraction — rues et églises de Paris (OpenStreetMap)

- Date d'extraction (UTC) : **2026-11-14T01:20:26+00:00**
- Source : OpenStreetMap — © les contributeurs d'OpenStreetMap — https://www.openstreetmap.org/copyright
- Licence : ODbL 1.0 (Open Database License)
- Périmètre : relation OSM 7444 « Paris » ; arrondissements : relations `admin_level=9` (`ref:INSEE` 75101 à 75120)
- Mode d'extraction : rues — extrait Geofabrik Île-de-France découpé sur la limite de Paris (osmium) ; églises — extrait Geofabrik Île-de-France découpé sur la limite de Paris (osmium)
- Système de coordonnées : WGS84 (EPSG:4326), RFC 7946

## Résultats

| Fichier | Objets | Taille |
| --- | --- | --- |
| rues_paris.geojson | 29084 tronçons de voies (7177 noms distincts) | 17.2 Mo |
| eglises_paris.geojson | 368 églises et chapelles | 0.49 Mo |
| rues_et_eglises_paris.geojson | 29452 | 17.7 Mo |

Validation : **aucune erreur** (structure GeoJSON, géométries, anneaux fermés, coordonnées dans l'emprise de Paris, identifiants uniques).

## Rues par type de voie

| Type (`highway`) | Libellé | Tronçons |
| --- | --- | --- |
| residential | rue résidentielle | 7412 |
| cycleway | piste cyclable | 5049 |
| primary | voie principale | 2923 |
| footway | chemin piéton | 2788 |
| service | voie de desserte | 2467 |
| pedestrian | voie piétonne | 2377 |
| secondary | voie secondaire | 1866 |
| tertiary | voie tertiaire | 1662 |
| living_street | zone de rencontre | 679 |
| steps | escalier | 349 |
| trunk | voie rapide | 341 |
| path | sentier | 335 |
| unclassified | voie non classée | 330 |
| track | chemin | 209 |
| primary_link | bretelle principale | 116 |
| bridleway | allée cavalière | 50 |
| busway | voie de bus | 34 |
| motorway | autoroute / boulevard périphérique | 29 |
| trunk_link | bretelle de voie rapide | 28 |
| secondary_link | bretelle secondaire | 20 |
| tertiary_link | bretelle tertiaire | 17 |
| motorway_link | bretelle d'autoroute | 3 |

## Rues par arrondissement (milieu du tronçon)

| Arrondissement | Tronçons |
| --- | --- |
| 1 | 730 |
| 2 | 407 |
| 3 | 420 |
| 4 | 742 |
| 5 | 826 |
| 6 | 657 |
| 7 | 1038 |
| 8 | 1304 |
| 9 | 696 |
| 10 | 1107 |
| 11 | 1332 |
| 12 | 2887 |
| 13 | 2259 |
| 14 | 1871 |
| 15 | 2173 |
| 16 | 2851 |
| 17 | 1731 |
| 18 | 1821 |
| 19 | 2035 |
| 20 | 1951 |
| non déterminé | 246 |

## Églises par dénomination

| Dénomination | Nombre |
| --- | --- |
| catholic | 212 |
| non renseignée | 54 |
| protestant | 23 |
| orthodox | 11 |
| roman_catholic | 11 |
| lutheran | 9 |
| evangelical | 7 |
| baptist | 7 |
| jehovahs_witness | 6 |
| russian_orthodox | 3 |
| anglican | 3 |
| seventh_day_adventist | 3 |
| greek_catholic | 2 |
| reformed | 2 |
| presbyterian | 2 |
| greek_orthodox | 1 |
| armenian_apostolic | 1 |
| quaker | 1 |
| coptic_catholic | 1 |
| christian_community | 1 |
| maronite | 1 |
| liberal_catholic | 1 |
| mariavite | 1 |
| serbian_orthodox | 1 |
| latter_day_saints | 1 |
| romanian_orthodox | 1 |
| free_evangelical | 1 |
| methodist | 1 |

## Données manquantes ou incomplètes

- Églises sans nom : 30
- Églises sans adresse : 298 (l'adresse est rarement saisie sur les lieux de culte dans OSM)
- Églises sans dénomination : 54
- Églises représentées par un simple point (sans contour de bâtiment) : 66
- Bâtiments « église » sans balise lieu de culte (anciens édifices, chapelles privées, etc.) : 29
- Points « lieu de culte » fusionnés avec le bâtiment qui les contient : 2
- Tronçons de rue sans arrondissement déterminé : 246
- Les voies **sans nom** (bretelles, allées anonymes…) ne sont pas incluses, conformément à la demande (« noms des rues »).
- Une rue est découpée en plusieurs tronçons OSM (un objet par tronçon, avec son identifiant) : compter les **noms distincts** pour le nombre de rues.
- L'arrondissement d'un tronçon est celui de son point médian ; `arrondissements_traverses` liste ceux de ses extrémités et de son milieu.

