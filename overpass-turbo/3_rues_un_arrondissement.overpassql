/*
  Voies nommées d'UN arrondissement : remplacez 75104 par le code INSEE voulu
  (75101 = 1er … 75120 = 20e). Recommencez pour chaque arrondissement si besoin.
  Données © les contributeurs d'OpenStreetMap, licence ODbL.
*/
[out:json][timeout:300];
rel["boundary"="administrative"]["admin_level"="9"]["ref:INSEE"="75104"];
map_to_area->.arr;
way["highway"]["name"]["highway"!~"^(proposed|construction|platform|bus_stop|elevator|corridor|raceway|abandoned|razed|no)$"](area.arr);
out tags geom;
