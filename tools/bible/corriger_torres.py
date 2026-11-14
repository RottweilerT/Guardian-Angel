"""Correction des coquilles d'OCR de Torres Amat par vote entre éditions numérisées.
Pour chaque verset, on retrouve le même verset dans chaque édition (entre son début et le début du suivant),
on aligne mot à mot, et un mot n'est corrigé que si (1) notre mot n'est pas un mot connu du corpus et
(2) au moins deux éditions donnent, à la même place, un même mot connu.
Usage : python3 corriger_torres.py <public/bible> <cache OCR> <sortie.json>"""
import json, os, re, sys, collections, difflib, unicodedata
BIB, CACHE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
def nrm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(ch for ch in w if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-zn]", "", w)
srcs = collections.defaultdict(list)
for f in sorted(os.listdir(CACHE)):
    srcs[f.split("__")[0]].append(open(os.path.join(CACHE, f), encoding="utf-8", errors="replace").read())
sources = []
for it, txt in srcs.items():
    t = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", "\n".join(txt)); toks = t.split(); N = [nrm(x) for x in toks]
    idx = [i for i, w in enumerate(N) if w]; g3 = collections.defaultdict(list)
    for j in range(len(idx) - 3): g3[(N[idx[j]], N[idx[j + 1]], N[idx[j + 2]])].append(j)
    sources.append((it, toks, N, idx, g3))
print("éditions :", len(sources))
ix = json.load(open(f"{BIB}/index.json"))
livres = [b for b, _, _ in next(v for v in ix["versions"] if v["code"] == "es")["livres"]]
data = {b: json.load(open(f"{BIB}/es/{b}.json")) for b in livres}
voc = collections.Counter(nrm(w) for b in livres for ch in data[b] for _, t in ch for w in t.split())
for it, toks, N, idx, g3 in sources:
    voc.update(set(N))   # un mot présent dans les éditions compte aussi comme connu…
connu = lambda w: voc[w] >= 4
def anchors(g3, seq):
    out = set(); seq = seq[:8]
    for k in range(len(seq) - 2):
        for p in g3.get(tuple(seq[k:k + 3]), []): out.add(p - k)
    return sorted(out)
corr, st = {}, collections.Counter()
for b in livres:
    for ci, ch in enumerate(data[b]):
        for vi in range(len(ch) - 1):
            v, t = ch[vi]; t2 = ch[vi + 1][1]
            if not t or not t2: continue
            raw = t.split(); W = [nrm(x) for x in raw]; Wn = [w for w in (nrm(x) for x in t2.split()) if w]
            Wv = [w for w in W if w]
            sus = [k for k, w in enumerate(W) if w and not connu(w)]
            if not sus: continue
            st["versets_suspects"] += 1
            votes = collections.defaultdict(collections.Counter); formes = collections.defaultdict(collections.Counter)
            brut = lambda x: re.sub(r"^[^\wÁÉÍÓÚÑáéíóúñ]+|[^\wÁÉÍÓÚÑáéíóúñ]+$", "", x)
            for it, toks, N, idx, g3 in sources:
                A, B = anchors(g3, Wv), anchors(g3, Wn); best = None
                for a in A:
                    for bb in B:
                        if bb <= a + 2: continue
                        if bb - a > 2 * len(Wv) + 20: break
                        if best is None or bb - a < best[1] - best[0]: best = (a, bb)
                        break
                if not best: continue
                E = [N[idx[j]] for j in range(best[0], best[1])]; Er = [toks[idx[j]] for j in range(best[0], best[1])]
                ourpos = [k for k, w in enumerate(W) if w]
                sm = difflib.SequenceMatcher(None, Wv, E, autojunk=False)
                if sm.ratio() < 0.6: continue
                for op, i1, i2, j1, j2 in sm.get_opcodes():
                    if op == "replace" and i2 - i1 == j2 - j1:
                        for d in range(i2 - i1):
                            k = ourpos[i1 + d]
                            if k in sus and connu(E[j1 + d]): votes[k][E[j1 + d]] += 1; formes[(k, E[j1 + d])][brut(Er[j1 + d])] += 1
                    elif op == "replace" and i2 - i1 == 1 and j2 - j1 == 2:      # mot collé : « verla » → « ver la »
                        k = ourpos[i1]
                        if k in sus and Wv[i1] == E[j1] + E[j1 + 1]:
                            u = E[j1] + " " + E[j1 + 1]; votes[k][u] += 1; formes[(k, u)][brut(Er[j1]) + " " + brut(Er[j1 + 1])] += 1
            for k, c in votes.items():
                (u, n), = c.most_common(1)
                if n >= 2 and (len(c) == 1 or c.most_common(2)[1][1] < n):
                    corr.setdefault(f"{b} {ci + 1} {v}", []).append([k, raw[k], u, n, formes[(k, u)].most_common(1)[0][0]]); st["corrections"] += 1
json.dump({"stats": st, "corrections": corr}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("::notice::" + " ".join(f"{k}={v}" for k, v in st.items()))
