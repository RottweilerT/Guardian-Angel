import { esc, $, frDate, fetchJson, loadChurches, churchLabel, norm } from "../ui.js";
import * as store from "../store.js";

let routesP = null;
const loadRoutes = () => (routesP = routesP || fetchJson("/data/routes.json").then(j => (j && j.routes) || []));
const match = (list, stop) => list.find(c => c.name && stop.match.some(m => norm(c.name).includes(norm(m))));

export default async function passeport(el) {
  const visits = store.list("visits").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  el.innerHTML = `
  <section class="hero"><div class="kicker">Mémoire de mes visites</div><h1>Passeport des églises</h1>
    <p>${visits.length ? visits.length + " église" + (visits.length > 1 ? "s" : "") + " visitée" + (visits.length > 1 ? "s" : "") : "Marquez une église comme visitée depuis sa fiche."}</p><span class="orn"></span></section>
  ${visits.length ? `<ul class="list">${visits.map(v => `<li><a href="#/eglise/${encodeURIComponent(v.churchId)}" class="serif" style="text-decoration:none;color:inherit"><strong>${esc(v.nom)}</strong></a>
     <br><span class="small muted">${esc(frDate(v.date))}</span>${v.note ? `<p class="small" style="white-space:pre-wrap;margin:4px 0 0">${esc(v.note)}</p>` : ""}</li>`).join("")}</ul>`
    : `<div class="empty">Aucune visite enregistrée. <a href="#/carte">Ouvrir la carte</a></div>`}
  <h2 class="sec">Parcours de découverte</h2><div id="pr"><div class="skeleton"></div></div>
  <p class="small muted">Vos visites sont privées. Pas de points ni de classement : un simple carnet. L'ajout de photographies n'est pas encore disponible.</p>`;
  const routes = await loadRoutes();
  const box = $("#pr", el); if (!box) return;
  box.innerHTML = routes.length ? `<div class="grid">${routes.map(r => `<a class="card" href="#/parcours/${esc(r.id)}"><h3>${esc(r.titre)}</h3><p class="small muted">${esc(r.resume)}</p><span class="chip">${r.etapes.length} étapes</span></a>`).join("")}</div>` : `<div class="empty">Parcours indisponibles.</div>`;
}

export async function parcours(el, [id]) {
  el.innerHTML = `<div class="skeleton" style="margin-top:30px"></div>`;
  const [routes, { list }] = await Promise.all([loadRoutes(), loadChurches()]);
  const r = routes.find(x => x.id === id);
  if (!r) { el.innerHTML = `<div class="empty">Parcours introuvable. <a href="#/passeport">Retour</a></div>`; return; }
  el.innerHTML = `
  <section class="hero"><div class="kicker">Parcours</div><h1>${esc(r.titre)}</h1><p>${esc(r.resume)}</p><span class="orn"></span></section>
  <ol class="list">${r.etapes.map((s, i) => { const c = match(list, s), v = c && store.get("visits", c.id); return `<li>
    <span class="chip">${i + 1}</span> <strong class="serif">${esc(s.nom)}</strong> ${v ? '<span class="chip">visitée</span>' : ""}
    <p class="small" style="margin:6px 0">${esc(s.texte)}</p>
    ${c ? `<a class="btn ghost sm" href="#/eglise/${encodeURIComponent(c.id)}">Voir la fiche</a>` : '<span class="small muted">Fiche non reliée aux données de la carte.</span>'}</li>`; }).join("")}</ol>
  <div class="notice rights small">Textes de présentation rédigés pour l'application (contenu éditorial original, à faire relire). Aucune photographie tierce n'est utilisée. Itinéraire tracé sur carte : à venir.</div>
  <p><a href="#/passeport">← Passeport</a></p>`;
}
