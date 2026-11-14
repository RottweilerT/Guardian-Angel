import { esc, today, frDate } from "../ui.js";
import { liturgie, fromIso, COUL } from "../liturgie-romain.js";
import { liturgie1962 } from "../liturgie-1962.js";
import * as store from "../store.js";

export default function accueil(el) {
  const cal = store.prefs.get("calendrier", "romain");
  const L = cal === "m1962" ? liturgie1962(fromIso(today())) : liturgie(fromIso(today()));
  const j = store.list("journal").length, v = store.list("visits").length;
  el.innerHTML = `
  <section class="hero">
    <div class="kicker">${esc(frDate(today()))}</div>
    <h1>${esc(L.titre)}</h1>
    <p><span class="chip"><span class="dot" style="background:${COUL[L.couleur] || "#333"}"></span>${esc(L.couleur)}</span> <span class="chip">${esc(L.temps)}</span> <span class="chip">${cal === "m1962" ? "Missel de 1962" : "Missel romain actuel"}</span></p>
    <span class="orn"></span>
  </section>
  <form class="row" id="q" role="search">
    <input type="search" name="q" placeholder="Rechercher une église à Paris…" aria-label="Rechercher une église" style="flex:1;min-width:200px">
    <button class="btn">Rechercher</button>
  </form>
  <div class="grid" style="margin-top:16px">
    <a class="card" href="#/missel"><h3>Missel du jour</h3><p class="muted small">Ordinaire de la messe en latin, calendrier actuel ou de 1962, explications.</p></a>
    <a class="card" href="#/carte"><h3>Carte des églises</h3><p class="muted small">Églises de Paris (OpenStreetMap), recherche par rue, sites des paroisses.</p></a>
    <a class="card" href="#/bible"><h3>La Bible</h3><p class="muted small">En français, anglais, espagnol et latin, et les quatre côte à côte.</p></a>
    <a class="card" href="#/journal"><h3>Journal spirituel</h3><p class="muted small">${j ? j + " entrée" + (j > 1 ? "s" : "") : "Notes de messe, passages, intentions"} — privé.</p></a>
    <a class="card" href="#/passeport"><h3>Passeport des églises</h3><p class="muted small">${v ? v + " église" + (v > 1 ? "s" : "") + " visitée" + (v > 1 ? "s" : "") : "Gardez la mémoire de vos visites"} et parcours de découverte.</p></a>
    <a class="card" href="#/missions"><h3>Missions paroissiales</h3><p class="muted small">Proposer son aide aux paroisses : chorale, accueil, maraudes…</p></a>
    <a class="card" href="#/sources"><h3>Sources et droits</h3><p class="muted small">D'où viennent les données et les textes, et sous quelles licences.</p></a>
  </div>
  <div class="notice small" style="margin-top:20px"><strong>Célébrations à venir :</strong> les horaires de messes ne sont pas encore intégrés (aucune source ouverte vérifiée). Consultez le site de chaque paroisse depuis sa fiche.</div>`;
  el.querySelector("#q").onsubmit = e => { e.preventDefault(); location.hash = "#/carte/" + encodeURIComponent(new FormData(e.target).get("q") || ""); };
}
