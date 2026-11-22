"""Missel de 1962 pour Guardian Angel.

Calcule, jour par jour, la messe selon les rubriques de 1962 avec Missale Meum (MIT), qui s'appuie sur
les textes de Divinum Officium (MIT ; textes latins du domaine public), puis écrit :
  public/missel1962/jours/AAAA-MM-JJ.json  — fête, rang, couleur, commémoraisons, propre du jour en latin,
                                             épîtres/leçons/évangiles en français (Bible Fillion, domaine public)
  public/missel1962/ordo.json              — ordinaire de la messe en latin
  public/missel1962/index.json             — période couverte, sources
Les traductions françaises des prières de Divinum Officium (propriété de l'abbaye du Barroux) ne sont PAS reprises ;
seuls les intitulés des fêtes (faits, non protégeables) sont lus dans les fichiers français.

Usage (dans le dossier backend de Missale Meum, avec Divinum Officium en sous-module) :
  PYTHONPATH=. python3 build.py <public/> <AAAA-MM-JJ début> <AAAA-MM-JJ fin>
"""
import datetime, json, logging, os, re, sys
import yaml

logging.disable(logging.CRITICAL)
from api import controller  # Missale Meum

PUB, DEBUT, FIN = sys.argv[1], datetime.date.fromisoformat(sys.argv[2]), datetime.date.fromisoformat(sys.argv[3])
OUT = os.path.join(PUB, "missel1962")
DO = os.path.join("resources", "divinum-officium", "web", "www", "missa")
os.makedirs(os.path.join(OUT, "jours"), exist_ok=True)

SECTIONS_FR = {
    "Introitus": "Introït", "Oratio": "Collecte", "Lectio": "Épître", "Graduale": "Graduel", "GradualeP": "Graduel (temps pascal)",
    "Tractus": "Trait", "Sequentia": "Séquence", "Evangelium": "Évangile", "Offertorium": "Offertoire", "Secreta": "Secrète",
    "Prefatio": "Préface", "Communio": "Communion", "Postcommunio": "Postcommunion", "Super populum": "Oraison sur le peuple",
    "Commemoratio Oratio": "Collecte de la commémoraison", "Commemoratio Secreta": "Secrète de la commémoraison",
    "Commemoratio Postcommunio": "Postcommunion de la commémoraison", "Passio": "Passion",
}
def titre_section(sid):
    m = re.match(r"(Lectio|Graduale|Oratio)L(\d)$", sid)
    if m: return {"Lectio": "Leçon", "Graduale": "Graduel", "Oratio": "Oraison"}[m.group(1)] + " " + m.group(2)
    return SECTIONS_FR.get(sid, sid)

# Abréviations de Divinum Officium / Missale Meum → codes des livres de la Bible de l'application
LIVRES = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Levit": "LEV", "Num": "NUM", "Deut": "DEU", "Jos": "JOS", "Judic": "JDG", "Ruth": "RUT",
    "1 Reg": "1SA", "2 Reg": "2SA", "3 Reg": "1KI", "4 Reg": "2KI", "1 Par": "1CH", "2 Par": "2CH", "Esdr": "EZR", "Neh": "NEH",
    "Tob": "TOB", "Judith": "JDT", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO", "Eccl": "ECC", "Cant": "SNG", "Sap": "WIS",
    "Eccli": "SIR", "Is": "ISA", "Isa": "ISA", "Jer": "JER", "Lam": "LAM", "Bar": "BAR", "Ezech": "EZK", "Dan": "DAN", "Osee": "HOS",
    "Joel": "JOL", "Joël": "JOL", "Amos": "AMO", "Abd": "OBA", "Jonæ": "JON", "Jon": "JON", "Mich": "MIC", "Nah": "NAM", "Hab": "HAB", "Soph": "ZEP",
    "Agg": "HAG", "Zach": "ZEC", "Malach": "MAL", "Mal": "MAL", "1 Mach": "1MA", "2 Mach": "2MA",
    "Matt": "MAT", "Marc": "MRK", "Luc": "LUK", "Joann": "JHN", "Joannes": "JHN", "Jo": "JHN", "Joh": "JHN", "Act": "ACT", "Acts": "ACT",
    "Rom": "ROM", "1 Cor": "1CO", "2 Cor": "2CO", "Gal": "GAL", "Eph": "EPH", "Ephes": "EPH", "Phil": "PHP", "Philipp": "PHP", "Col": "COL",
    "1 Thess": "1TH", "2 Thess": "2TH", "1 Tim": "1TI", "2 Tim": "2TI", "Tit": "TIT", "Philem": "PHM", "Heb": "HEB", "Hebr": "HEB",
    "Jac": "JAS", "Jas": "JAS", "1 Pet": "1PE", "1 Petri": "1PE", "2 Pet": "2PE", "2 Petri": "2PE", "1 Joann": "1JN", "1 Joannes": "1JN",
    "1 Joannnes": "1JN", "1 John": "1JN", "2 Joann": "2JN", "3 Joann": "3JN", "Jud": "JUD", "Apoc": "REV",
}
_chap = {}
def chapitre(code, c):
    k = (code, c)
    if k not in _chap:
        p = os.path.join(PUB, "bible", "fr", code, f"{c}.json")
        _chap[k] = dict((v, t) for v, t in json.load(open(p, encoding="utf-8"))) if os.path.exists(p) else None
    return _chap[k]

def lecture_fr(ref):
    """« Col 1:9-14 », « Judith 13:22, 23-25 », « Luc 1:26-2:3 » → texte de la Bible Fillion (versets entiers)"""
    ref = ref.strip().rstrip(".").replace("1. ", "1 ")
    m = re.match(r"\s*((?:\d\s*)?[A-Za-zæë]+)\.?\s+(.*)$", ref)
    if not m or m.group(1) not in LIVRES: return None
    code, reste, out, chap = LIVRES[m.group(1)], m.group(2), [], None
    reste = re.sub(r"^(\d+),\s*(?=\d)", r"\1:", reste)  # « Act 1, 15-26 » = chapitre 1, versets 15 à 26
    reste = re.sub(r";\s*(\d+),\s*(?=\d)", r";\1:", reste)
    for seg in re.split(r"[;,]", reste):
        seg = re.sub(r"(\d)[a-z]\b", r"\1", seg.strip())
        if not seg: continue
        mm = re.match(r"^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$", seg)
        if not mm: return None
        if not mm.group(3) and mm.group(4) and int(mm.group(4)) < int(mm.group(2)): return None  # référence fautive
        c1 = int(mm.group(1)) if mm.group(1) else chap
        if c1 is None: return None
        v1 = int(mm.group(2)); c2 = int(mm.group(3)) if mm.group(3) else c1; v2 = int(mm.group(4)) if mm.group(4) else v1
        for c in range(c1, c2 + 1):
            ch = chapitre(code, c)
            if not ch: return None
            debut = v1 if c == c1 else 1; fin = v2 if c == c2 else max(int(x) for x in ch if x.isdigit())
            for v in range(debut, fin + 1):
                if str(v) in ch and ch[str(v)]: out.append(ch[str(v)])
        chap = c2
    return " ".join(out) or None

# Intitulés absents des fichiers français de Divinum Officium (traduction propre)
TITRES_FR = {"commune:C10:": "Messe de la Sainte Vierge le samedi (Salve, sancta Parens)", "commune:C10t": "Messe de la Sainte Vierge le samedi (Salve, sancta Parens)",
             "commune:C10b": "Messe de la Sainte Vierge le samedi (Vultum tuum)", "commune:C10c": "Messe de la Sainte Vierge le samedi (Salve, sancta Parens)",
             "commune:C10Pasc": "Messe de la Sainte Vierge le samedi (temps pascal)", "commune:C10a": "Messe de la Sainte Vierge le samedi (Rorate)",
             "tempora:Nat1-": "Férie dans l'octave de Noël", "sancti:05-11": "Saints Philippe et Jacques, apôtres",
             "tempora:Pasc6-6": "Samedi après l'Ascension", "sancti:12-13": "Sainte Lucie, vierge et martyre"}
_titres = {}
def titre_fr(pid):
    """Intitulé français d'une fête, lu dans [Officium] du fichier français de Divinum Officium (suit les renvois @)."""
    if pid in _titres: return _titres[pid]
    kind, nom = pid.split(":")[:2]
    chemin, vus, t = f"{'Tempora' if kind == 'tempora' else 'Sancti' if kind == 'sancti' else 'Commune' if kind == 'commune' else 'Votive'}/{nom}", set(), None
    while chemin and chemin not in vus:
        vus.add(chemin); p = os.path.join(DO, "Francais", chemin + ".txt")
        if not os.path.exists(p): break
        txt = open(p, encoding="utf-8", errors="replace").read()
        m = re.search(r"^\[Officium\]\s*\n(.+)$", txt, re.M)
        if m: t = m.group(1).strip(); break
        r = re.match(r"^@([A-Za-z]+/[^\s:]+)", txt)
        chemin = r.group(1) if r else None
    if not t:
        t = next((v for k, v in TITRES_FR.items() if pid.startswith(k)), None)
    _titres[pid] = t
    return t

COULEURS = {"w": "blanc", "r": "rouge", "g": "vert", "v": "violet", "b": "noir", "p": "rose"}
RANG = {1: "Ire classe", 2: "IIe classe", 3: "IIIe classe", 4: "IVe classe"}

def section(s):
    body = s["body"].replace("\r", "").strip()
    ref = re.search(r"\*([^*]+)\*", body)
    d = {"id": s["id"], "titre": titre_section(s["id"]), "la": body}
    if s["id"].startswith(("Lectio", "Evangelium", "Passio")) and ref:
        d["ref"] = ref.group(1).strip()
        fr = lecture_fr(d["ref"])
        if fr: d["fr"] = fr
    return d

n, sans_fr, lectures = 0, 0, 0
d = DEBUT
while d <= FIN:
    day = controller.get_day(d, "en")
    messes = []
    for vern, la in controller.get_proper_by_date(d, "en"):
        secs = [section(s) for s in la.serialize()]
        for x in secs:
            if x["id"].startswith(("Lectio", "Evangelium")) and x.get("ref"):
                lectures += 1; sans_fr += "fr" not in x
        messes.append({"id": la.id, "titre_la": la.title, "titre_fr": titre_fr(la.id) if la.id and ":" in la.id else None, "sections": secs})
    cel = day.celebration[0] if day.celebration else (day.tempora[0] if day.tempora else None)
    jour = {
        "date": d.isoformat(),
        "titre_fr": (titre_fr(cel.id) if cel and cel.id else None) or (messes[0]["titre_fr"] if messes else None),
        "titre_la": messes[0]["titre_la"] if messes else None,
        "titre_en": day.get_celebration_name(),
        "classe": day.get_celebration_rank(), "rang": RANG.get(day.get_celebration_rank()),
        "couleurs": [COULEURS.get(c, c) for c in (day.get_celebration_colors() or [])],
        "commemoraisons": [{"titre_fr": titre_fr(c.id) or c.title, "titre_en": c.title} for c in day.commemoration if c.id],
        "messes": messes,
    }
    json.dump(jour, open(os.path.join(OUT, "jours", d.isoformat() + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    n += 1; d += datetime.timedelta(days=1)

# Ordinaire de la messe : texte latin de Missale Meum (rubriques anglaises non reprises)
ORDO_FR = {
    "Asperges": "Aspersion de l'eau bénite", "Prayers at the Foot of the Altar": "Prières au bas de l'autel", "Introit": "Introït",
    "Kyrie": "Kyrie", "Gloria": "Gloria", "The Collect": "Collecte", "The Epistle": "Épître", "The Gradual": "Graduel",
    "The Gospel": "Évangile", "Credo": "Credo", "Offertory": "Offertoire", "Offertory Verse": "Antienne d'offertoire",
    "Offertory Prayers": "Offrande du pain et du vin", "Incensing": "Encensement", "Lavabo": "Lavabo",
    "Prayer to the Most Holy Trinity": "Prière à la Sainte Trinité", "Orate Fratres": "Orate, fratres", "The Secret": "Secrète",
    "Preface": "Préface", "Canon": "Canon de la messe", "Communion": "Communion", "Pater Noster": "Pater noster",
    "Fraction – Breaking of the Sacred Host": "Fraction de l'hostie et paix", "Agnus Dei": "Agnus Dei",
    "Prayers for Holy Communion": "Prières avant la communion", "Communion of the Priest": "Communion du prêtre",
    "Communion of the People": "Communion des fidèles", "Ablutions": "Ablutions", "Communion Antiphon": "Antienne de communion",
    "Conclusion": "Postcommunion et renvoi", "The Last Gospel": "Dernier Évangile", "Prayers ordered by the pope Leo XIII": "Prières léonines",
    "Liturgy of the Word": None,
}
# quelles sections du propre se placent dans quelle partie de l'ordinaire
PROPRE = {"Introit": ["Introitus"], "The Collect": ["Oratio", "Commemoratio Oratio"],
          "The Epistle": ["LectioL1", "GradualeL1", "OratioL1", "LectioL2", "GradualeL2", "OratioL2", "LectioL3", "GradualeL3", "OratioL3",
                          "LectioL4", "GradualeL4", "OratioL4", "LectioL5", "GradualeL5", "OratioL5", "Lectio"],
          "The Gradual": ["Graduale", "GradualeP", "Tractus", "Sequentia"], "The Gospel": ["Evangelium", "Passio"],
          "Offertory Verse": ["Offertorium"], "The Secret": ["Secreta", "Commemoratio Secreta"], "Preface": ["Prefatio"],
          "Communion Antiphon": ["Communio"], "Conclusion": ["Postcommunio", "Commemoratio Postcommunio", "Super populum"]}
ordo = yaml.safe_load(open(os.path.join("resources", "ordo", "en", "ordo.yaml"), encoding="utf-8"))[0]["sections"]
parties = []
for s in ordo:
    if ORDO_FR.get(s["label"], "") is None: continue
    latin = [re.sub(r"\n{3,}", "\n\n", re.sub(r"^\s*–[^\n]*–\s*$", "", b[1], flags=re.M)).strip()
             for b in s["body"] if isinstance(b, list) and len(b) == 2 and b[1]]
    latin = [t for t in latin if t]
    parties.append({"cle": s["label"], "titre": ORDO_FR.get(s["label"], s["label"]), "la": latin, "propre": PROPRE.get(s["label"], [])})
json.dump({"parties": parties}, open(os.path.join(OUT, "ordo.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump({"du": DEBUT.isoformat(), "au": FIN.isoformat(), "jours": n, "genere": datetime.date.today().isoformat(),
           "sources": ["Missale Meum (MIT) — calendrier et propres de 1962", "Divinum Officium (MIT) — textes latins (domaine public)",
                       "Bible Fillion (domaine public) — épîtres, leçons et évangiles en français"]},
          open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{n} jours ; lectures : {lectures}, sans texte français : {sans_fr}")
