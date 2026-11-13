/*
  Églises de Paris — à coller dans https://overpass-turbo.eu puis « Exécuter » et « Exporter » > GeoJSON.
  Périmètre : limite administrative officielle de Paris (relation OSM 7444).
  Données © les contributeurs d'OpenStreetMap, licence ODbL.
*/
[out:json][timeout:180];
area(id:3600007444)->.paris;
(
  nwr["amenity"="place_of_worship"]["religion"="christian"](area.paris);
  nwr["building"~"^(church|cathedral|chapel|basilica)$"](area.paris);
);
out tags geom;
