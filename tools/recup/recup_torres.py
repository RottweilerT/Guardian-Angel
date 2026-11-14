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
res, stats = collections.defaultdict(dict), collections.Counter()

def segment(it_src, WP, WN, maxlen):
    """mots de l'édition entre le début du verset P (connu) et le début du verset N (connu)"""
    it, toks, idx, g3 = it_src
    A, B = sorted(anchors(g3, WP, False)), sorted(anchors(g3, WN, False)); best = None
    for a in A:
        for bb in B:
            if bb <= a + 2: continue
            if bb - a > maxlen: break
            if best is None or bb - a < best[1] - best[0]: best = (a, bb)
            break
    if not best: return None
    return toks[idx[best[0]]: idx[best[1]]]

for b in livres:
    es = json.load(open(f"{BIB}/es/{b}.json"))
    for ci, ch in enumerate(es):
        i = 0
        while i < len(ch):
            if ch[i][1]: i += 1; continue
            j = i
            while j < len(ch) and not ch[j][1]: j += 1
            run = ch[i:j]; stats["versets"] += len(run)
            if i == 0 or j == len(ch):
                # bord de chapitre : un seul voisin connu ; on cherche le numéro du verset près de lui
                for v, _ in run:
                    textes = []
                    for it, toks, idx, g3 in sources:
                        if i == 0:   # début de chapitre : marqueur « v. » avant le premier verset connu
                            Bs = sorted(anchors(g3, words(ch[j][1]), False))
                            for bb in Bs[:6]:
                                lo = max(0, idx[bb] - 120 * len(run) - 60); seg = toks[lo: idx[bb]]
                                ks = [k for k, t in enumerate(seg) if re.sub(r"[^\d]", "", t) == v and len(t) <= len(v) + 2]
                                if ks:
                                    k = ks[-1]; stop = next((m for m in range(k + 1, len(seg)) if re.sub(r"[^\d]", "", seg[m]) == str(int(v) + 1) and len(seg[m]) <= 4), len(seg))
                                    textes.append((it, " ".join(seg[k + 1:stop]))); break
                        else:        # fin de chapitre : marqueur « v. » après le dernier verset connu
                            P = ch[i - 1]; As = sorted(anchors(g3, words(P[1]), False))
                            for a0 in As[:6]:
                                hi = idx[a0] + 2 * len(P[1].split()) + 120 * len(run) + 40; seg = toks[idx[a0]: hi]
                                ks = [k for k, t in enumerate(seg) if k > 2 and re.sub(r"[^\d]", "", t) == v and len(t) <= len(v) + 2]
                                if ks:
                                    k = ks[0]; stop = next((m for m in range(k + 1, len(seg)) if (re.sub(r"[^\d]", "", seg[m]) == str(int(v) + 1) and len(seg[m]) <= 4) or re.match(r"CAP[IÍ]TULO|SALMO|FIN", seg[m])), len(seg))
                                    textes.append((it, " ".join(seg[k + 1:stop]))); break
                    if textes: res[f"{b} {ci + 1} {v}"] = {"textes": dict(textes), "bord": True}; stats["bord_textes"] += 1
                    else: stats["bord_rien"] += 1
                i = j; continue
            P, Nn = ch[i - 1], ch[j]; WP, WN = words(P[1]), words(Nn[1])
            maxlen = 2 * len(P[1].split()) + 90 * len(run) + 40
            for v, _ in run:
                debuts, textes = collections.Counter(), []
                for src in sources:
                    seg = segment(src, WP, WN, maxlen)
                    if not seg: continue
                    # repère du numéro v dans le segment
                    for k, t in enumerate(seg):
                        tt = re.sub(r"[^\d]", "", t)
                        if tt == v and len(t) <= len(tt) + 2 and k > 2:
                            after = [w for w in (nrm(x) for x in seg[k + 1:k + 12]) if w and not w.isdigit()][:4]
                            if len(after) == 4: debuts[tuple(after)] += 1
                            # texte jusqu'au numéro suivant
                            stop = next((m for m in range(k + 1, len(seg)) if re.sub(r"[^\d]", "", seg[m]) == str(int(v) + 1) and len(seg[m]) <= 4), len(seg))
                            textes.append((src[0], " ".join(seg[k + 1:stop])))
                            break
                # 1) le verset est collé dans le verset précédent : on cherche son début dans P
                hp = [nrm(x) for x in P[1].split()]
                coupe = None
                for d, n in debuts.most_common():
                    for k in range(3, len(hp) - 3):
                        if hp[k:k + 4] == list(d) or (n >= 2 and sum(x == y for x, y in zip(hp[k:k + 4], d)) >= 3 and hp[k] == d[0]):
                            coupe = (k, n); break
                    if coupe: break
                if coupe:
                    res[f"{b} {ci + 1} {v}"] = {"coupe_dans": P[0], "mot": coupe[0], "debut": hp[coupe[0]:coupe[0] + 4], "editions": coupe[1]}; stats["coupes"] += 1
                elif textes:
                    res[f"{b} {ci + 1} {v}"] = {"textes": dict(textes)}; stats["textes"] += 1
                else: stats["rien"] += 1
            i = j
json.dump({"sources": [s[0] for s in sources], "stats": stats, "resultats": res}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("::notice::" + " ".join(f"{k}={v}" for k, v in stats.items()))
