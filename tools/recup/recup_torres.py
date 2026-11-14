"""Récupère les versets Torres Amat manquants à partir des textes OCR bruts de plusieurs éditions numérisées
(Internet Archive). Chaque verset manquant est encadré par deux versets connus ; on retrouve ces voisins dans
l'OCR et on extrait ce qu'il y a entre eux. Une version n'est retenue que si deux éditions indépendantes donnent
le même texte, ou si l'unique candidat passe des contrôles stricts (fait hors de ce script, à la construction).
Usage : python3 recup_torres.py <public/bible> <sortie.json>"""
import json, os, re, sys, unicodedata, urllib.request, urllib.parse, collections

BIB, OUT = sys.argv[1], sys.argv[2]
CACHE = os.path.join(os.path.dirname(OUT), "cache"); os.makedirs(CACHE, exist_ok=True)
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "guardian-angel-recup/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r: return r.read()

q = 'creator:("Torres Amat") AND title:(biblia) AND mediatype:texts'
items = [d["identifier"] for d in json.loads(get("https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
    {"q": q, "fl[]": "identifier", "rows": 80, "output": "json"})))["response"]["docs"]]
q2 = 'title:("sagrada biblia") AND (description:(torres amat) OR subject:(torres amat)) AND mediatype:texts'
try:
    items += [d["identifier"] for d in json.loads(get("https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
        {"q": q2, "fl[]": "identifier", "rows": 80, "output": "json"})))["response"]["docs"]]
except Exception as e: print("::warning::", e)
items = list(dict.fromkeys(["la-sagrada-biblia-vulgata-tomo-iiv_202111"] + items))
print("::notice::éditions candidates :", len(items), " ".join(items[:40]))

def nrm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(ch for ch in w if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-zn0-9]", "", w)
sources, budget = [], 900_000_000
for it in items:
    try:
        meta = json.loads(get(f"https://archive.org/metadata/{it}"))
        fs = [f for f in meta.get("files", []) if f["name"].endswith("_djvu.txt")]
        lang = str(meta.get("metadata", {}).get("language", ""))
        if not fs or (lang and not re.search(r"sp|es|cast", lang, re.I)): continue
        txt = []
        for f in fs:
            size = int(f.get("size", 0) or 0)
            if size > budget: continue
            p = os.path.join(CACHE, re.sub(r"[^\w.]", "_", it + "__" + f["name"]))
            if not os.path.exists(p): open(p, "wb").write(get(f"https://archive.org/download/{it}/{urllib.parse.quote(f['name'])}"))
            budget -= size; txt.append(open(p, encoding="utf-8", errors="replace").read())
        t = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", "\n".join(txt))
        if "Jesu" not in t and "Israél" not in t and "Israel" not in t: continue
        toks = t.split(); N = [nrm(x) for x in toks]; idx = [i for i, w in enumerate(N) if w]
        g3 = collections.defaultdict(list)
        for j in range(len(idx) - 3): g3[(N[idx[j]], N[idx[j + 1]], N[idx[j + 2]])].append(j)
        sources.append((it, toks, idx, g3)); print(f"  {it}: {len(toks)} mots")
    except Exception as e: print(f"::warning::{it} : {e}")
print("::notice::éditions exploitables :", len(sources), " ".join(s[0] for s in sources))

words = lambda s: [w for w in (nrm(x) for x in s.split()) if w]
def anchors(g3, seq, fin):
    """positions candidates : chaque 3-gramme parmi les 8 derniers (fin) ou 8 premiers mots, ramené au bord du verset"""
    out = set(); seq = seq[-8:] if fin else seq[:8]
    for k in range(len(seq) - 2):
        for p in g3.get(tuple(seq[k:k + 3]), []):
            out.add(p + (len(seq) - k - 1) if fin else p - k)
    return out

ix = json.load(open(f"{BIB}/index.json"))
livres = [b for b, _, _ in next(v for v in ix["versions"] if v["code"] == "es")["livres"]]
cand, stats = collections.defaultdict(dict), collections.Counter()
for b in livres:
    es = json.load(open(f"{BIB}/es/{b}.json"))
    for ci, ch in enumerate(es):
        i = 0
        while i < len(ch):
            if ch[i][1]: i += 1; continue
            j = i
            while j < len(ch) and not ch[j][1]: j += 1
            run = ch[i:j]; stats["versets"] += len(run)
            if i == 0 or j == len(ch): stats["bord"] += len(run); i = j; continue
            WA, WB = words(ch[i - 1][1]), words(ch[j][1]); nums = [v for v, _ in run]
            for it, toks, idx, g3 in sources:
                A, B = anchors(g3, WA, True), anchors(g3, WB, False); best = None
                Bs = sorted(B)
                for a in A:
                    for bb in Bs:
                        if bb <= a + 1: continue
                        if bb - a > 90 * len(run) + 40: break
                        if best is None or bb - a < best[1] - best[0]: best = (a, bb)
                        break
                if not best: continue
                seg = toks[idx[best[0]] + 1: idx[best[1]]]
                parts, cur, k = [], None, 0
                for t in seg:
                    tt = re.sub(r"[^\d]", "", t)
                    if k < len(nums) and tt == nums[k] and len(t) <= len(tt) + 2:
                        if cur is not None: parts.append(cur)
                        cur = []; k += 1; continue
                    if cur is not None: cur.append(t)
                if cur is not None: parts.append(cur)
                if len(run) == 1 and not parts: parts = [seg]
                if len(parts) != len(run): continue
                for v, p in zip(nums, parts):
                    cand[f"{b} {ci + 1} {v}"][it] = re.sub(r"\s+", " ", " ".join(p)).strip()
            i = j
stats["avec_candidat"] = len(cand)
stats["avec_2_editions"] = sum(1 for v in cand.values() if len(v) >= 2)
json.dump({"sources": [s[0] for s in sources], "stats": stats, "candidats": cand}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("::notice::" + " ".join(f"{k}={v}" for k, v in stats.items()))
