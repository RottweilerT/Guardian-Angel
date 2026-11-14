"""Convertit les textes bibliques ouverts en fichiers JSON par livre pour Guardian Angel.
Usage : python3 -I bible_build.py <dossier_sources> <dossier_sortie>"""
import json, os, re, sys, html, collections
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

OSIS = dict(zip("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Tob Jdt Esth 1Macc 2Macc Job Ps Prov Eccl Song Wis Sir Isa Jer Lam Bar Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(), ORDRE))

def sqlite_sword(path):
    import sqlite3
    c = sqlite3.connect(path); livres = {}
    noms = {i: (o, n) for i, o, n in c.execute("select book_id, osis, name from books")}
    for bid, ch, v, t in c.execute("select book_id, chapter, verse, text from verses order by book_id, chapter, verse"):
        o, n = noms[bid]; t = sp(t or "")
        # coquilles d'OCR sûres : « á » et « ó » isolés lus comme 4 et 0
        t = re.sub(r"(?<!\S)[¿¡]?4(?=\s)", "á", t); t = re.sub(r"(?<!\S)[¿¡]?0(?=\s)", "ó", t)
        t = nettoyer_es(t)
        if o in OSIS and t: livres.setdefault(OSIS[o], (n, {}))[1].setdefault(int(ch), []).append([str(v), t])
    return livres

def nettoyer_es(t):
    """Corrections automatiques sûres des artefacts d'OCR (aucun mot n'est inventé)."""
    t = re.sub(r"(\w)\|\s+(?=[a-zñáéíóú])", r"\1", t)        # césure marquée par « | » : herma| nos → hermanos
    t = re.sub(r"\s*\(?\|[!.]?\)?", "", t)                      # barres verticales isolées
    t = re.sub(r"\S*[\[\]{}<>]\S*", lambda m: re.sub(r"[\[\]{}<>/]", "", m.group()) if re.search(r"[a-zñáéíóú]{3}", m.group()) else "", t)
    t = re.sub(r"!\s*:", ":", t); t = re.sub(r"([,;:])\s*[,;:]+", r"\1", t)
    t = re.sub(r"\s+([,.;:])", r"\1", t); t = re.sub(r"\s{2,}", " ", t).strip()
    return t

def separer_fusions(livres):
    """Verset suivant collé dans le précédent par l'OCR (« … Maonathi. 14. Maonathi engendró … ») : on le sépare
    seulement si ce verset suivant est absent et que son numéro apparaît après une fin de phrase."""
    n = 0
    for b, (nom, chap) in livres.items():
        for c, vs in chap.items():
            have = {v for v, _ in vs}; out = []
            for v, t in vs:
                cur_v, cur_t = v, t
                while cur_v.isdigit():
                    nx = str(int(cur_v) + 1)
                    m = re.search(rf"(?<=[.;:?!])\s+{nx}[.,]\s+(?=[A-ZÁÉÍÓÚÑ¿¡])", cur_t)
                    if nx in have or not m: break
                    out.append([cur_v, cur_t[:m.start()].strip()]); cur_v, cur_t = nx, cur_t[m.end():].strip(); have.add(nx); n += 1
                out.append([cur_v, cur_t])
            chap[c] = out
    print(f"  es : {n} versets séparés d'un verset voisin")
    return livres

import difflib, unicodedata
def _n(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(ch for ch in w if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-zn0-9]", "", w)
_nw = lambda t: [x for x in (_n(w) for w in t.split()) if x and not x.isdigit()]
def _propre(t):
    t = re.sub(r"(\w)\*\s+(\w)", r"\1\2", t)                                 # can* tar → cantar
    t = re.sub(r"[*^■•|]+", " ", t)
    t = re.sub(r"(?<!\S)\d{1,3}(?=[\s,.;:]|$)[.,]?", "", t)                    # renvois de notes et numéros égarés
    t = re.sub(r"(?<!\S)4(?=\s)", "á", t); t = re.sub(r"(?<!\S)0(?=\s)", "ó", t)
    t = re.sub(r"^[^A-Za-zÁÉÍÓÚÑáéíóúñ¿¡«(]+", "", t)
    t = re.sub(r"\s*(==.*|CAP[IÍ]TULO\s+[IVXLC]+.*)$", "", t)
    for _ in range(3): t = re.sub(r"\s+(\S{1,2}|[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)$", "", t) if not re.search(r"[.:;?!]$", t) else t
    t = re.sub(r"\s+([,.;:])", r"\1", t); t = re.sub(r"\s{2,}", " ", t).strip()
    return t
def _bruit(t):
    return len(re.findall(r"\b\w*[a-zñ][A-ZÑ]\w*|\d|[^\w\s.,;:¿?¡!()«»'’-]", t))

def recuperer(livres, ref, chemin):
    """Applique la récupération faite sur 22 éditions numérisées de Torres Amat (tools/bible/recup_torres.py) :
    1) verset collé dans le précédent : on coupe ; 2) verset absent : texte retenu seulement si deux éditions concordent."""
    if not os.path.exists(chemin): return livres
    RS = json.load(open(chemin, encoding="utf-8"))["resultats"]; st = collections.Counter()
    for key, r in sorted(RS.items(), key=lambda x: "coupe_dans" not in x[1]):
        b, c, v = key.split(); c = int(c)
        if b not in livres or c not in livres[b][1]: continue
        ch = livres[b][1][c]; pos = {vv: i for i, (vv, _) in enumerate(ch)}
        if v not in pos or ch[pos[v]][1]: continue
        lat = dict(map(tuple, ref[b][1].get(c, []))).get(v, "") if b in ref else ""
        if "coupe_dans" in r and r["coupe_dans"] in pos:
            h = pos[r["coupe_dans"]]; toks = ch[h][1].split(); hn = [_n(x) for x in toks]
            k = next((k for k in range(3, len(hn) - 3) if hn[k:k + 4] == r["debut"]), None)
            if k is None: st["coupe_introuvable"] += 1; continue
            avant, apres = _propre(" ".join(toks[:k])), _propre(" ".join(toks[k:]))
            if len(avant.split()) < 3 or len(apres.split()) < 3: continue
            ch[h][1] = avant; ch[pos[v]][1] = apres; st["coupes"] += 1
        elif "textes" in r:
            T = {s_: _propre(t) for s_, t in r["textes"].items()}; T = {s_: t for s_, t in T.items() if len(_nw(t)) >= 3}
            if len(T) < 2: st["une_seule_edition"] += 1; continue
            W = {s_: _nw(t) for s_, t in T.items()}
            sc = {s_: sum(difflib.SequenceMatcher(None, W[s_], W[o]).ratio() >= 0.75 for o in T if o != s_) for s_ in T}
            ok = [s_ for s_ in T if sc[s_] >= 1]
            if not ok: st["desaccord"] += 1; continue
            best = min(ok, key=lambda s_: (_bruit(T[s_]), -sc[s_]))
            nl, ne = len(lat.split()), len(W[best])
            if not nl or not (0.75 * nl <= ne <= 2.0 * nl + 3) or _bruit(T[best]) > 3: st["controle"] += 1; continue
            ch[pos[v]][1] = T[best]; st["textes"] += 1
    # 3) verset collé ailleurs dans le chapitre (numéro mal lu) : le texte des éditions dit où il est
    for key, r in RS.items():
        b, c, v = key.split(); c = int(c)
        if "textes" not in r or b not in livres or c not in livres[b][1]: continue
        ch = livres[b][1][c]; pos = {vv: i for i, (vv, _) in enumerate(ch)}
        if v not in pos or ch[pos[v]][1]: continue
        W = [w for w in (_nw(_propre(t)) for t in r["textes"].values()) if len(w) >= 6]
        if not W: continue   # une seule édition suffit ici : notre propre texte confirme le passage
        for h, (hv, ht) in enumerate(ch):
            if not ht or hv == v: continue
            toks = ht.split(); hn = [_n(x) for x in toks]
            hits = []
            for w in W:
                k = next((k for k in range(2, len(hn) - 3) if hn[k:k + 4] == w[:4]), None)
                z = next((z for z in range(len(hn) - 1, (k or 0) + 3, -1) if k is not None and hn[z - 2:z + 1] == w[-3:]), None) if k is not None else None
                if k is not None and z is None and 0.7 * len(w) <= len(hn) - k <= 1.4 * len(w) + 3: z = len(hn) - 1   # fin du verset hôte
                if k is not None and z is not None: hits.append((k, z + 1))
            if hits:
                k, z = max(set(hits), key=hits.count)
                piece = _propre(" ".join(toks[k:z])); rest = _propre(" ".join(toks[:k] + toks[z:]))
                if len(piece.split()) >= 4 and len(rest.split()) >= 4:
                    ch[pos[v]][1] = piece; ch[h][1] = rest; st["deplaces"] += 1
                break
    print("  es, récupération multi-éditions :", dict(st))
    return livres

def completer(livres, ref):
    """Ajoute, vides, les versets présents dans la version de référence (Vulgate) mais absents : « non encore transcrit »."""
    for b, (nom, chap) in livres.items():
        if b not in ref: continue
        for c, rvs in ref[b][1].items():
            have = {v for v, _ in chap.get(c, [])}
            manq = [[v, ""] for v, _ in rvs if v not in have]
            if manq: chap[c] = sorted(chap.get(c, []) + manq, key=lambda x: (int(re.sub(r"\D.*", "", x[0]) or 0), x[0]))
    return livres

VERSIONS = [
  ("fr", "Bible Fillion (1904)", "français", "catholique", "Domaine public — édition numérique CC0 (github.com/janvier-s/bible-fillion)",
   lambda: fillion(f"{SRC}/janvier-s_bible-fillion/formats/json-flat/fillion-array-of-objects.json", f"{SRC}/janvier-s_bible-fillion/metadata/books.json")),
  ("en", "Douay-Rheims (1899, American Edition)", "English", "catholique", "Domaine public — via github.com/seven1m/open-bibles (eBible.org)",
   lambda: usfx(f"{SRC}/open-bibles/eng-dra.usfx.xml")),
  ("es", "Torres Amat (1823), édition de 1882", "español", "catholique",
   "Domaine public (Torres Amat † 1847) — texte reconstruit par reconnaissance optique de l'édition de 1882 (Internet Archive) par le projet Biblia Elim (github.com/OmarGonD/biblia-elim, version 0.9.20). Transcription non entièrement relue : quelques coquilles et environ 5 % de versets manquants",
   lambda: (lambda la: completer(recuperer(completer(separer_fusions(sqlite_sword(f"{SRC}/biblia-elim/modulos/sqlite/TorresAmat.sqlite")), la), la,
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "bible", "torres_recup.json")), la))(usfx(f"{SRC}/open-bibles/lat-clementine.usfx.xml"))),
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
