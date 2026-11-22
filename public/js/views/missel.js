import { esc, $, today, frDate } from "../ui.js";
import { liturgie, fromIso, iso, COUL } from "../liturgie-romain.js";
import { liturgie1962 } from "../liturgie-1962.js";
import { ETAPES } from "../messe-etapes.js";
import { ordo1962, jour1962, rendu1962 } from "../missel1962.js";
import * as store from "../store.js";

const seg = (id, opts, cur) => `<div class="seg" id="${id}" role="group">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;

export default async function missel(el, [dateP]) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateP || "") ? dateP : today();
  const n = fromIso(date);
  const cal = store.prefs.get("calendrier", "romain");
  const L = cal === "m1962" ? liturgie1962(n) : liturgie(n);
  const favJ = store.prefs.get("favJours", []) || [], isFav = favJ.includes(date);
  // Forme extraordinaire : données jour par jour du missel de 1962 (si la date est couverte)
  const [O, J] = cal === "m1962" ? await Promise.all([ordo1962(), jour1962(date)]) : [null, null];
  if (J) {
    L.titre = J.titre_fr || J.titre_la || L.titre; L.sousTitre = J.titre_la;
    if (J.couleurs && J.couleurs[0]) L.couleur = J.couleurs[0];
    if (J.classe) L.classe = J.classe;
  }
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
    ${seg("scal", [["romain", "Forme ordinaire"], ["m1962", "Forme extraordinaire"]], cal)}
    <button class="btn gold sm" id="bfav" aria-pressed="${isFav}">${isFav ? "★ Favori" : "☆ Favori"}</button>
  </div>
  ${date !== today() ? `<p class="center small"><a href="#/missel">Revenir à aujourd'hui</a></p>` : ""}
  ${L.pasDeMesse ? `<div class="notice">Aujourd'hui, on ne célèbre pas la messe : l'Église commémore la Passion du Seigneur.</div>` : ""}`;
  const mc = store.prefs.get("messeEnCours", null), enCours = mc && mc.date === date ? mc : null;
  if (enCours) h += `<div class="notice small" style="margin-top:10px">⛪ Vous assistez à la messe à <strong>${esc(enCours.eglise)}</strong> — enregistrée dans votre journal. <a href="#/journal/e/${encodeURIComponent(enCours.id)}">Prendre des notes</a></div>`;
  const liensSermon = `<a href="#/sermon">🎙 Enregistrer</a> · <a href="${enCours ? "#/journal/e/" + encodeURIComponent(enCours.id) : "#/journal/nouveau"}">Prendre des notes</a>`;
  if (O && J && J.messes && J.messes.length) {
    const choix = store.prefs.get("messe1962", null), k = choix && choix.date === date ? Math.min(+choix.k || 0, J.messes.length - 1) : 0;
    if (J.commemoraisons && J.commemoraisons.length) h += `<p class="center small" style="margin-top:8px">Commémoraison : ${J.commemoraisons.map(c => esc(c.titre_fr)).join(" · ")}</p>`;
    if (J.messes.length > 1) h += `<div class="row" style="justify-content:center;margin-top:8px">${seg("smesse", J.messes.map((m, i) => [String(i), m.titre_fr || m.titre_la || "Messe " + (i + 1)]), String(k))}</div>`;
    h += `<div class="missel">${rendu1962(O, J.messes[k], { liens: liensSermon })}</div>
    <p class="small muted center" style="margin-top:14px">Textes latins : Divinum Officium et Missale Meum (domaine public, logiciels sous licence MIT). Lectures en français : Bible de l'abbé Fillion (domaine public). Calendrier universel de 1962 : les fêtes propres à un diocèse ou une communauté ne sont pas indiquées.</p>`;
    el.innerHTML = h;
    const sm = $("#smesse", el);
    if (sm) sm.onclick = e => { const v = e.target.dataset.v; if (v != null) { store.prefs.setQuiet("messe1962", { date, k: +v }); missel(el, [date]); } };
    brancher();
    return;
  }
  const F = ETAPES[cal === "m1962" ? "extraordinaire" : "ordinaire"];
  let num = 0;
  h += `<section class="center" style="margin:14px 0 4px"><h2 class="serif" style="margin:0">${esc(F.titre)}</h2><p class="small muted" style="margin:2px 0 0">${esc(F.sousTitre)}</p></section>
  <div class="notice small">Déroulement de la messe : les textes de chaque étape seront ajoutés plus tard.</div>`;
  for (const [section, etapes] of F.sections) {
    h += `<h2 class="sec">${esc(section)}</h2><ol class="list">`;
    for (const [titre, latin, quand] of etapes) {
      num++;
      const lien = /^(Homélie|Sermon)$/.test(titre) ? ` <a class="small" href="#/sermon">🎙 Enregistrer</a> · <a class="small" href="${enCours ? "#/journal/e/" + encodeURIComponent(enCours.id) : "#/journal/nouveau"}">Prendre des notes</a>` : "";
      h += `<li style="padding:8px 0;display:flex;gap:10px"><span class="muted small" style="min-width:1.6em;text-align:right">${num}.</span><span><strong class="serif">${esc(titre)}</strong>${latin && latin !== titre ? ` <em class="muted small" lang="la">— ${esc(latin)}</em>` : ""}${lien}${quand ? `<br><span class="small muted">${esc(quand)}</span>` : ""}</span></li>`;
    }
    h += `</ol>`;
  }
  el.innerHTML = h;
  brancher();
  function brancher() {
  $("#scal", el).onclick = e => { const v = e.target.dataset.v; if (v) { store.prefs.set("calendrier", v); missel(el, [date]); } };
  $("#md", el).onchange = e => { if (e.target.value) location.hash = "#/missel/" + e.target.value; };
  $("#bfav", el).onclick = () => { store.prefs.set("favJours", isFav ? favJ.filter(x => x !== date) : [...favJ, date]); missel(el, [date]); };
  }
}
