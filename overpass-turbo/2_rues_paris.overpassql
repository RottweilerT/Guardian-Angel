/*
  Toutes les voies nommées de Paris (≈ 30 000 tronçons, ≈ 30 Mo) — lourd pour un téléphone.
  Si la page bloque, utilisez le fichier 3_rues_un_arrondissement.overpassql.
  Données © les contributeurs d'OpenStreetMap, licence ODbL.
*/
[out:json][timeout:600][maxsize:1073741824];
area(id:3600007444)->.paris;
way["highway"]["name"]["highway"!~"^(proposed|construction|platform|bus_stop|elevator|corridor|raceway|abandoned|razed|no)$"](area.paris);
out tags geom;
