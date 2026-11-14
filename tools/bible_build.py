"""Convertit les textes bibliques ouverts en fichiers JSON par livre pour Guardian Angel.
Usage : python3 -I bible_build.py <dossier_sources> <dossier_sortie>"""
import json, os, re, sys, html
SRC, OUT = sys.argv[1], sys.argv[2]
ORDRE = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH TOB JDT EST 1MA 2MA JOB PSA PRO ECC SNG WIS SIR "
         "ISA JER LAM BAR EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL "
         "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()
NT = set(ORDRE[ORDRE.index("MAT"):])
DEUTERO = {"TOB", "JDT", "1MA", "2MA", "WIS", "SIR", "BAR"}
sp = lambda t: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", t))).replace(" ,", ",").strip()

def usfx(path):
    s = open(path, encoding="utf-8").read()
    for tag in ("id", "h", "toc", "cl", "f", "x", "fe", "rem", "d", "s"):
        if tag == "h": continue
        s = re.sub(rf"<{tag}\b[^>]*?/>|<{tag}\b[^>]*>.*?</{tag}>", " ", s, flags=re.S)
    s = re.sub(r'<p sfm="m[st]\d?"[^>]*>.*?</p>', " ", s, flags=re.S)
    livres = {}
    for m in re.finditer(r'<book id="([0-9A-Z]{3})">(.*?)</book>', s, flags=re.S):
        code, corps = m.group(1), m.group(2)
        hm = re.search(r"<h>(.*?)</h>", corps, flags=re.S); nom = sp(hm.group(1)) if hm else code
        corps = re.sub(r"<h>.*?</h>", " ", corps, flags=re.S)
        chap, ch = {}, None
        for tok in re.split(r'(<c id="[^"]+"\s*/>|<v id="[^"]+"[^>]*/>|<ve\s*/>)', corps):
            mc = re.match(r'<c id="(\d+)"', tok); mv = re.match(r'<v id="([^"]+)"', tok)
            if mc: ch = int(mc.group(1)); chap.setdefault(ch, []); cur = None
            elif mv and ch is not None: cur = [mv.group(1), ""]; chap[ch].append(cur)
            elif tok.startswith("<ve"): cur = None
            elif ch is not None and cur is not None: cur[1] += tok
        livres[code] = (nom, {c: [[v, sp(t)] for v, t in vs if sp(t)] for c, vs in chap.items()})
    return livres

def fillion(path, meta):
    data = json.load(open(path, encoding="utf-8")); m = json.load(open(meta, encoding="utf-8")); livres = {}
    ALIAS = {"EX0": "EXO", "JB": "JOB", "OAB": "OBA", "1TM": "1TI", "2TM": "2TI"}  # coquilles du fichier source
    for r in data:
        nom = m.get(r["book"], {}).get("fr_name") or m.get(ALIAS.get(r["book"], ""), {}).get("fr_name") or r["book"]
        r["book"] = ALIAS.get(r["book"], r["book"])
        livres.setdefault(r["book"], (nom, {}))[1].setdefault(int(r["chapter"]), []).append([str(r["verse"]), sp(r["text"])])
    return livres

VERSIONS = [
  ("fr", "Bible Fillion (1904)", "français", "catholique", "Domaine public — édition numérique CC0 (github.com/janvier-s/bible-fillion)",
   lambda: fillion(f"{SRC}/janvier-s_bible-fillion/formats/json-flat/fillion-array-of-objects.json", f"{SRC}/janvier-s_bible-fillion/metadata/books.json")),
  ("en", "Douay-Rheims (1899, American Edition)", "English", "catholique", "Domaine public — via github.com/seven1m/open-bibles (eBible.org)",
   lambda: usfx(f"{SRC}/open-bibles/eng-dra.usfx.xml")),
  ("es", "Reina-Valera (1909)", "español", "protestante (66 livres, sans les deutérocanoniques)", "Domaine public — via github.com/seven1m/open-bibles (eBible.org)",
   lambda: usfx(f"{SRC}/open-bibles/spa-rv1909.usfx.xml")),
  ("la", "Vulgata Clementina", "latine", "catholique", "Domaine public — via github.com/seven1m/open-bibles",
   lambda: usfx(f"{SRC}/open-bibles/lat-clementine.usfx.xml")),
]
index = {"versions": [], "ordre": ORDRE, "nt": sorted(NT), "deutero": sorted(DEUTERO)}
for code, titre, langue, tradition, licence, charger in VERSIONS:
    livres = charger(); os.makedirs(f"{OUT}/{code}", exist_ok=True); liste = []; nv = 0
    inconnus = [b for b in livres if b not in ORDRE]
    if inconnus: print(f"::warning::{code} : livres ignorés {inconnus}")
    for b in ORDRE:
        if b not in livres: continue
        nom, chap = livres[b]
        chs = [chap.get(c, []) for c in range(1, max(chap) + 1)] if chap else []
        nv += sum(len(c) for c in chs)
        json.dump(chs, open(f"{OUT}/{code}/{b}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        liste.append([b, nom, len(chs)])
    index["versions"].append({"code": code, "titre": titre, "langue": langue, "tradition": tradition, "licence": licence, "livres": liste, "versets": nv})
    print(f"{code}: {len(liste)} livres, {nv} versets")
meta_fr = json.load(open(f"{SRC}/janvier-s_bible-fillion/metadata/books.json", encoding="utf-8"))
index["abbr_fr"] = {v["fr_abbr"]: k for k, v in meta_fr.items() if k in ORDRE}
index["abbr_fr"].update({"Ne": "NEH", "He": "HEB", "Jos": "JOS", "Lam": "LAM", "Sir": "SIR", "Qo": "ECC", "Mc": "MRK", "Jean": "JHN", "Ps": "PSA", "Sa": "WIS", "Za": "ZEC", "So": "ZEP"})
json.dump(index, open(f"{OUT}/index.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
