import { esc, $, toast, loadChurches, churchLabel, arrLabel, km, norm, safeUrl, modal, today, frDate } from "../ui.js";
import * as store from "../store.js";
import { cloud } from "../cloud.js";

const F = { q: "", arr: "", conf: "catholiques", horaires: false, pmr: false, fav: false, here: null, hereLabel: "", limit: 40 };
const ATTR = "© les contributeurs d'<a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a>";
let ruesP = null;
const loadRues = () => (ruesP ||= fetch("/data/rues.json").then(r => (r.ok ? r.json() : { rues: [] })).then(j => j.rues || []).catch(() => { ruesP = null; return []; }));
export const CONF = { catholique: "catholique", catholic: "catholique", roman_catholic: "catholique", greek_catholic: "catholique de rite byzantin",
  coptic_catholic: "copte catholique", maronite: "maronite (catholique)", protestant: "protestante", lutheran: "luthérienne", reformed: "réformée",
  evangelical: "évangélique", baptist: "baptiste", anglican: "anglicane", presbyterian: "presbytérienne", orthodox: "orthodoxe",
  russian_orthodox: "orthodoxe russe", greek_orthodox: "orthodoxe grecque", serbian_orthodox: "orthodoxe serbe", armenian_apostolic: "apostolique arménienne",
  seventh_day_adventist: "adventiste", jehovahs_witness: "Témoins de Jéhovah", liberal_catholic: "catholique libérale (hors communion romaine)",
  mariavite: "mariavite (hors communion romaine)", quaker: "quaker", christian_community: "Communauté des chrétiens",
  methodist: "méthodiste", free_evangelical: "évangélique libre", romanian_orthodox: "orthodoxe roumaine", latter_day_saints: "mormone (Saints des Derniers Jours)" };
const confLabel = c => (c.denomination ? CONF[c.denomination] || c.denomination.replace(/_/g, " ") : "confession non renseignée");
let leafletP = null, map = null, layer = null;
function loadLeaflet() {
  if (!leafletP) leafletP = new Promise((res, rej) => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/vendor/leaflet/leaflet.css"; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = "/vendor/leaflet/leaflet.js"; s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error("carte indisponible")); };
    document.head.appendChild(s);
  });
  return leafletP;
}
const favs = () => store.prefs.get("favEglises", []) || [];
function filtered(list) {
  const q = norm(F.q), fv = favs();
  let r = list.filter(c => (F.conf !== "catholiques" || c.catholique !== false) && (!q || norm(c.name + " " + (c.address || "")).includes(q)) && (!F.arr || String(c.arr) === F.arr)
    && (!F.horaires || c.serviceTimes) && (!F.pmr || c.wheelchair === "yes") && (!F.fav || fv.includes(c.id)));
  if (F.here) r = r.map(c => ({ ...c, _d: km(F.here, c) })).sort((a, b) => a._d - b._d);
  else r = r.slice().sort((a, b) => churchLabel(a).localeCompare(churchLabel(b), "fr"));
  return r;
}

export default async function carte(el, params) {
  if (params && params[0] !== undefined && params[0] !== F._p) { F.q = params[0]; F._p = params[0]; }
  el.innerHTML = `<section class="hero"><div class="kicker">Paris</div><h1>Églises de Paris</h1><span class="orn"></span></section>
    <div id="carteBody"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  const { meta, list } = await loadChurches();
  if (!location.hash.startsWith("#/carte")) return;
  const body = $("#carteBody", el);
  if (!list.length) {
    body.innerHTML = `<div class="empty">Les données des églises ne sont pas encore disponibles.<br><span class="small">Elles sont extraites d'OpenStreetMap à chaque mise en ligne${meta.erreur ? " (" + esc(meta.erreur) + ")" : ""}.</span></div>`;
    return;
  }
  const arrs = [...new Set(list.map(c => c.arr).filter(Boolean))].sort((a, b) => a - b);
  body.innerHTML = `
    <div class="row">
      <input type="search" id="fq" placeholder="Église, adresse ou rue" aria-label="Filtrer par nom, adresse ou rue" value="${esc(F.q)}" style="flex:2;min-width:180px">
      <select id="fconf" aria-label="Confession" style="flex:1;min-width:150px"><option value="catholiques">Catholiques</option><option value="toutes"${F.conf === "toutes" ? " selected" : ""}>Toutes confessions chrétiennes</option></select>
      <select id="farr" aria-label="Arrondissement" style="flex:1;min-width:130px"><option value="">Tous les arrondissements</option>${arrs.map(a => `<option value="${a}"${String(a) === F.arr ? " selected" : ""}>${arrLabel(a)}</option>`).join("")}</select>
    </div>
    <div id="rsug" class="row" style="margin-top:8px" aria-live="polite"></div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" id="fhere" aria-pressed="${!!F.here}">${F.here ? (F.hereLabel ? "Autour de " + esc(F.hereLabel) + " ✕" : "Tri par distance ✓") : "Autour de moi"}</button>
      <label class="field-inline" style="margin:0"><input type="checkbox" id="fh"${F.horaires ? " checked" : ""}> offices renseignés</label>
      <label class="field-inline" style="margin:0"><input type="checkbox" id="fp"${F.pmr ? " checked" : ""}> accessible en fauteuil</label>
      <label class="field-inline" style="margin:0"><input type="checkbox" id="ff"${F.fav ? " checked" : ""}> favorites</label>
    </div>
    <div id="map" role="application" aria-label="Carte des églises"></div>
    <p class="osm-attr">Églises et rues : données ${ATTR} (licence ODbL 1.0) — extraction du ${esc((meta.extractedAt || "").slice(0, 10) || "?")}. Le filtre par tradition liturgique, date et heure n'est pas disponible : ces informations ne figurent dans aucune source ouverte vérifiée.</p>
    <p class="small muted" id="count" aria-live="polite"></p>
    <ul class="list" id="clist"></ul>
    <div class="center"><button class="btn ghost" id="more" hidden>Afficher plus</button></div>`;

  const draw = () => {
    const r = filtered(list);
    suggest();
    $("#count", el).textContent = r.length + " église" + (r.length > 1 ? "s" : "") + " sur " + list.length;
    $("#clist", el).innerHTML = r.slice(0, F.limit).map(c => `<li><a href="#/eglise/${encodeURIComponent(c.id)}" style="text-decoration:none;color:inherit;display:block">
      <strong class="serif">${esc(churchLabel(c))}</strong>${favs().includes(c.id) ? " ★" : ""}${store.get("visits", c.id) ? ' <span class="chip">visitée</span>' : ""}<br>
      <span class="small muted">${esc([c.catholique !== true ? confLabel(c) : "", c.address, arrLabel(c.arr)].filter(Boolean).join(" · ") || "Adresse non renseignée")}${c._d != null ? " · " + (c._d < 1 ? Math.round(c._d * 1000) + " m" : c._d.toFixed(1) + " km") : ""}</span></a></li>`).join("")
      || `<li class="muted">Aucune église ne correspond à ces critères.</li>`;
    $("#more", el).hidden = r.length <= F.limit;
    if (layer) { layer.clearLayers(); r.forEach(c => { if (c.geom) window.L.polygon(c.geom, { color: "#7A5F22", weight: 1, fillColor: "#B89549", fillOpacity: .35, interactive: false }).addTo(layer); }); r.forEach(c => window.L.circleMarker([c.lat, c.lon], { radius: 6, color: "#7A5F22", weight: 1.5, fillColor: "#B89549", fillOpacity: .85 }).bindPopup(`<strong>${esc(churchLabel(c))}</strong><br><a href="#/eglise/${encodeURIComponent(c.id)}">Voir la fiche</a>`).addTo(layer)); }
  };
  $("#fq", el).oninput = e => { F.q = e.target.value; F.limit = 40; draw(); };
  // Recherche par rue : index des voies (data/osm/rues_paris.geojson), chargé seulement quand on tape un nom
  let sugTok = 0;
  async function suggest() {
    const box = $("#rsug", el); if (!box) return;
    const q = norm(F.q), tok = ++sugTok;
    if (q.length < 3) { box.innerHTML = ""; return; }
    const rues = await loadRues(); if (tok !== sugTok) return;
    const hits = rues.filter(x => norm(x[0]).includes(q)).sort((a, b) => (norm(a[0]).startsWith(q) ? 0 : 1) - (norm(b[0]).startsWith(q) ? 0 : 1) || a[0].length - b[0].length).slice(0, 5);
    box.innerHTML = hits.map((x, i) => `<button class="btn ghost sm" data-r="${i}">📍 ${esc(x[0])}${x[3].length ? " · " + esc(x[3].map(arrLabel).join(", ")) : ""}</button>`).join("");
    box.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { const x = hits[+b.dataset.r]; F.here = { lat: x[1], lon: x[2] }; F.hereLabel = x[0]; F.q = ""; F.limit = 40; carte(el, []); });
  }
  $("#fconf", el).onchange = e => { F.conf = e.target.value; draw(); };
  $("#farr", el).onchange = e => { F.arr = e.target.value; draw(); };
  $("#fh", el).onchange = e => { F.horaires = e.target.checked; draw(); };
  $("#fp", el).onchange = e => { F.pmr = e.target.checked; draw(); };
  $("#ff", el).onchange = e => { F.fav = e.target.checked; draw(); };
  $("#more", el).onclick = () => { F.limit += 40; draw(); };
  // La position n'est demandée qu'à ce clic, utilisée dans le navigateur uniquement, jamais enregistrée ni transmise.
  $("#fhere", el).onclick = () => {
    if (F.here) { F.here = null; F.hereLabel = ""; carte(el, []); return; }
    if (!navigator.geolocation) { toast("Géolocalisation indisponible"); return; }
    navigator.geolocation.getCurrentPosition(p => { F.here = { lat: p.coords.latitude, lon: p.coords.longitude }; F.hereLabel = ""; carte(el, []); }, () => toast("Position non autorisée"), { timeout: 8000 });
  };
  draw();
  try {
    const L = await loadLeaflet();
    if (!document.getElementById("map")) return;
    if (map) { map.remove(); map = null; }
    map = L.map("map", { scrollWheelZoom: false }).setView(F.here ? [F.here.lat, F.here.lon] : [48.8566, 2.3522], F.here ? 15 : 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: ATTR }).addTo(map);
    layer = L.layerGroup().addTo(map); draw();
  } catch { layer = null; const m = document.getElementById("map"); if (m) m.outerHTML = `<div class="notice small">Carte indisponible (hors ligne ?). La liste ci-dessous reste utilisable.</div>`; }
}

export async function eglise(el, [id]) {
  el.innerHTML = `<div class="skeleton" style="margin-top:30px"></div>`;
  const { meta, list } = await loadChurches();
  const c = list.find(x => x.id === id);
  if (!c) { el.innerHTML = `<div class="empty">Église introuvable. <a href="#/carte">Retour à la carte</a></div>`; return; }
  const fav = favs().includes(c.id), visit = store.get("visits", c.id), site = safeUrl(c.website);
  const src = `OpenStreetMap, extraction du ${esc((meta.extractedAt || "").slice(0, 10) || "?")}`;
  el.innerHTML = `
  <section class="hero"><div class="kicker">${esc(arrLabel(c.arr) || "Paris")}</div><h1>${esc(churchLabel(c))}</h1><span class="orn"></span></section>
  <div class="row">
    <button class="btn gold sm" id="bfav" aria-pressed="${fav}">${fav ? "★ Favorite" : "☆ Ajouter aux favorites"}</button>
    <button class="btn gold sm" id="bvis">${visit ? "✓ Visitée le " + esc(frDate(visit.date)) : "Marquer comme visitée"}</button>
    <a class="btn ghost sm" href="#/journal/nouveau/${encodeURIComponent(c.id)}">Ajouter au journal</a>
  </div>
  <div class="card"><dl class="kv">
    <dt>Confession</dt><dd>${esc(confLabel(c))}${c.culte === false ? ` <span class="chip">lieu de culte non signalé</span>` : ""}</dd>
    <dt>Adresse</dt><dd>${esc(c.address || "Non renseignée")}</dd>
    <dt>Site officiel</dt><dd>${site ? `<a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(new URL(site).hostname)}</a>` : "Non renseigné"}</dd>
    <dt>Accessibilité</dt><dd>${{ yes: "Accessible en fauteuil roulant", limited: "Accès partiel en fauteuil roulant", no: "Non accessible en fauteuil roulant" }[c.wheelchair] || "Non renseignée"}</dd>
    <dt>Rattachement</dt><dd>${esc(c.operator || c.diocese || "Non renseigné")}</dd>
    <dt>Itinéraire</dt><dd><a href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=18/${c.lat}/${c.lon}" target="_blank" rel="noopener noreferrer">Ouvrir dans OpenStreetMap</a></dd>
  </dl></div>
  <h2 class="sec">Messes</h2>
  ${c.serviceTimes ? `<div class="card"><p style="white-space:pre-wrap">${esc(c.serviceTimes)}</p>
     <p class="small muted">Source : ${src} · Fiabilité : <strong>non vérifiée</strong> (saisie contributive, format brut) · Récurrence et exceptions : non renseignées. Vérifiez auprès de la paroisse.</p></div>`
    : `<div class="empty">Horaire non renseigné${site ? ` — consultez <a href="${esc(site)}" target="_blank" rel="noopener noreferrer">le site de la paroisse</a>` : ""}.</div>`}
  <h2 class="sec">Confessions</h2><div class="empty">Horaire non renseigné.</div>
  <h2 class="sec">Adoration</h2><div class="empty">Horaire non renseigné.</div>
  <h2 class="sec">Histoire et photographies</h2>
  <div class="notice rights small">Aucun texte historique ni photographie n'est intégré pour l'instant : contenus à rédiger ou à obtenir sous licence vérifiée.${c.wikidata ? ` Référence Wikidata : <a href="https://www.wikidata.org/wiki/${esc(c.wikidata)}" target="_blank" rel="noopener noreferrer">${esc(c.wikidata)}</a>.` : ""}</div>
  <p class="row" style="margin-top:20px"><button class="btn ghost sm" id="brep">Signaler une erreur</button>
  <a class="small" href="https://www.openstreetmap.org/${esc(c.osm)}" target="_blank" rel="noopener noreferrer">Fiche OpenStreetMap</a></p>
  <p class="osm-attr">Données ${ATTR}, licence ODbL 1.0 — extraction du ${esc((meta.extractedAt || "").slice(0, 10) || "?")}.</p>`;

  $("#bfav", el).onclick = () => { const f = favs(); store.prefs.set("favEglises", fav ? f.filter(x => x !== c.id) : [...f, c.id]); eglise(el, [id]); };
  $("#bvis", el).onclick = async () => {
    const r = await modal(`<h2>${visit ? "Ma visite" : "Marquer comme visitée"}</h2>
      <label for="vd">Date de la visite</label><input type="date" id="vd" value="${esc(visit?.date || today())}" max="${today()}">
      <label for="vn">Note personnelle (facultatif)</label><textarea id="vn" maxlength="4000">${esc(visit?.note || "")}</textarea>
      <div class="row" style="margin-top:14px;justify-content:flex-end">${visit ? '<button class="btn danger" data-close="del">Retirer</button>' : ""}<button class="btn ghost" data-close="x">Annuler</button><button class="btn" id="vok">Enregistrer</button></div>`,
      (d, done) => { $("#vok", d).onclick = () => done(JSON.stringify({ date: $("#vd", d).value || today(), note: $("#vn", d).value })); });
    try {
      if (r === "del") await store.del("visits", c.id);
      else if (r && r !== "x") { const v = JSON.parse(r); await store.put("visits", c.id, { churchId: c.id, nom: churchLabel(c), date: v.date, note: v.note }); toast("Visite enregistrée"); }
    } catch { toast("Enregistrement impossible"); }
    eglise(el, [id]);
  };
  $("#brep", el).onclick = async () => {
    if (!cloud.user) { toast("Connectez-vous (Profil) pour signaler une erreur"); return; }
    const r = await modal(`<h2>Signaler une erreur</h2><p class="small muted">${esc(churchLabel(c))}</p>
      <label for="rm">Que faut-il corriger ?</label><textarea id="rm" maxlength="2000" required></textarea>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-close="x">Annuler</button><button class="btn" id="rok">Envoyer</button></div>`,
      (d, done) => { $("#rok", d).onclick = () => { const t = $("#rm", d).value.trim(); if (t) done(t); }; });
    if (!r || r === "x") return;
    try { const { fs, db, user } = cloud; await fs.addDoc(fs.collection(db, "reports"), { uid: user.uid, churchId: c.id, churchName: churchLabel(c), message: r, status: "nouveau", createdAt: fs.serverTimestamp() }); toast("Merci, signalement envoyé"); }
    catch { toast("Envoi impossible"); }
  };
}
