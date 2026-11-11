import { esc, $, today, frDate, fetchJson } from "../ui.js";
import { liturgie, fromIso, iso, COUL } from "../liturgie-romain.js";
import { liturgie1962 } from "../liturgie-1962.js";
import { ORDO, NOTE_FR } from "../ordo.js";
import * as store from "../store.js";

const lines = arr => arr.map(l => l.startsWith("R:") ? `<p class="r">${esc(l.slice(2))}</p>` : l.startsWith("V:") ? `<p class="v">${esc(l.slice(2))}</p>` : l.startsWith("!") ? `<p class="rub" lang="fr">${esc(l.slice(1))}</p>` : `<p>${esc(l)}</p>`).join("");
const TYPES = { lecture1: "lecture1", psaume: "psaume", lecture2: "lecture2", evangile: "evangile" };
const seg = (id, opts, cur) => `<div class="seg" id="${id}" role="group">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;

export default async function missel(el, [dateP]) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateP || "") ? dateP : today();
  const n = fromIso(date);
  const cal = store.prefs.get("calendrier", "romain"), langue = store.prefs.get("langue", "bi"), taille = store.prefs.get("taille", 1);
  const L = cal === "m1962" ? liturgie1962(n) : liturgie(n);
  const favJ = store.prefs.get("favJours", []) || [], isFav = favJ.includes(date);
  const classe = cal === "m1962" ? L.classe + (L.classe === 1 ? "re" : "e") + " classe" : ({ solennite: "Solennité", fete: "Fête", memoire: "Mémoire", dimanche: "Dimanche", defunts: "Commémoration", triduum: "Triduum pascal" }[L.rang] || "Férie");

  let h = `<div class="band" style="background:${COUL[L.couleur] || "#333"}"></div>
  <section class="hero" style="margin-bottom:12px">
    <div class="row" style="justify-content:center">
      <a class="btn ghost sm" href="#/missel/${iso(n - 1)}" aria-label="Jour précédent">‹</a>
      <label style="margin:0;position:relative"><span class="kicker" style="margin:0">${esc(frDate(date))}</span><input type="date" id="md" value="${date}" aria-label="Choisir une date" style="position:absolute;inset:0;opacity:0"></label>
      <a class="btn ghost sm" href="#/missel/${iso(n + 1)}" aria-label="Jour suivant">›</a>
    </div>
    <h1 style="margin-top:8px">${esc(L.titre)}</h1>
    ${L.sousTitre && L.sousTitre !== L.titre ? `<p>${esc(L.sousTitre)}</p>` : ""}
    <p><span class="chip"><span class="dot" style="background:${COUL[L.couleur] || "#333"}"></span>${esc(L.couleur)}</span> <span class="chip">${esc(L.temps)}</span> <span class="chip">${esc(classe)}</span>${cal === "romain" ? ` <span class="chip">Année ${L.annee}</span>` : ""}</p>
    <span class="orn"></span>
  </section>
  <div class="row" style="justify-content:center">
    ${seg("scal", [["romain", "Missel actuel"], ["m1962", "Missel de 1962"]], cal)}
    ${seg("slang", [["la", "Latin"], ["bi", "Bilingue"], ["fr", "Français"]], langue)}
    <div class="seg" role="group" aria-label="Taille du texte"><button id="tm" aria-label="Texte plus petit">A−</button><button id="tp" aria-label="Texte plus grand">A+</button></div>
    <button class="btn gold sm" id="bfav" aria-pressed="${isFav}">${isFav ? "★ Favori" : "☆ Favori"}</button>
  </div>
  ${date !== today() ? `<p class="center small"><a href="#/missel">Revenir à aujourd'hui</a></p>` : ""}
  ${L.pasDeMesse ? `<div class="notice">Aujourd'hui, on ne célèbre pas la messe : l'Église commémore la Passion du Seigneur.</div>` : ""}
  ${L.note ? `<div class="notice small">${esc(L.note)}</div>` : ""}
  <div class="notice rights small">Calendrier calculé automatiquement${cal === "m1962" ? " (temporal et fêtes de 1re et 2e classe uniquement ; fêtes de 3e classe, commémoraisons et calendriers propres non pris en compte)" : " (calendrier général et propre de France ; mémoires de saints non prises en compte)"}. La date ne suffit pas toujours à déterminer la messe célébrée : fiez-vous à l'ordo de votre paroisse.</div>
  <div class="missel${langue === "bi" ? " bi" : ""}" id="mz" style="--lecture:${taille}">`;

  let sec = "";
  for (const p of ORDO[cal]) {
    if (p.cond && !L[p.cond]) continue;
    if (p.section !== sec) { sec = p.section; h += `<h2>${esc(sec)}</h2>`; }
    const la = p.la ? `<div class="la" lang="la">${lines(p.la)}</div>` : "";
    const fr = `<div class="notice rights small" lang="fr">${esc(NOTE_FR)}</div>`;
    let body = p.explication ? `<p class="expl" lang="fr">${esc(p.explication)}</p>` : "";
    if (p.id === "homelie") body += `<p class="expl"><a href="#/journal/nouveau">Prendre des notes dans mon journal</a></p>`;
    else if (p.propre) body += `<div data-propre="${p.id}"></div><div class="notice rights small">${esc(p.manque)}</div>`;
    else {
      const showLa = langue !== "fr" && la, showFr = langue !== "la" && p.la;
      body += `<div data-propre="${p.id}"></div><div class="cols">${showLa ? la : ""}${showFr ? fr : ""}</div>`;
      if (p.manque) body += `<div class="notice rights small">${esc(p.manque)}</div>`;
    }
    h += `<details open><summary>${esc(p.titre)}</summary><div class="body">${body}</div></details>`;
  }
  h += `</div><p class="small muted center" style="margin-top:20px">Textes latins anciens du domaine public, à collationner sur une édition de référence. Les explications sont des textes originaux de l'application, non des textes liturgiques. <a href="#/sources">Sources et droits</a></p>`;
  el.innerHTML = h;

  const on = (id, key) => { $("#" + id, el).onclick = e => { const v = e.target.dataset.v; if (v) { store.prefs.set(key, v); missel(el, [date]); } }; };
  on("scal", "calendrier"); on("slang", "langue");
  const size = d => { const t = Math.min(1.5, Math.max(0.85, +(taille + d).toFixed(2))); store.prefs.set("taille", t); missel(el, [date]); };
  $("#tm", el).onclick = () => size(-0.1); $("#tp", el).onclick = () => size(0.1);
  $("#md", el).onchange = e => { if (e.target.value) location.hash = "#/missel/" + e.target.value; };
  $("#bfav", el).onclick = () => { store.prefs.set("favJours", isFav ? favJ.filter(x => x !== date) : [...favJ, date]); missel(el, [date]); };

  // Références bibliques du jour (missel actuel) : faits + résumés originaux, jamais le texte liturgique.
  if (cal === "romain") {
    const j = await fetchJson("/data/lectures/" + date + ".json");
    if (j && Array.isArray(j.lectures)) j.lectures.forEach(l => {
      const slot = el.querySelector(`[data-propre="${TYPES[l.type] || ""}"]`);
      if (slot) slot.innerHTML = `<p><strong>Référence :</strong> ${esc(l.ref || "")}</p>${l.resume ? `<p class="expl">Résumé rédigé pour l'application (ce n'est pas le texte liturgique) : ${esc(l.resume)}</p>` : ""}`;
    });
  }
}
