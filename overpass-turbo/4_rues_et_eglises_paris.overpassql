/*
  Rues ET églises de Paris dans un seul export (très lourd sur téléphone : préférez les requêtes séparées).
  Données © les contributeurs d'OpenStreetMap, licence ODbL.
*/
[out:json][timeout:600][maxsize:1073741824];
area(id:3600007444)->.paris;
(
  way["highway"]["name"]["highway"!~"^(proposed|construction|platform|bus_stop|elevator|corridor|raceway|abandoned|razed|no)$"](area.paris);
  nwr["amenity"="place_of_worship"]["religion"="christian"](area.paris);
  nwr["building"~"^(church|cathedral|chapel|basilica)$"](area.paris);
);
out tags geom;
