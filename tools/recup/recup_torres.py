"""Récupère les versets Torres Amat manquants à partir du texte OCR brut de l'édition de 1882 (Internet Archive).
Principe : chaque verset manquant est encadré par deux versets connus ; on retrouve ces deux voisins dans l'OCR brut
(mêmes mots, puisque la transcription vient de ce même OCR) et on extrait ce qu'il y a entre eux.
Contrôles : écart court, numéro de verset attendu, longueur cohérente avec le verset latin correspondant.
Usage : python3 recup_torres.py <dossier public/bible> <sortie.json>"""
import json, os, re, sys, unicodedata, urllib.request, collections

ITEM = "la-sagrada-biblia-vulgata-tomo-iiv_202111"
BIB, OUT = sys.argv[1], sys.argv[2]
CACHE = os.path.join(os.path.dirname(OUT), "cache"); os.makedirs(CACHE, exist_ok=True)

def get(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "guardian-angel-recup/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r: data = r.read()
    if dest: open(dest, "wb").write(data)
    return data

meta = json.loads(get(f"https://archive.org/metadata/{ITEM}"))
txts = sorted(f["name"] for f in meta["files"] if f["name"].endswith("_djvu.txt"))
print("::notice::fichiers OCR :", txts)
raw = []
for n in txts:
    p = os.path.join(CACHE, re.sub(r"[^\w.]", "_", n))
    if not os.path.exists(p): get(f"https://archive.org/download/{ITEM}/{urllib.request.quote(n)}", p)
    raw.append(open(p, encoding="utf-8", errors="replace").read())
texte = "\n".join(raw)
texte = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", texte)            # césures de fin de ligne
toks = texte.split()
def nrm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(ch for ch in w if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-zñ0-9]", "", w)
N = [nrm(t) for t in toks]
pos = collections.defaultdict(list)
K = 4
idx = [i for i, w in enumerate(N) if w]                          # positions des mots non vides
for j in range(len(idx) - K):
    pos[tuple(N[idx[j + k]] for k in range(K))].append(j)
words = lambda s: [w for w in (nrm(x) for x in s.split()) if w]

def trouve(seq, fin):
    """positions (dans idx) de la séquence ; fin=True → position du dernier mot"""
    for k in (K,):
        if len(seq) < k: return []
        key = tuple(seq[-k:]) if fin else tuple(seq[:k])
        return [p + (k - 1 if fin else 0) for p in pos.get(key, [])]
    return []

ix = json.load(open(f"{BIB}/index.json"))
livres = [b for b, _, _ in next(v for v in ix["versions"] if v["code"] == "es")["livres"]]
res, stats = {}, collections.Counter()
for b in livres:
    es = json.load(open(f"{BIB}/es/{b}.json")); la = json.load(open(f"{BIB}/la/{b}.json"))
    for ci, ch in enumerate(es):
        lat = dict((n, t) for n, t in (la[ci] if ci < len(la) else []))
        i = 0
        while i < len(ch):
            if ch[i][1]: i += 1; continue
            j = i
            while j < len(ch) and not ch[j][1]: j += 1
            run = ch[i:j]; stats["trous"] += 1; stats["versets"] += len(run)
            if i == 0 or j == len(ch): stats["bord"] += len(run); i = j; continue
            A = trouve(words(ch[i - 1][1]), True); B = trouve(words(ch[j][1]), False)
            best = None
            for a in A:
                for bb in B:
                    d = bb - a
                    if 2 <= d <= 90 * len(run) + 40 and (best is None or d < best[1] - best[0]): best = (a, bb)
            if not best: stats["ancre"] += len(run); i = j; continue
            seg = toks[idx[best[0]] + 1: idx[best[1]]]
            # découpe sur les numéros de verset attendus
            nums = [v for v, _ in run]; parts, cur, k = [], None, 0
            for t in seg:
                tt = re.sub(r"[^\d]", "", t)
                if k < len(nums) and tt == nums[k] and len(t) <= len(tt) + 2:
                    if cur is not None: parts.append(cur)
                    cur = []; k += 1; continue
                if cur is not None: cur.append(t)
            if cur is not None: parts.append(cur)
            if len(run) == 1 and not parts: parts = [seg]          # numéro illisible : un seul verset, on prend tout
            if len(parts) != len(run): stats["decoupe"] += len(run); i = j; continue
            for (v, _), p in zip(run, parts):
                t = re.sub(r"\s+", " ", " ".join(p)).strip()
                nl, ne = len(lat.get(v, "").split()), len(t.split())
                if not nl or not (0.7 * nl <= ne <= 2.4 * nl + 3) or re.search(r"CAP[IÍ]TULO|SALMO [IVXLC]", t):
                    stats["controle"] += 1; continue
                res.setdefault(b, {}).setdefault(str(ci + 1), {})[v] = t; stats["recuperes"] += 1
            i = j
json.dump({"source": f"https://archive.org/details/{ITEM}", "stats": stats, "versets": res}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("::notice::" + " ".join(f"{k}={v}" for k, v in stats.items()))
