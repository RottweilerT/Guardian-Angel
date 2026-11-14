// La Bible en quatre langues (textes du domaine public), lecture seule, hors ligne une fois ouverte.
// Route : #/bible/<version|tout>/<LIVRE>/<chapitre>/<verset?>
import { esc, $ } from "../ui.js";
import * as store from "../store.js";

const LANGUES = { fr: "Français", en: "English", la: "Latina" };
let indexP = null;
const cache = new Map();
const loadIndex = () => (indexP ||= fetch("/bible/index.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { indexP = null; throw e; }));
function loadBook(v, b) {
  const k = v + "/" + b;
  if (!cache.has(k)) cache.set(k, fetch(`/bible/${v}/${b}.json`).then(r => (r.ok ? r.json() : null)).catch(() => { cache.delete(k); return null; }));
  return cache.get(k);
}
const version = (ix, v) => ix.versions.find(x => x.code === v);
const livre = (ver, b) => ver && ver.livres.find(x => x[0] === b);

// « Mt 25, 1-13 ; Ps 62 » → liens vers la Bible (utilisé par le journal)
export async function passageLinks(text) {
  let ix; try { ix = await loadIndex(); } catch { return esc(text); }
  const ab = ix.abbr_fr || {};
  return esc(text).replace(/\b((?:[1-3]\s?)?[A-ZÉ][a-zéè]{0,4})\.?\s?(\d{1,3})(?:\s?[,:.]\s?(\d{1,3}))?/g, (m, a, c, v) => {
    const b = ab[a.replace(/\s/g, "")]; return b ? `<a href="#/bible/fr/${b}/${c}${v ? "/" + v : ""}">${m}</a>` : m;
  });
}

export default async function bible(el, params) {
  const last = store.prefs.get("bible", { v: "fr", b: "JHN", c: 1 }) || {};
  let [v = last.v || "fr", b = last.b || "JHN", c = last.c || 1, vs] = params;
  el.innerHTML = `<section class="hero"><div class="kicker">Écriture sainte</div><h1>La Bible</h1><span class="orn"></span></section><div class="skeleton"></div>`;
  let ix;
  try { ix = await loadIndex(); } catch { el.querySelector(".skeleton").outerHTML = `<div class="empty">La Bible n'a pas pu être chargée (hors ligne ?).</div>`; return; }
  if (!location.hash.startsWith("#/bible") && location.hash) return;
  const tout = v === "tout";
  if (!tout && !version(ix, v)) v = "fr";
  const ref = version(ix, tout ? "fr" : v);
  if (!livre(ref, b)) b = livre(ref, "JHN") ? "JHN" : ref.livres[0][0];
  const L = livre(ref, b), nch = L[2];
  c = Math.min(Math.max(parseInt(c, 10) || 1, 1), nch);
  store.prefs.set("bible", { v, b, c });
  const go = (nv, nb, nc) => { location.hash = `#/bible/${nv}/${nb}/${nc}`; };
  const at = ix.ordre.filter(x => !ix.nt.includes(x)), nt = ix.ordre.filter(x => ix.nt.includes(x));
  const opt = x => { const l = livre(ref, x); return l ? `<option value="${x}"${x === b ? " selected" : ""}>${esc(l[1])}${ix.deutero.includes(x) ? " *" : ""}</option>` : ""; };

  el.innerHTML = `<section class="hero"><div class="kicker">Écriture sainte</div><h1>La Bible</h1><span class="orn"></span></section>
  <div class="row" role="tablist" aria-label="Version">
    ${ix.versions.map(x => `<a class="btn ${x.code === v ? "" : "ghost"} sm" role="tab" aria-selected="${x.code === v}" href="#/bible/${x.code}/${b}/${c}">${LANGUES[x.code] || x.code}</a>`).join("")}
    <a class="btn ${tout ? "" : "ghost"} sm" role="tab" aria-selected="${tout}" href="#/bible/tout/${b}/${c}">Côte à côte</a>
  </div>
  <div class="row" style="margin-top:10px">
    <select id="bl" aria-label="Livre" style="flex:2;min-width:170px"><optgroup label="Ancien Testament">${at.map(opt).join("")}</optgroup><optgroup label="Nouveau Testament">${nt.map(opt).join("")}</optgroup></select>
    <select id="bc" aria-label="Chapitre" style="flex:1;min-width:90px">${Array.from({ length: nch }, (_, i) => `<option value="${i + 1}"${i + 1 === c ? " selected" : ""}>Chapitre ${i + 1}</option>`).join("")}</select>
  </div>
  <div id="btext" style="margin-top:14px"><div class="skeleton"></div></div>
  <div class="row between" style="margin-top:14px">
    <button class="btn ghost sm" id="bprev"${c <= 1 ? " disabled" : ""}>← Chapitre ${c - 1 || ""}</button>
    <button class="btn ghost sm" id="bnext"${c >= nch ? " disabled" : ""}>Chapitre ${c < nch ? c + 1 : ""} →</button>
  </div>
  <div class="notice small" style="margin-top:18px"><strong>Textes :</strong><br>${ix.versions.map(x => `${esc(LANGUES[x.code])} — ${esc(x.titre)}, ${esc(x.tradition)}. ${esc(x.licence)}.`).join("<br>")}
  <br>Trois traductions catholiques complètes (73 livres ; * = livre deutérocanonique), psaumes numérotés selon la Vulgate. Espagnol : aucune traduction catholique libre de droits n'est encore disponible sous forme numérique exploitable.</div>`;

  $("#bl", el).onchange = e => go(v, e.target.value, 1);
  $("#bc", el).onchange = e => go(v, b, e.target.value);
  $("#bprev", el).onclick = () => go(v, b, c - 1);
  $("#bnext", el).onclick = () => go(v, b, c + 1);

  const box = $("#btext", el);
  const num = x => `<sup class="muted" style="font-size:.7em;margin-right:3px">${esc(x)}</sup>`;
  if (!tout) {
    const ch = await loadBook(v, b);
    if (!document.body.contains(box)) return;
    const vv = ch && ch[c - 1];
    box.innerHTML = vv && vv.length ? `<h2 class="sec serif">${esc(livre(version(ix, v), b)[1])} ${c}</h2><div class="card serif" style="line-height:1.75" lang="${v}">
      ${vv.map(([n, t]) => `<span id="v${esc(n)}"${n === String(vs) ? ' style="background:var(--bg-soft);outline:2px solid var(--accent);border-radius:3px"' : ""}>${num(n)}${esc(t)} </span>`).join("")}</div>`
      : `<div class="empty">Ce chapitre n'est pas disponible dans cette version.</div>`;
  } else {
    const chs = await Promise.all(ix.versions.map(x => (livre(x, b) ? loadBook(x.code, b) : Promise.resolve(null))));
    if (!document.body.contains(box)) return;
    const per = ix.versions.map((x, i) => new Map(((chs[i] && chs[i][c - 1]) || []).map(([n, t]) => [n, t])));
    const nums = [...new Set(per.flatMap(m => [...m.keys()]))].sort((a, z) => parseInt(a, 10) - parseInt(z, 10) || a.localeCompare(z));
    box.innerHTML = `<h2 class="sec serif">${esc(L[1])} ${c}</h2>` + (nums.length ? nums.map(n => `<div class="card" id="v${esc(n)}" style="padding:10px 14px${n === String(vs) ? ";outline:2px solid var(--accent)" : ""}">
      <div class="small muted" style="margin-bottom:4px">Verset ${esc(n)}</div>
      ${ix.versions.map((x, i) => `<p class="serif" lang="${x.code}" style="margin:4px 0"><span class="chip" style="margin-right:6px">${x.code.toUpperCase()}</span>${per[i].has(n) ? esc(per[i].get(n)) : `<span class="muted small">${livre(x, b) ? "—" : "livre absent de cette version"}</span>`}</p>`).join("")}</div>`).join("")
      : `<div class="empty">Chapitre indisponible.</div>`);
  }
  if (vs) { const t = document.getElementById("v" + vs); if (t) t.scrollIntoView({ block: "center" }); }
}
