#!/usr/bin/env python3
"""
Extraction des rues et des églises de Paris depuis OpenStreetMap (API Overpass) → GeoJSON (RFC 7946, WGS84 / EPSG:4326).

    python3 osm_paris.py                 # extraction complète (Paris en une requête, repli par arrondissement)
    python3 osm_paris.py --par-arrondissement
    python3 osm_paris.py --dossier sortie

Produit : rues_paris.geojson, eglises_paris.geojson, rues_et_eglises_paris.geojson, rapport_extraction.md
Aucune dépendance : Python 3.8+ (bibliothèque standard uniquement).
Données © les contributeurs d'OpenStreetMap, licence ODbL 1.0 — https://www.openstreetmap.org/copyright
"""
import argparse, json, math, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter",
             "https://overpass.private.coffee/api/interpreter"]
PARIS_AREA = 3600007444            # relation OSM 7444 « Paris » (limite administrative officielle) + 3 600 000 000
BBOX = (48.80, 2.22, 48.91, 2.47)  # emprise de contrôle (sud, ouest, nord, est)
ATTRIBUTION = "© les contributeurs d'OpenStreetMap — https://www.openstreetmap.org/copyright"
LICENCE = "ODbL 1.0 (Open Database License)"

# Voies retenues : toutes les voies nommées (highway=*) sauf éléments non routiers.
EXCLUS = {"proposed", "construction", "platform", "bus_stop", "elevator", "corridor", "raceway", "abandoned", "razed", "no"}
TYPES_VOIE = {
    "motorway": "autoroute / boulevard périphérique", "motorway_link": "bretelle d'autoroute", "trunk": "voie rapide", "trunk_link": "bretelle de voie rapide",
    "primary": "voie principale", "primary_link": "bretelle principale", "secondary": "voie secondaire", "secondary_link": "bretelle secondaire",
    "tertiary": "voie tertiaire", "tertiary_link": "bretelle tertiaire", "residential": "rue résidentielle", "unclassified": "voie non classée",
    "living_street": "zone de rencontre", "pedestrian": "voie piétonne", "service": "voie de desserte", "road": "voie (type inconnu)",
    "footway": "chemin piéton", "path": "sentier", "steps": "escalier", "cycleway": "piste cyclable", "track": "chemin", "busway": "voie de bus",
    "bridleway": "allée cavalière"}

Q_ARR = "[out:json][timeout:180];rel[\"boundary\"=\"administrative\"][\"admin_level\"=\"9\"][\"ref:INSEE\"~\"^751\"](48.80,2.22,48.91,2.47);out geom;"
SEL_RUES = 'way["highway"]["name"]'
SEL_EGL = ['nwr["amenity"="place_of_worship"]["religion"="christian"]',
           'nwr["building"~"^(church|cathedral|chapel|basilica)$"]']

def requete_rues(area): return f"[out:json][timeout:180][maxsize:1073741824];area(id:{area})->.a;{SEL_RUES}(area.a);out tags geom;"
def requete_eglises(area): return f"[out:json][timeout:300];area(id:{area})->.a;(" + "".join(s + "(area.a);" for s in SEL_EGL) + ");out tags geom;"

def log(*a): print(*a, flush=True)

def overpass(q, essais=4, delai=240):
    """Envoie une requête Overpass, avec plusieurs serveurs et tentatives (attente croissante)."""
    derniere = None
    for t in range(essais):
        for url in ENDPOINTS:
            try:
                data = urllib.parse.urlencode({"data": q}).encode()
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "extraction-paris-osm/1.0 (usage personnel)"})
                with urllib.request.urlopen(req, timeout=delai) as r:
                    j = json.loads(r.read().decode("utf-8"))
                if "remark" in j and "runtime error" in j["remark"]:
                    raise RuntimeError(j["remark"][:200])
                return j.get("elements", [])
            except Exception as e:
                derniere = e; log(f"::warning::Overpass {url} : {str(e)[:200]}")
        time.sleep(45 * (t + 1))                      # serveurs saturés : on laisse du temps
    raise RuntimeError(f"Overpass indisponible : {derniere}")

# ---------- Source alternative : extrait Geofabrik + osmium (sans Overpass) ----------
GEOFABRIK = "https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf"

def sh(*cmd):
    import subprocess
    log("    $ " + " ".join(cmd)); subprocess.run(cmd, check=True)

def charger_geofabrik(dossier):
    """Télécharge l'extrait Île-de-France, le découpe sur la limite officielle de Paris (relation 7444) et
    renvoie (arrondissements, éléments rues, éléments églises) au même format que l'API Overpass."""
    import shutil
    if not shutil.which("osmium"): raise RuntimeError("osmium-tool est requis pour --source geofabrik")
    w = os.path.join(dossier, "_travail"); os.makedirs(w, exist_ok=True)
    pbf = os.path.join(w, "idf.osm.pbf")
    if not os.path.exists(pbf):
        log("    téléchargement de l'extrait Geofabrik Île-de-France…")
        urllib.request.urlretrieve(GEOFABRIK, pbf)
    sh("osmium", "getid", "-r", "-O", pbf, "r7444", "-o", os.path.join(w, "limite.osm.pbf"))
    sh("osmium", "export", "-O", os.path.join(w, "limite.osm.pbf"), "-o", os.path.join(w, "limite.geojson"), "--geometry-types=polygon")
    sh("osmium", "extract", "-O", "-s", "smart", "-p", os.path.join(w, "limite.geojson"), pbf, "-o", os.path.join(w, "paris.osm.pbf"))
    sh("osmium", "tags-filter", "-O", os.path.join(w, "paris.osm.pbf"), "w/highway", "nwr/amenity=place_of_worship",
       "nwr/building=church,cathedral,chapel,basilica", "r/admin_level=9", "-o", os.path.join(w, "filtre.osm.pbf"))
    sh("osmium", "export", "-O", "-a", "type,id", "-f", "geojsonseq", os.path.join(w, "filtre.osm.pbf"), "-o", os.path.join(w, "filtre.geojsonseq"))
    ll = lambda c: {"lon": c[0], "lat": c[1]}
    arrs, rues_e, egl_e = [], [], []
    with open(os.path.join(w, "filtre.geojsonseq"), encoding="utf-8") as f:
        for ligne in f:
            ligne = ligne.strip().lstrip("\x1e")
            if not ligne: continue
            ft = json.loads(ligne); pr = ft["properties"]; g = ft["geometry"]
            typ, oid = pr.pop("@type"), int(pr.pop("@id")); tags = pr
            if tags.get("admin_level") == "9" and str(tags.get("ref:INSEE", "")).startswith("751") and g["type"] in ("Polygon", "MultiPolygon"):
                polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
                arrs.append({"n": int(tags["ref:INSEE"][3:]), "insee": tags["ref:INSEE"], "osm_id": oid, "anneaux": [[[round(x, 7), round(y, 7)] for x, y in p[0]] for p in polys]})
                continue
            egl = (tags.get("amenity") == "place_of_worship" and tags.get("religion") == "christian") or tags.get("building") in ("church", "cathedral", "chapel", "basilica")
            if g["type"] == "Point": e = {"type": "node", "id": oid, "lat": g["coordinates"][1], "lon": g["coordinates"][0], "tags": tags}
            elif g["type"] == "LineString": e = {"type": "way", "id": oid, "tags": tags, "geometry": [ll(c) for c in g["coordinates"]]}
            else:
                polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
                if typ == "way": e = {"type": "way", "id": oid, "tags": tags, "geometry": [ll(c) for c in polys[0][0]]}
                else: e = {"type": "relation", "id": oid, "tags": tags, "members": [{"type": "way", "role": "outer" if i == 0 else "inner", "geometry": [ll(c) for c in r]} for p in polys for i, r in enumerate(p)]}
            if tags.get("highway") and tags.get("name") and e["type"] == "way": rues_e.append(e)
            if egl: egl_e.append(e)
    shutil.rmtree(w, ignore_errors=True)
    if len(arrs) < 20: raise RuntimeError(f"contours d'arrondissements incomplets dans l'extrait ({len(arrs)}/20)")
    arrs.sort(key=lambda a: a["n"])
    return arrs, rues_e, egl_e

# ---------- Géométrie ----------
def pt(g): return [round(g["lon"], 7), round(g["lat"], 7)]

def dans(lon, lat, anneaux):
    """Point dans polygone (lancer de rayon sur tous les segments des contours extérieurs)."""
    c = False
    for a in anneaux:
        for i in range(len(a) - 1):
            (x1, y1), (x2, y2) = a[i], a[i + 1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                c = not c
    return c

def assembler(morceaux):
    """Assemble des segments de chemins (listes de [lon,lat]) en anneaux fermés."""
    reste = [m[:] for m in morceaux if len(m) >= 2]
    anneaux = []
    while reste:
        a = reste.pop(0)
        progres = True
        while a[0] != a[-1] and progres:
            progres = False
            for i, m in enumerate(reste):
                if m[0] == a[-1]: a += m[1:]
                elif m[-1] == a[-1]: a += m[::-1][1:]
                elif m[-1] == a[0]: a = m[:-1] + a
                elif m[0] == a[0]: a = m[::-1][:-1] + a
                else: continue
                reste.pop(i); progres = True; break
        if a[0] == a[-1] and len(a) >= 4: anneaux.append(a)
    return anneaux

def aire_signee(a): return sum(a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1] for i in range(len(a) - 1)) / 2

def orienter(a, exterieur):
    """RFC 7946 : anneaux extérieurs dans le sens antihoraire, intérieurs dans le sens horaire."""
    return a if (aire_signee(a) > 0) == exterieur else a[::-1]

def centre(coords):
    xs = [c[0] for c in coords]; ys = [c[1] for c in coords]
    return [round(sum(xs) / len(xs), 7), round(sum(ys) / len(ys), 7)]

def arrondissements():
    els = overpass(Q_ARR)
    out = []
    for e in els:
        if e.get("type") != "relation": continue
        ref = e.get("tags", {}).get("ref:INSEE", "")
        ext = [[pt(g) for g in m["geometry"]] for m in e.get("members", []) if m.get("type") == "way" and m.get("role") != "inner" and m.get("geometry")]
        out.append({"n": int(ref[3:]), "insee": ref, "osm_id": e["id"], "anneaux": ext})
    out = [a for a in out if a["anneaux"]]
    if len(out) < 20: raise RuntimeError(f"contours d'arrondissements incomplets ({len(out)}/20)")
    out.sort(key=lambda a: a["n"])
    return out

def trouver_arr(lon, lat, arrs):
    for a in arrs:
        if dans(lon, lat, a["anneaux"]): return a
    return None

# ---------- Rues ----------
def rues(elements, arrs):
    vus, feats = set(), []
    for e in elements:
        if e.get("type") != "way" or ("way", e["id"]) in vus: continue
        t = e.get("tags", {}); hw = t.get("highway")
        if not t.get("name") or hw in EXCLUS or not e.get("geometry"): continue
        vus.add(("way", e["id"]))
        coords = [pt(g) for g in e["geometry"] if g]
        if len(coords) < 2: continue
        aire = t.get("area") == "yes" and coords[0] == coords[-1] and len(coords) >= 4
        geom = {"type": "Polygon", "coordinates": [orienter(coords, True)]} if aire else {"type": "LineString", "coordinates": coords}
        mid = centre(coords[:-1]) if aire else coords[len(coords) // 2]
        traverses = sorted({a["n"] for c in (coords[0], mid, coords[-1]) for a in [trouver_arr(c[0], c[1], arrs)] if a})
        if arrs and not traverses: continue              # entièrement hors de Paris (repli par emprise rectangulaire)
        a = trouver_arr(mid[0], mid[1], arrs)
        feats.append({"type": "Feature", "id": f"way/{e['id']}", "geometry": geom, "properties": {
            "categorie": "rue", "osm_id": f"way/{e['id']}", "osm_type": "way", "osm_ref": e["id"],
            "nom": t["name"], "autres_noms": "; ".join(v for k, v in t.items() if k in ("alt_name", "old_name", "official_name", "loc_name") and v) or None,
            "type_voie": hw, "type_voie_fr": TYPES_VOIE.get(hw, hw),
            "arrondissement": a["n"] if a else None, "code_insee": a["insee"] if a else None,
            "arrondissements_traverses": ",".join(map(str, traverses)) or None,
            "sens_unique": t.get("oneway"), "revetement": t.get("surface"), "ref_voie": t.get("ref"),
            "longueur_m": round(longueur(coords)), "lat": mid[1], "lon": mid[0]}})
    feats.sort(key=lambda f: (f["properties"]["nom"], f["properties"]["osm_ref"]))
    return feats

def longueur(c):
    R = 6371008.8; s = 0
    for (x1, y1), (x2, y2) in zip(c, c[1:]):
        p1, p2 = math.radians(y1), math.radians(y2)
        h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(x2 - x1) / 2) ** 2
        s += 2 * R * math.asin(math.sqrt(h))
    return s

# ---------- Églises ----------
def geom_eglise(e):
    if e["type"] == "node": return {"type": "Point", "coordinates": [round(e["lon"], 7), round(e["lat"], 7)]}
    if e["type"] == "way":
        c = [pt(g) for g in e.get("geometry", []) if g]
        if len(c) >= 4 and c[0] == c[-1]: return {"type": "Polygon", "coordinates": [orienter(c, True)]}
        return {"type": "LineString", "coordinates": c} if len(c) >= 2 else None
    if e["type"] == "relation":
        mem = [m for m in e.get("members", []) if m.get("type") == "way" and m.get("geometry")]
        ext = assembler([[pt(g) for g in m["geometry"] if g] for m in mem if m.get("role") != "inner"])
        inn = assembler([[pt(g) for g in m["geometry"] if g] for m in mem if m.get("role") == "inner"])
        if not ext: return None
        polys = []
        for x in ext:
            trous = [orienter(i, False) for i in inn if dans(i[0][0], i[0][1], [x])]
            polys.append([orienter(x, True)] + trous)
        return {"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1 else {"type": "MultiPolygon", "coordinates": polys}
    return None

def tous_points(g):
    t = g["type"]; c = g["coordinates"]
    if t == "Point": return [c]
    if t == "LineString": return c
    if t == "Polygon": return c[0]
    return [p for poly in c for p in poly[0]]

def adresse(t):
    rue = " ".join(x for x in (t.get("addr:housenumber"), t.get("addr:street")) if x)
    return ", ".join(x for x in (rue, " ".join(x for x in (t.get("addr:postcode"), t.get("addr:city")) if x)) if x) or None

def eglises(elements, arrs):
    vus, feats = set(), []
    for e in elements:
        k = (e["type"], e["id"])
        if k in vus: continue
        vus.add(k)
        t = e.get("tags", {})
        if t.get("amenity") == "place_of_worship" and t.get("religion") not in (None, "christian"): continue
        g = geom_eglise(e)
        if not g: continue
        c = centre(tous_points(g)) if g["type"] != "Point" else g["coordinates"]
        a = trouver_arr(c[0], c[1], arrs)
        if arrs and not a: continue                      # hors des limites de Paris (élément à cheval sur la limite)
        feats.append({"type": "Feature", "id": f"{e['type']}/{e['id']}", "geometry": g, "properties": {
            "categorie": "eglise", "osm_id": f"{e['type']}/{e['id']}", "osm_type": e["type"], "osm_ref": e["id"],
            "nom": t.get("name"), "autres_noms": "; ".join(v for kk, v in t.items() if kk in ("alt_name", "official_name", "old_name") and v) or None,
            "denomination": t.get("denomination"), "religion": t.get("religion"),
            "lieu_de_culte": t.get("amenity") == "place_of_worship", "batiment": t.get("building"),
            "adresse": adresse(t), "code_postal": t.get("addr:postcode"),
            "arrondissement": a["n"] if a else None, "code_insee": a["insee"] if a else None,
            "site_web": t.get("website") or t.get("contact:website"), "wikidata": t.get("wikidata"),
            "elements_fusionnes": None, "lat": c[1], "lon": c[0]}})
    # Fusion : un bâtiment (sans « lieu de culte ») qui contient un point « lieu de culte » décrit la même église.
    pts = [f for f in feats if f["geometry"]["type"] == "Point" and f["properties"]["lieu_de_culte"]]
    retires = set()
    for f in feats:
        p = f["properties"]
        if f["geometry"]["type"] not in ("Polygon", "MultiPolygon"): continue
        anneaux = [f["geometry"]["coordinates"][0]] if f["geometry"]["type"] == "Polygon" else [poly[0] for poly in f["geometry"]["coordinates"]]
        for q in pts:
            if q["id"] in retires: continue
            if dans(q["properties"]["lon"], q["properties"]["lat"], anneaux):
                qp = q["properties"]
                if p["lieu_de_culte"] and qp["nom"] and p["nom"] and qp["nom"] != p["nom"]: continue   # deux lieux distincts
                for champ in ("nom", "denomination", "religion", "adresse", "code_postal", "site_web", "wikidata", "autres_noms"):
                    if not p.get(champ) and qp.get(champ): p[champ] = qp[champ]
                p["lieu_de_culte"] = True
                p["elements_fusionnes"] = ", ".join(x for x in (p["elements_fusionnes"], qp["osm_id"]) if x)
                retires.add(q["id"])
    feats = [f for f in feats if f["id"] not in retires]
    # Bâtiments « église » sans nom ni lieu de culte et sans dénomination : souvent des chapelles privées ou d'anciens édifices ; conservés mais signalés.
    feats.sort(key=lambda f: ((f["properties"]["nom"] or "~"), f["properties"]["osm_ref"]))
    return feats, len(retires)

# ---------- Fichiers ----------
def collection(feats, nom, date):
    return {"type": "FeatureCollection", "name": nom,
            "metadata": {"source": "OpenStreetMap via l'API Overpass", "attribution": ATTRIBUTION, "licence": LICENCE,
                         "date_extraction_utc": date, "systeme_coordonnees": "WGS84 (EPSG:4326), ordre longitude, latitude (RFC 7946)",
                         "perimetre": "Commune de Paris — relation OSM 7444 (limite administrative officielle)", "nombre": len(feats)},
            "features": feats}

def ecrire(path, obj):
    with open(path, "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def verifier(fc):
    """Contrôles : structure GeoJSON, types de géométrie, coordonnées dans l'emprise de Paris, anneaux fermés, identifiants uniques."""
    err = []; ids = set(); s, o, n, e = BBOX
    def coords_ok(c):
        return isinstance(c, list) and len(c) == 2 and all(isinstance(v, (int, float)) for v in c) and o <= c[0] <= e and s <= c[1] <= n
    for f in fc["features"]:
        if f.get("type") != "Feature" or "properties" not in f: err.append(f"{f.get('id')} : Feature invalide"); continue
        if f["id"] in ids: err.append(f"{f['id']} : doublon")
        ids.add(f["id"]); g = f["geometry"]; t = g["type"]
        if t == "Point": pts = [g["coordinates"]]
        elif t == "LineString": pts = g["coordinates"]; err += [f"{f['id']} : ligne trop courte"] if len(pts) < 2 else []
        elif t in ("Polygon", "MultiPolygon"):
            polys = [g["coordinates"]] if t == "Polygon" else g["coordinates"]; pts = []
            for poly in polys:
                for r in poly:
                    if len(r) < 4 or r[0] != r[-1]: err.append(f"{f['id']} : anneau non fermé")
                    pts += r
        else: err.append(f"{f['id']} : type {t}"); continue
        if not all(coords_ok(c) for c in pts): err.append(f"{f['id']} : coordonnées hors de Paris ou invalides")
    return err

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dossier", default=".")
    ap.add_argument("--par-arrondissement", action="store_true", help="interroge chaque arrondissement séparément (rues et églises)")
    ap.add_argument("--source", choices=["overpass", "geofabrik"], default="overpass", help="geofabrik : extrait Île-de-France + osmium, sans Overpass")
    ap.add_argument("--rues-en-une-requete", action="store_true", help="tente d'abord Paris en une seule requête pour les rues (lourd)")
    o = ap.parse_args(); os.makedirs(o.dossier, exist_ok=True)
    date = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    if o.source == "geofabrik":
        log("1-3/4 Extrait Geofabrik Île-de-France (osmium)…")
        arrs, er, ee = charger_geofabrik(o.dossier)
        mode_r = mode_e = "extrait Geofabrik Île-de-France découpé sur la limite de Paris (osmium)"
        return finir(o, date, arrs, er, ee, mode_r, mode_e)
    log("1/4 Limites des 20 arrondissements…")
    arrs = arrondissements()
    log(f"    {len(arrs)} arrondissements")
    if len(arrs) != 20: log("    ! nombre d'arrondissements inattendu : le rattachement sera incomplet")

    def extraire(nom, fabrique, unique=True):
        if unique and not o.par_arrondissement:
            try:
                els = overpass(fabrique(PARIS_AREA)); log(f"    {len(els)} éléments (Paris en une requête)"); return els, "Paris en une requête"
            except Exception as ex: log(f"    ! requête unique refusée ({str(ex)[:120]}) : repli par arrondissement")
        els = []
        for a in arrs:
            try: part = overpass(fabrique(3600000000 + a["osm_id"]), essais=2)
            except Exception:
                # dernier recours : emprise rectangulaire de l'arrondissement, filtrée ensuite par le polygone
                xs = [c[0] for r in a["anneaux"] for c in r]; ys = [c[1] for r in a["anneaux"] for c in r]
                bb = f"({min(ys)},{min(xs)},{max(ys)},{max(xs)})"
                part = overpass(fabrique(PARIS_AREA).replace("area(id:%d)->.a;" % PARIS_AREA, "").replace("(area.a)", bb), essais=4)
            els += part
            log(f"    {a['n']:>2}e : {len(part)} éléments"); time.sleep(5)
        return els, "par arrondissement (20 requêtes, doublons supprimés)"

    log("2/4 Rues…"); er, mode_r = extraire("rues", requete_rues, unique=o.rues_en_une_requete)
    log("3/4 Églises…"); ee, mode_e = extraire("eglises", requete_eglises)
    return finir(o, date, arrs, er, ee, mode_r, mode_e)

def finir(o, date, arrs, er, ee, mode_r, mode_e):
    R = rues(er, arrs); E, fusions = eglises(ee, arrs)

    log("4/4 Écriture et vérification…")
    fr, fe = collection(R, "rues_paris", date), collection(E, "eglises_paris", date)
    fa = collection(R + E, "rues_et_eglises_paris", date)
    ecrire(os.path.join(o.dossier, "rues_paris.geojson"), fr)
    ecrire(os.path.join(o.dossier, "eglises_paris.geojson"), fe)
    ecrire(os.path.join(o.dossier, "rues_et_eglises_paris.geojson"), fa)
    erreurs = verifier(fr) + verifier(fe)

    # Rapport
    from collections import Counter
    rp = [f["properties"] for f in R]; ep = [f["properties"] for f in E]
    noms = {(p["nom"]) for p in rp}
    ct = Counter(p["type_voie"] for p in rp); cd = Counter(p["denomination"] or "non renseignée" for p in ep)
    ca = Counter(p["arrondissement"] for p in rp)
    taille = lambda f: os.path.getsize(os.path.join(o.dossier, f)) / 1e6
    L = [f"# Rapport d'extraction — rues et églises de Paris (OpenStreetMap)", "",
         f"- Date d'extraction (UTC) : **{date}**", f"- Source : OpenStreetMap — {ATTRIBUTION}", f"- Licence : {LICENCE}",
         "- Périmètre : relation OSM 7444 « Paris » ; arrondissements : relations `admin_level=9` (`ref:INSEE` 75101 à 75120)",
         f"- Mode d'extraction : rues — {mode_r} ; églises — {mode_e}", "- Système de coordonnées : WGS84 (EPSG:4326), RFC 7946", "",
         "## Résultats", "", "| Fichier | Objets | Taille |", "| --- | --- | --- |",
         f"| rues_paris.geojson | {len(R)} tronçons de voies ({len(noms)} noms distincts) | {taille('rues_paris.geojson'):.1f} Mo |",
         f"| eglises_paris.geojson | {len(E)} églises et chapelles | {taille('eglises_paris.geojson'):.2f} Mo |",
         f"| rues_et_eglises_paris.geojson | {len(R) + len(E)} | {taille('rues_et_eglises_paris.geojson'):.1f} Mo |", "",
         f"Validation : **{'aucune erreur' if not erreurs else str(len(erreurs)) + ' erreur(s)'}** (structure GeoJSON, géométries, anneaux fermés, coordonnées dans l'emprise de Paris, identifiants uniques).", "",
         "## Rues par type de voie", "", "| Type (`highway`) | Libellé | Tronçons |", "| --- | --- | --- |"]
    L += [f"| {k} | {TYPES_VOIE.get(k, k)} | {v} |" for k, v in ct.most_common()]
    L += ["", "## Rues par arrondissement (milieu du tronçon)", "", "| Arrondissement | Tronçons |", "| --- | --- |"]
    L += [f"| {k if k else 'non déterminé'} | {ca[k]} |" for k in sorted(ca, key=lambda x: (x is None, x or 0))]
    L += ["", "## Églises par dénomination", "", "| Dénomination | Nombre |", "| --- | --- |"] + [f"| {k} | {v} |" for k, v in cd.most_common()]
    L += ["", "## Données manquantes ou incomplètes", "",
          f"- Églises sans nom : {sum(1 for p in ep if not p['nom'])}",
          f"- Églises sans adresse : {sum(1 for p in ep if not p['adresse'])} (l'adresse est rarement saisie sur les lieux de culte dans OSM)",
          f"- Églises sans dénomination : {sum(1 for p in ep if not p['denomination'])}",
          f"- Églises représentées par un simple point (sans contour de bâtiment) : {sum(1 for f in E if f['geometry']['type'] == 'Point')}",
          f"- Bâtiments « église » sans balise lieu de culte (anciens édifices, chapelles privées, etc.) : {sum(1 for p in ep if not p['lieu_de_culte'])}",
          f"- Points « lieu de culte » fusionnés avec le bâtiment qui les contient : {fusions}",
          f"- Tronçons de rue sans arrondissement déterminé : {ca.get(None, 0)}",
          "- Les voies **sans nom** (bretelles, allées anonymes…) ne sont pas incluses, conformément à la demande (« noms des rues »).",
          "- Une rue est découpée en plusieurs tronçons OSM (un objet par tronçon, avec son identifiant) : compter les **noms distincts** pour le nombre de rues.",
          "- L'arrondissement d'un tronçon est celui de son point médian ; `arrondissements_traverses` liste ceux de ses extrémités et de son milieu.", ""]
    if erreurs: L += ["## Erreurs détectées", ""] + [f"- {x}" for x in erreurs[:200]]
    with open(os.path.join(o.dossier, "rapport_extraction.md"), "w", encoding="utf-8") as f: f.write("\n".join(L) + "\n")
    log(f"Terminé : {len(R)} tronçons ({len(noms)} noms), {len(E)} églises, {len(erreurs)} erreur(s).")
    if erreurs: sys.exit(1)

if __name__ == "__main__":
    try: main()
    except Exception as ex:
        print(f"::error::{type(ex).__name__}: {str(ex)[:500]}"); raise
