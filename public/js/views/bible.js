// La Bible en quatre langues (textes du domaine public), lecture seule, hors ligne une fois ouverte.
// Route : #/bible/<version|tout>/<LIVRE>/<chapitre>/<verset?>
import { esc, $ } from "../ui.js";
import * as store from "../store.js";
import { cloud } from "../cloud.js";
import { modal, toast } from "../ui.js";

const LANGUES = { fr: "Français", en: "English", es: "Español", la: "Latin" };
const MANQUE = `<span class="muted small">[verset pas encore transcrit]</span>`;
// Verset espagnol manquant : on montre le latin de la Vulgate, dont Torres Amat est la traduction
const LATIN = t => `<em lang="la">${esc(t)}</em> <span class="chip" style="font-size:11px" title="Verset espagnol pas encore transcrit : texte latin de la Vulgate">latin</span>`;
let indexP = null;
const cache = new Map();
const loadIndex = () => (indexP ||= fetch("/bible/index.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { indexP = null; throw e; }));
// Un fichier par chapitre (quelques Ko) : rien d'autre n'est téléchargé
function loadChap(v, b, c) {
  const k = `${v}/${b}/${c}`;
  if (!cache.has(k)) cache.set(k, fetch(`/bible/${k}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null).then(x => { if (!x) cache.delete(k); return x; }));
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
  const cote = (store.prefs.get("bibleCote", null) || ["fr", "en", "es", "la"]).filter(x => version(ix, x));
  if (!tout && !version(ix, v)) v = "fr";
  const ref = version(ix, tout ? "fr" : v);
  if (!livre(ref, b)) b = livre(ref, "JHN") ? "JHN" : ref.livres[0][0];
  const L = livre(ref, b), nch = L[2];
  c = Math.min(Math.max(parseInt(c, 10) || 1, 1), nch);
  store.prefs.setQuiet("bible", { v, b, c });
  const go = (nv, nb, nc) => { location.hash = `#/bible/${nv}/${nb}/${nc}`; };
  const at = ix.ordre.filter(x => !ix.nt.includes(x)), nt = ix.ordre.filter(x => ix.nt.includes(x));
  const opt = x => { const l = livre(ref, x); return l ? `<option value="${x}"${x === b ? " selected" : ""}>${esc(l[1])}${ix.deutero.includes(x) ? " *" : ""}</option>` : ""; };

  el.innerHTML = `<section class="hero"><div class="kicker">Écriture sainte</div><h1>La Bible</h1><span class="orn"></span></section>
  <div class="row" role="tablist" aria-label="Version">
    ${ix.versions.map(x => `<a class="btn ${x.code === v ? "" : "ghost"} sm" role="tab" aria-selected="${x.code === v}" href="#/bible/${x.code}/${b}/${c}">${LANGUES[x.code] || x.code}</a>`).join("")}
    <a class="btn ${tout ? "" : "ghost"} sm" role="tab" aria-selected="${tout}" href="#/bible/tout/${b}/${c}">Côte à côte</a>
  </div>
  ${tout ? `<div class="row" style="margin-top:10px;align-items:center" role="group" aria-label="Langues à comparer"><span class="small muted">Langues :</span>
    ${ix.versions.map(x => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-lg="${x.code}"${cote.includes(x.code) ? " checked" : ""} style="width:auto;margin:0 4px 0 0">${esc(LANGUES[x.code] || x.code)}</label>`).join("")}</div>` : ""}
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
  <br>Quatre traductions catholiques (73 livres ; * = livre deutérocanonique), psaumes numérotés selon la Vulgate.</div>`;

  el.querySelectorAll("[data-lg]").forEach(cb => cb.onchange = () => {
    const sel = [...el.querySelectorAll("[data-lg]:checked")].map(x => x.dataset.lg);
    if (!sel.length) { cb.checked = true; return; }             // au moins une langue
    store.prefs.setQuiet("bibleCote", sel); bible(el, [v, b, c, vs].filter(x => x !== undefined));
  });
  $("#bl", el).onchange = e => go(v, e.target.value, 1);
  $("#bc", el).onchange = e => go(v, b, e.target.value);
  $("#bprev", el).onclick = () => go(v, b, c - 1);
  $("#bnext", el).onclick = () => go(v, b, c + 1);

  const box = $("#btext", el);
  const num = x => `<sup class="muted" style="font-size:.7em;margin-right:3px">${esc(x)}</sup>`;
  if (!tout) {
    const [vv, chLa] = await Promise.all([loadChap(v, b, c), v === "es" ? loadChap("la", b, c) : Promise.resolve(null)]);
    if (!document.body.contains(box)) return;
    const la = new Map(chLa || []);
    const avis = v === "es" ? `<div class="notice small">Transcription automatique de l'édition de 1882, complétée et corrigée en comparant 22 éditions numérisées. Il peut rester des coquilles ; les rares versets non encore transcrits sont donnés en latin (Vulgate), signalés « latin ».</div>` : "";
    box.innerHTML = vv && vv.length ? avis + `<h2 class="sec serif">${esc(livre(version(ix, v), b)[1])} ${c}</h2><div class="card serif" style="line-height:1.75" lang="${v}">
      ${vv.map(([n, t]) => `<span id="v${esc(n)}"${n === String(vs) ? ' style="background:var(--bg-soft);outline:2px solid var(--accent);border-radius:3px"' : ""}>${num(n)}${t ? esc(t) : la.get(n) ? LATIN(la.get(n)) : MANQUE} </span>`).join("")}</div>`
      : `<div class="empty">Ce chapitre n'est pas disponible dans cette version.</div>`;
    if (v === "es" && vv && vv.length) {
      box.insertAdjacentHTML("beforeend", `<p class="small"><button class="btn ghost sm" id="bcoq">Signaler une coquille</button></p>`);
      $("#bcoq", el).onclick = async () => {
        if (!cloud.user) { toast("Connectez-vous (Profil) pour signaler une coquille"); return; }
        const r = await modal(`<h2>Signaler une coquille</h2><p class="small muted">${esc(livre(version(ix, v), b)[1])} ${c}</p>
          <label for="cv">Verset</label><select id="cv">${vv.map(([n]) => `<option${n === String(vs) ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>
          <label for="cm">Texte corrigé ou description de l'erreur</label><textarea id="cm" maxlength="1500" required></textarea>
          <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-close="x">Annuler</button><button class="btn" id="cok">Envoyer</button></div>`,
          (d, done) => { $("#cok", d).onclick = () => { const t = $("#cm", d).value.trim(); if (t) done(JSON.stringify({ n: $("#cv", d).value, t })); }; });
        if (!r || r === "x") return;
        const { n, t } = JSON.parse(r);
        try { const { fs, db, user } = cloud; await fs.addDoc(fs.collection(db, "reports"), { uid: user.uid, churchId: `bible:es:${b}.${c}.${n}`.slice(0, 40), churchName: `Bible Torres Amat ${b} ${c},${n}`, message: t, status: "nouveau", createdAt: fs.serverTimestamp() }); toast("Merci, signalement envoyé"); }
        catch { toast("Envoi impossible"); }
      };
    }
  } else {
    // Côte à côte : un panneau par langue, on glisse à gauche ou à droite pour changer de langue
    const vers = ix.versions.filter(x => cote.includes(x.code) && livre(x, b));
    const [chs, chLa] = await Promise.all([Promise.all(vers.map(x => loadChap(x.code, b, c))), loadChap("la", b, c)]);
    if (!document.body.contains(box)) return;
    const la = new Map(chLa || []), hl = n => n === String(vs) ? ' style="background:var(--bg-soft);outline:2px solid var(--accent);border-radius:3px"' : "";
    const absents = ix.versions.filter(x => cote.includes(x.code) && !livre(x, b));
    const panneau = (x, vv) => `<section class="slide" data-lg="${x.code}" lang="${x.code}" aria-label="${esc(LANGUES[x.code] || x.code)}">
      <h2 class="sec serif">${esc(livre(x, b)[1])} ${c}</h2>
      ${vv && vv.length ? `<div class="card serif" style="line-height:1.75">${vv.map(([n, t]) => `<span data-v="${esc(n)}"${hl(n)}>${num(n)}${t ? esc(t) : la.get(n) ? LATIN(la.get(n)) : MANQUE} </span>`).join("")}</div>` : `<div class="empty">Chapitre indisponible.</div>`}</section>`;
    const depart = Math.max(0, vers.findIndex(x => x.code === store.prefs.get("bibleSlide", "fr")));
    box.innerHTML = vers.length ? `
      <div class="row" role="tablist" aria-label="Langue affichée" style="justify-content:center">${vers.map((x, k) => `<button class="btn ${k === depart ? "" : "ghost"} sm" role="tab" data-go="${k}" aria-selected="${k === depart}">${esc(LANGUES[x.code] || x.code)}</button>`).join("")}</div>
      <p class="small muted center" style="margin:6px 0 0">Glissez vers la gauche ou la droite pour changer de langue</p>
      <div class="slides" id="slides">${vers.map((x, k) => panneau(x, chs[k])).join("")}</div>
      <div class="dots" aria-hidden="true">${vers.map((_, k) => `<span${k === depart ? ' class="on"' : ""}></span>`).join("")}</div>
      ${absents.length ? `<p class="small muted center">Livre absent : ${absents.map(x => esc(LANGUES[x.code])).join(", ")}</p>` : ""}`
      : `<div class="empty">Ce livre n'existe dans aucune des langues choisies.</div>`;
    const sl = $("#slides", el);
    if (sl) {
      const tabs = [...box.querySelectorAll("[data-go]")], dots = [...box.querySelectorAll(".dots span")];
      const actif = k => { tabs.forEach((t, i) => { t.classList.toggle("ghost", i !== k); t.setAttribute("aria-selected", i === k); }); dots.forEach((d, i) => d.classList.toggle("on", i === k)); store.prefs.setQuiet("bibleSlide", vers[k].code); };
      sl.scrollLeft = depart * sl.clientWidth;
      let tm; sl.addEventListener("scroll", () => { clearTimeout(tm); tm = setTimeout(() => actif(Math.round(sl.scrollLeft / sl.clientWidth)), 80); }, { passive: true });
      tabs.forEach(t => t.onclick = () => sl.scrollTo({ left: +t.dataset.go * sl.clientWidth, behavior: "smooth" }));
      if (vs) { const t = sl.querySelectorAll(`.slide`)[depart]?.querySelector(`[data-v="${CSS.escape(String(vs))}"]`); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - innerHeight / 3 }); }
    }
    return;
  }
  if (vs) { const t = document.getElementById("v" + vs); if (t) t.scrollIntoView({ block: "center" }); }
}
