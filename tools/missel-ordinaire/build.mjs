#!/usr/bin/env node
// Lectures de la messe (forme ordinaire) pour Guardian Angel.
//
// Références des lectures : Ambo Liturgical Calendars (MIT, calendrier romain général, références seulement).
// Texte : Bible Fillion (domaine public, numérotation de la Vulgate) déjà présente dans public/bible/fr.
// Le lectionnaire cite la numérotation hébraïque/moderne ; elle est convertie vers celle de la Vulgate :
//   - psaumes : table de correspondance (Ps 23 hébreu = Ps 22 Vulgate, etc.) ;
//   - autres livres de l'Ancien Testament : alignement automatique verset par verset entre la World English Bible
//     (domaine public, numérotation moderne) et la Douay-Rheims (domaine public, numérotation de la Vulgate).
// Calendrier de France (Épiphanie et Saint-Sacrement reportés au dimanche) : public/js/liturgie-romain.js.
// Les textes liturgiques propres (antiennes, oraisons, refrains des psaumes) et les traductions de l'AELF ne sont PAS repris.
//
//   La numérotation du lectionnaire (hébraïque) est d'abord ramenée à celle de la WEB (écarts connus des bibles anglaises),
//   puis chaque verset de la WEB est aligné sur la Douay-Rheims.
//   Contrôle final : si le passage obtenu ne ressemble pas assez au passage attendu, le texte n'est pas publié (référence seule).
//
// Usage : node tools/missel-ordinaire/build.mjs <Ambo data/v1/ordinary/general-roman> <eng-web.usfx.xml> <début> <fin>
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { liturgie, fromIso, iso } from "../../public/js/liturgie-romain.js";

const [AMBO, WEB, DEBUT, FIN] = process.argv.slice(2);
const PUB = new URL("../../public/", import.meta.url);
const OUT = new URL("missel-ordinaire/", PUB);
mkdirSync(new URL("jours/", OUT), { recursive: true });

const LIVRES = {
  Gen: "GEN", Exod: "EXO", Lev: "LEV", Num: "NUM", Deut: "DEU", Josh: "JOS", Judg: "JDG", Ruth: "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
  "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH", Ezra: "EZR", Nehemiah: "NEH", Tobit: "TOB", Judith: "JDT",
  Esther: "EST", "1 Maccabees": "1MA", "2 Maccabees": "2MA", Job: "JOB", Ps: "PSA", Proverbs: "PRO", Ecclesiastes: "ECC", Song: "SNG",
  Wisdom: "WIS", Sir: "SIR", Sirach: "SIR", Isa: "ISA", Jer: "JER", Lamentations: "LAM", Baruch: "BAR", Ezek: "EZK", Dan: "DAN",
  Hos: "HOS", Hosea: "HOS", Joel: "JOL", Amos: "AMO", Obadiah: "OBA", Jonah: "JON", Micah: "MIC", Nahum: "NAM", Habakkuk: "HAB",
  Zephaniah: "ZEP", Haggai: "HAG", Zechariah: "ZEC", Malachi: "MAL",
  Matt: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT", Rom: "ROM", "1 Cor": "1CO", "2 Cor": "2CO", Gal: "GAL", Eph: "EPH",
  Phil: "PHP", Phiippians: "PHP", Col: "COL", "1 Thess": "1TH", "2 Thess": "2TH", "1 Tim": "1TI", "2 Tim": "2TI", Titus: "TIT", Philemon: "PHM",
  Heb: "HEB", James: "JAS", "1 Pet": "1PE", "2 Pet": "2PE", "1 John": "1JN", "2 John": "2JN", "3 John": "3JN", Jude: "JUD", Rev: "REV",
};
const NT = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"]);
const LIVRES_FR = { GEN: "Genèse", EXO: "Exode", LEV: "Lévitique", NUM: "Nombres", DEU: "Deutéronome", JOS: "Josué", JDG: "Juges", RUT: "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Rois", "2KI": "2 Rois", "1CH": "1 Chroniques", "2CH": "2 Chroniques", EZR: "Esdras", NEH: "Néhémie", TOB: "Tobie", JDT: "Judith", EST: "Esther", "1MA": "1 Maccabées", "2MA": "2 Maccabées", JOB: "Job", PSA: "Psaume", PRO: "Proverbes", ECC: "Qohélet", SNG: "Cantique", WIS: "Sagesse", SIR: "Siracide", ISA: "Isaïe", JER: "Jérémie", LAM: "Lamentations", BAR: "Baruch", EZK: "Ézéchiel", DAN: "Daniel", HOS: "Osée", JOL: "Joël", AMO: "Amos", OBA: "Abdias", JON: "Jonas", MIC: "Michée", NAM: "Nahum", HAB: "Habacuc", ZEP: "Sophonie", HAG: "Aggée", ZEC: "Zacharie", MAL: "Malachie", MAT: "Matthieu", MRK: "Marc", LUK: "Luc", JHN: "Jean", ACT: "Actes", ROM: "Romains", "1CO": "1 Corinthiens", "2CO": "2 Corinthiens", GAL: "Galates", EPH: "Éphésiens", PHP: "Philippiens", COL: "Colossiens", "1TH": "1 Thessaloniciens", "2TH": "2 Thessaloniciens", "1TI": "1 Timothée", "2TI": "2 Timothée", TIT: "Tite", PHM: "Philémon", HEB: "Hébreux", JAS: "Jacques", "1PE": "1 Pierre", "2PE": "2 Pierre", "1JN": "1 Jean", "2JN": "2 Jean", "3JN": "3 Jean", JUD: "Jude", REV: "Apocalypse" };

// ---------- Bibles ----------
const cache = new Map();
function chap(lang, code, c) {
  const k = lang + code + c;
  if (!cache.has(k)) { const u = new URL(`bible/${lang}/${code}/${c}.json`, PUB); cache.set(k, existsSync(u) ? new Map(JSON.parse(readFileSync(u, "utf8")).map(([v, t]) => [+v, t])) : null); }
  return cache.get(k);
}
const web = new Map();   // "GEN 1" → Map(verset → texte)
const ordre = f => {     // livre → suite des [chapitre, verset]
  const o = new Map(), x = readFileSync(f, "utf8"), AL = { SOS: "SNG", JOE: "JOL", EZE: "EZK", NAH: "NAM" };
  for (const b of x.split(/<book id="/).slice(1)) {
    const code = AL[b.slice(0, 3)] || b.slice(0, 3), seq = [];
    for (const c of b.split(/<c id="/).slice(1)) { const n = parseInt(c); for (const m of c.matchAll(/<v id="(\d+)/g)) seq.push([n, +m[1]]); }
    o.set(code, seq);
  }
  return o;
};
// Numérotation hébraïque (lectionnaire) → anglaise (WEB) : écarts connus des éditions anglaises
const R = (code, c, v1, v2, nc, dv) => [code, c, v1, v2, nc, dv];   // versets v1..v2 du chapitre c → chapitre nc, verset v + dv
const ECARTS = [
  R("GEN", 32, 1, 1, 31, 54), R("GEN", 32, 2, 33, 32, -1), R("EXO", 21, 37, 37, 22, -36), R("EXO", 22, 1, 30, 22, 1),
  R("NUM", 17, 1, 15, 16, 35), R("NUM", 17, 16, 28, 17, -15), R("NUM", 30, 1, 1, 29, 39), R("NUM", 30, 2, 17, 30, -1),
  R("DEU", 13, 1, 1, 12, 31), R("DEU", 13, 2, 19, 13, -1), R("DEU", 23, 1, 1, 22, 29), R("DEU", 23, 2, 26, 23, -1),
  R("1SA", 21, 1, 1, 20, 41), R("1SA", 21, 2, 16, 21, -1), R("1SA", 24, 1, 1, 23, 28), R("1SA", 24, 2, 23, 24, -1),
  R("2SA", 19, 1, 1, 18, 32), R("2SA", 19, 2, 44, 19, -1), R("1KI", 5, 1, 14, 4, 20), R("1KI", 5, 15, 32, 5, -14),
  R("2KI", 12, 1, 1, 11, 20), R("2KI", 12, 2, 22, 12, -1), R("NEH", 3, 33, 38, 4, -32), R("NEH", 4, 1, 17, 4, 6), R("NEH", 10, 1, 1, 9, 37), R("NEH", 10, 2, 40, 10, -1),
  R("JOB", 40, 25, 32, 41, -24), R("JOB", 41, 1, 26, 41, 8), R("ECC", 4, 17, 17, 5, -16), R("ECC", 5, 1, 19, 5, 1),
  R("SNG", 7, 1, 1, 6, 12), R("SNG", 7, 2, 14, 7, -1), R("ISA", 8, 23, 23, 9, -22), R("ISA", 9, 1, 20, 9, 1),
  R("ISA", 63, 19, 19, 63, 0), R("ISA", 64, 1, 11, 64, 1), R("JER", 8, 23, 23, 9, -22), R("JER", 9, 1, 25, 9, 1),
  R("EZK", 21, 1, 5, 20, 44), R("EZK", 21, 6, 37, 21, -5), R("DAN", 3, 31, 33, 4, -30), R("DAN", 4, 1, 34, 4, 3), R("DAN", 6, 1, 1, 5, 30), R("DAN", 6, 2, 29, 6, -1),
  R("HOS", 2, 1, 2, 1, 9), R("HOS", 2, 3, 25, 2, -2), R("HOS", 12, 1, 1, 11, 11), R("HOS", 12, 2, 15, 12, -1), R("HOS", 14, 1, 1, 13, 15), R("HOS", 14, 2, 10, 14, -1),
  R("JOL", 3, 1, 5, 2, 27), R("JOL", 4, 1, 21, 3, 0), R("JON", 2, 1, 1, 1, 16), R("JON", 2, 2, 11, 2, -1),
  R("MIC", 4, 14, 14, 5, -13), R("MIC", 5, 1, 14, 5, 1), R("NAM", 2, 1, 1, 1, 14), R("NAM", 2, 2, 14, 2, -1),
  R("ZEC", 2, 1, 4, 1, 17), R("ZEC", 2, 5, 17, 2, -4), R("MAL", 3, 19, 24, 4, -18),
];
const hebVersAnglais = { get(k) {
  const m = k.match(/^(\S+) (\d+):(\d+)$/), [code, c, v] = [m[1], +m[2], +m[3]];
  const e = ECARTS.find(([b, cc, v1, v2]) => b === code && cc === c && v >= v1 && v <= v2);
  return e ? [e[4], v + e[5]] : null;
} };
{
  const x = readFileSync(WEB, "utf8").replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, "").replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, "");
  for (const b of x.split(/<book id="/).slice(1)) {
    const code = b.slice(0, 3);
    for (const c of b.split(/<c id="/).slice(1)) {
      const n = parseInt(c), m = new Map();
      for (const v of c.split(/<v id="/).slice(1)) m.set(parseInt(v), v.replace(/^[^>]*>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      web.set(code + " " + n, m);
    }
  }
}
const VIDES = new Set("the and that shall unto with them their they for him his have from will which this you your thou thee thy hath said not was were are upon all also when then into who there been what out our may before over even shalt therefore because".split(" "));
const mots = t => new Set((t || "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, " ").split(" ").filter(w => w.length > 3 && !VIDES.has(w)));
const score = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.sqrt(a.size * b.size); };
const alignes = new Map();
// verset (numérotation moderne) → verset de la Vulgate, par comparaison WEB ↔ Douay-Rheims
function versVulgate(code, c, v) {
  if (NT.has(code)) return [c, v];
  if (code === "PSA") return psaume(c, v);
  if (code === "DAN" && (c === 3 || c >= 13)) return [c, v];          // ajouts grecs déjà numérotés comme la Vulgate
  const k = `${code} ${c}:${v}`;
  if (alignes.has(k)) return alignes.get(k);
  const ang = hebVersAnglais.get(k);
  if (ang) [c, v] = ang;
  const w = web.get(code + " " + c), t = w && mots(w.get(v));
  let best = [c, v], bs = -1;
  if (t && t.size) {
    const id = chap("en", code, c); bs = id ? score(t, mots(id.get(v))) : 0;
    if (bs < 0.6) for (const cc of [c - 1, c, c + 1]) {
      const d = chap("en", code, cc); if (!d) continue;
      for (const [vv, tx] of d) {
        const dist = cc === c ? Math.abs(vv - v) : cc < c ? v + (d.size - vv) : vv + ((chap("en", code, c)?.size || 0) - v);
        if (dist > 12) continue;
        const s = score(t, mots(tx)) - 0.02 * dist;                       // les formules répétées (« Dieu parla à Moïse ») ne doivent pas attirer loin
        if (s > bs + 0.15) { bs = s; best = [cc, vv]; }
      }
    }
  }
  alignes.set(k, best);
  return best;
}
function psaume(c, v) {                                               // hébreu → Vulgate (les titres comptent comme versets dans les deux)
  if (c <= 8 || c >= 148) return [c, v];
  if (c === 9) return [9, v];
  if (c === 10) return [9, v + 21];
  if (c <= 113) return [c - 1, v];
  if (c === 114) return [113, v];
  if (c === 115) return [113, v + 8];
  if (c === 116) return v <= 9 ? [114, v] : [115, v - 9];
  if (c <= 146) return [c - 1, v];
  return v <= 11 ? [146, v] : [147, v - 11];
}

// « Rev 14:1-3, 4b-5 » · « Ps 24:1bc-2, 3-4ab » · « Mark 2:23-3:6 » · « Rev 11:19A; 12:1-6A, 10AB » · « Rom 5:12-19 or 5:12, 17-19 »
function lecture(citation) {
  const [longue, ...autres] = citation.split(/\s+or\s+/);
  const m = longue.trim().replace(/\.$/, "").replace(/^Song of Songs/, "Song").replace(/\s*-\s*/g, "-").replace(/:\s+/g, ":").match(/^((?:\d\s)?[A-Za-z]+)\.?\s+(.*)$/);
  if (!m || !LIVRES[m[1]]) return null;
  const code = LIVRES[m[1]], vus = new Set(), versets = [];
  if (["TOB", "EST", "SIR"].includes(code)) return null;              // texte (ou versification) de la Vulgate trop différent du texte lu à la messe
  let c = ["PHM", "2JN", "3JN", "JUD", "OBA"].includes(code) ? 1 : null;
  const reste = m[2].replace(/\s+and\s+/g, ",").replace(/(\d+)-(\d+)(?:-(\d+))+/g, (x, a, ...r) => a + "-" + x.split("-").pop());
  for (let seg of reste.split(/[;,]/)) {
    seg = seg.trim().replace(/(\d)[a-zA-Z]+/g, "$1"); if (!seg) continue;
    const r = seg.match(/^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/); if (!r) return null;
    const c1 = r[1] ? +r[1] : c; if (c1 == null) return null;
    const v1 = +r[2], c2 = r[3] ? +r[3] : c1, v2 = r[4] ? +r[4] : v1;
    if (c2 === c1 && v2 < v1) return null;
    for (let cc = c1; cc <= c2; cc++) {
      const w = web.get((code === "PSA" ? "PSA" : code) + " " + cc), fin = cc === c2 ? v2 : (w ? Math.max(...w.keys()) : 200);
      for (let v = cc === c1 ? v1 : 1; v <= fin; v++) {
        const [vc, vv] = versVulgate(code, cc, v), k = vc + ":" + vv;
        if (!vus.has(k)) { vus.add(k); versets.push([vc, vv]); }
      }
    }
    c = c2;
  }
  const textes = versets.map(([vc, vv]) => { const ch = chap("fr", code, vc); return ch && ch.get(vv); }).filter(Boolean)
    .map(t => t.replace(/\s*\*\s*/g, " ").trim());
  if (!textes.length || textes.length < versets.length * 0.8) return null;
  const grecDaniel = code === "DAN" && versets.some(([vc, vv]) => (vc === 3 && vv > 23) || vc >= 13);
  if (!NT.has(code) && code !== "PSA" && !grecDaniel && !controle(code, m[2], versets)) return null;
  const premier = versets[0], dernier = versets.at(-1);
  return { code, livre: LIVRES_FR[code], ref_vulgate: `${premier[0]}:${premier[1]}–${dernier[0] !== premier[0] ? dernier[0] + ":" : ""}${dernier[1]}`, courte: autres.length > 0, fr: textes.join(" ") };
}

// Contrôle : le passage de la Douay-Rheims retenu doit ressembler au passage de la WEB demandé
let rejets = [], scores = [];
const SEUIL = +(process.env.SEUIL || 0.45);
function controle(code, refs, versets) {
  const a = new Set(), b = new Set();
  for (const [c, v] of versets) { const d = chap("en", code, c); for (const w of mots(d && d.get(v))) b.add(w); }
  for (const [k, cv] of alignes) if (k.startsWith(code + " ")) {}  // (cache)
  const att = attendu(code, refs);
  for (const t of att) for (const w of mots(t)) a.add(w);
  const s = score(a, b);
  scores.push(s);
  if (process.env.TOUT || s < SEUIL) rejets.push(`${code} ${refs} (${s.toFixed(2)}) → ${versets[0].join(":")} : ${(chap("fr", code, versets[0][0])?.get(versets[0][1]) || "").slice(0, 50)} | ${(att[0] || "").slice(0, 50)}`);
  return s >= SEUIL;
}
function attendu(code, refs) {      // textes WEB du passage demandé (numérotation hébraïque → anglaise)
  const out = []; let c = ["PHM", "2JN", "3JN", "JUD", "OBA"].includes(code) ? 1 : null;
  for (let seg of refs.replace(/\s+and\s+/g, ",").split(/[;,]/)) {
    seg = seg.trim().replace(/(\d)[a-zA-Z]+/g, "$1"); const r = seg.match(/^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/); if (!r) continue;
    const c1 = r[1] ? +r[1] : c, c2 = r[3] ? +r[3] : c1, v2 = r[4] ? +r[4] : +r[2];
    for (let cc = c1; cc <= c2; cc++) for (let v = cc === c1 ? +r[2] : 1; v <= (cc === c2 ? v2 : 200); v++) {
      let [ec, ev] = hebVersAnglais.get(`${code} ${cc}:${v}`) || [cc, v]; const t = web.get(code + " " + ec)?.get(ev); if (t) out.push(t); else if (cc !== c2) break;
    }
    c = c2;
  }
  return out;
}

// « Rev 14:1-3, 4b-5 » → « Apocalypse 14, 1-3. 4b-5 » (usage français)
function refFr(citation) {
  return citation.split(/\s+or\s+/).map((x, i) => {
    const m = x.trim().replace(/^Song of Songs/, "Song").replace(/:\s+/g, ":").match(/^((?:\d\s)?[A-Za-z]+)\.?\s+(.*)$/);
    const livre = m && LIVRES_FR[LIVRES[m[1]]];
    const reste = (m ? m[2] : x).replace(/\s*,\s*|\s+and\s+/g, ". ").replace(/\s*;\s*/g, " ; ").replace(/(\d+):/g, "$1, ").replace(/-(?=\d+,)/g, " – ");
    return (i ? "ou " : "") + (livre && i === 0 ? livre + " " : "") + reste;
  }).join(" ");
}

const TITRES = { "first-reading": "Première lecture", "responsorial-psalm": "Psaume", "second-reading": "Deuxième lecture", gospel: "Évangile", epistle: "Épître" };
const titreLecture = id => TITRES[id] || id.replace(/^old-testament-reading-(\d)$/, "Lecture $1 (Ancien Testament)").replace(/^old-testament-psalm-(\d)$/, "Psaume après la lecture $1");

// ---------- Jours ----------
const ambo = new Map();
for (let a = +DEBUT.slice(0, 4); a <= +FIN.slice(0, 4); a++) {
  const dir = `${AMBO}/${a}`;
  for (let n = fromIso(`${a}-01-01`); iso(n).startsWith(String(a)); n++) { const f = `${dir}/${iso(n)}.json`; if (existsSync(f)) ambo.set(iso(n), JSON.parse(readFileSync(f, "utf8"))); }
}
// France : Épiphanie et Saint-Sacrement le dimanche ; le jour « libéré » dans le calendrier général n'a pas de lectures fiables ici
const TRANSFERTS = [[/Épiphanie/, /^The Epiphany of the Lord$/], [/Saint-Sacrement/, /Body and Blood of Christ/], [/Baptême du Seigneur/, /^The Baptism of the Lord$/]];
// Féries entre l'Épiphanie et le Baptême : leurs lectures dépendent de la date de l'Épiphanie ; si elle diffère du calendrier général, on s'abstient
const trouve = (a, re, f) => { for (let n = fromIso(a + "-01-01"); n < fromIso(a + "-01-15"); n++) if (re.test(f(iso(n)) || "")) return n; return null; };
const fenetre = new Map();
function horsFenetre(date) {
  const a = date.slice(0, 4);
  if (!fenetre.has(a)) {
    const epiFr = trouve(a, /Épiphanie/, d => liturgie(fromIso(d)).titre), epiG = trouve(a, /^The Epiphany of the Lord$/, d => ambo.get(d)?.celebration.title.en);
    const bapFr = trouve(a, /Baptême du Seigneur/, d => liturgie(fromIso(d)).titre);
    fenetre.set(a, epiFr != null && epiG != null && epiFr !== epiG && bapFr ? [Math.min(epiFr, epiG), bapFr] : null);
  }
  const f = fenetre.get(a), n = fromIso(date);
  return !f || n <= f[0] || n >= f[1] || /Épiphanie/.test(liturgie(n).titre);
}
function source(date) {
  const L = liturgie(fromIso(date)), a = ambo.get(date);
  if (!a || !horsFenetre(date)) return null;
  for (const [fr, en] of TRANSFERTS) {
    const ici = fr.test(L.titre), la = en.test(a.celebration.title.en);
    if (ici && !la) { for (let k = -10; k <= 10; k++) { const b = ambo.get(iso(fromIso(date) + k)); if (b && en.test(b.celebration.title.en)) return b; } return null; }
    if (la && !ici) return null;
  }
  return a;
}

let jours = 0, lectures = 0, sans = 0, sansJour = [];
for (let n = fromIso(DEBUT); n <= fromIso(FIN); n++) {
  const date = iso(n), a = source(date);
  if (!a) { if (ambo.has(date)) sansJour.push(date); continue; }
  const ls = a.readings.map(r => {
    lectures++;
    const t = lecture(r.citation);
    if (!t) sans++;
    return { id: r.id, titre: titreLecture(r.id), ref: r.citation, ref_fr: refFr(r.citation), ...(t ? { livre: t.livre, ref_vulgate: t.ref_vulgate, courte: t.courte || undefined, fr: t.fr } : {}) };
  });
  writeFileSync(new URL(`jours/${date}.json`, OUT), JSON.stringify({ date, celebration_en: a.celebration.title.en, lectures: ls }));
  jours++;
}
writeFileSync(new URL("index.json", OUT), JSON.stringify({ du: DEBUT, au: FIN, jours, genere: new Date().toISOString().slice(0, 10), sans_lectures: sansJour,
  sources: ["Ambo Liturgical Calendars (MIT) — références des lectures", "Bible Fillion (domaine public) — texte des lectures", "World English Bible et Douay-Rheims (domaine public) — correspondance des numérotations"] }, null, 1));
console.log(`${jours} jours ; ${lectures} lectures, ${sans} sans texte ; jours sans lectures : ${sansJour.join(", ")}`);
console.log("Passages écartés au contrôle : " + rejets.join(" · "));
