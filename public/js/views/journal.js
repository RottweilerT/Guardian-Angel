import { esc, $, toast, today, frDate, norm, loadChurches, churchLabel } from "../ui.js";
import * as store from "../store.js";
import { cloud } from "../cloud.js";

const CATS = ["Messe", "Prière", "Lecture", "Retraite", "Autre"];
let q = "", cat = "";

export default function journal(el, params) {
  if (params[0] === "nouveau") return editor(el, null, params[1]);
  if (params[0] === "e" && params[1]) return editor(el, params[1]);
  const all = store.list("journal").sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || 0) - (a.updatedAt || 0));
  const nq = norm(q);
  const rows = all.filter(e => (!cat || e.categorie === cat) && (!nq || norm([e.eglise, e.notes, e.passages, e.intentions, e.reflexions].join(" ")).includes(nq)));
  el.innerHTML = `
  <section class="hero"><div class="kicker">Privé</div><h1>Journal spirituel</h1>
    <p>${store.isCloud() ? "Synchronisé avec votre compte, visible de vous seul." : "Enregistré sur cet appareil uniquement." + (cloud.ready ? ' <a href="#/profil">Se connecter</a> pour le retrouver partout.' : "")}</p><span class="orn"></span></section>
  <div class="row between"><a class="btn" href="#/journal/nouveau">+ Nouvelle entrée</a><span class="small muted">${all.length} entrée${all.length > 1 ? "s" : ""}</span></div>
  <div class="row" style="margin-top:12px">
    <input type="search" id="jq" placeholder="Rechercher dans mon journal…" aria-label="Rechercher" value="${esc(q)}" style="flex:2;min-width:180px">
    <select id="jc" aria-label="Catégorie" style="flex:1;min-width:120px"><option value="">Toutes</option>${CATS.map(c => `<option${c === cat ? " selected" : ""}>${c}</option>`).join("")}</select>
  </div>
  <div id="jl">${rows.length ? rows.map(e => `<a class="card" href="#/journal/e/${encodeURIComponent(e.id)}">
      <div class="row between"><span class="small muted">${esc(frDate(e.date))}</span><span class="chip">${esc(e.categorie || "Messe")}</span></div>
      <h3 style="margin:4px 0">${esc(e.eglise || "Sans lieu")}</h3>
      <p class="small" style="white-space:pre-wrap;max-height:4.6em;overflow:hidden;margin:0">${esc(e.notes || e.reflexions || e.intentions || "")}</p>
      ${e.passages ? `<p class="small muted" style="margin:6px 0 0">${esc(e.passages)}</p>` : ""}</a>`).join("")
    : `<div class="empty">${all.length ? "Aucune entrée ne correspond." : "Votre journal est vide. Ajoutez une messe, une note d'homélie ou une intention de prière."}</div>`}</div>
  <div class="notice rights small">Enregistrement audio, transcription et résumé automatique des homélies : <strong>non disponibles</strong>. Ils supposent l'accord du prédicateur et un prestataire dont les conditions auront été vérifiées (voir « Sources et droits »).</div>`;
  $("#jq", el).oninput = e => { q = e.target.value; const pos = e.target.selectionStart; journal(el, []); const i = $("#jq", el); i.focus(); i.setSelectionRange(pos, pos); };
  $("#jc", el).onchange = e => { cat = e.target.value; journal(el, []); };
}

async function editor(el, id, churchId) {
  const e = id ? store.get("journal", id) : null;
  if (id && !e) { el.innerHTML = `<div class="empty">Entrée introuvable. <a href="#/journal">Retour au journal</a></div>`; return; }
  const { list } = await loadChurches();
  const pre = churchId ? list.find(c => c.id === churchId) : null;
  const v = e || { date: today(), categorie: "Messe", eglise: pre ? churchLabel(pre) : "", egliseId: pre ? pre.id : "" };
  el.innerHTML = `
  <section class="hero"><h1>${e ? "Modifier l'entrée" : "Nouvelle entrée"}</h1><span class="orn"></span></section>
  <form id="jf">
    <div class="row"><div style="flex:1;min-width:150px"><label for="fd">Date</label><input type="date" id="fd" required value="${esc(v.date)}"></div>
      <div style="flex:1;min-width:150px"><label for="fc">Catégorie</label><select id="fc">${CATS.map(c => `<option${c === (v.categorie || "Messe") ? " selected" : ""}>${c}</option>`).join("")}</select></div></div>
    <label for="fe">Église ou lieu</label><input id="fe" list="dl" maxlength="200" value="${esc(v.eglise || "")}" autocomplete="off">
    <datalist id="dl">${list.slice(0, 600).map(c => c.name ? `<option value="${esc(c.name)}">` : "").join("")}</datalist>
    <label for="fn">Notes (homélie, ce que je retiens)</label><textarea id="fn" maxlength="20000">${esc(v.notes || "")}</textarea>
    <label for="fp">Passages bibliques (ex. : Mt 25, 1-13 ; Ps 62)</label><input id="fp" maxlength="500" value="${esc(v.passages || "")}">
    <label for="fr">Réflexions personnelles</label><textarea id="fr" maxlength="20000" style="min-height:80px">${esc(v.reflexions || "")}</textarea>
    <label for="fi">Intentions de prière</label><textarea id="fi" maxlength="5000" style="min-height:70px">${esc(v.intentions || "")}</textarea>
    <div class="row" style="margin-top:18px"><button class="btn">Enregistrer</button><a class="btn ghost" href="#/journal">Annuler</a>
      ${e ? '<span style="flex:1"></span><button type="button" class="btn danger" id="jdel">Supprimer</button>' : ""}</div>
  </form>`;
  $("#jf", el).onsubmit = async ev => {
    ev.preventDefault();
    const eglise = $("#fe", el).value.trim(), m = list.find(c => c.name && c.name === eglise);
    const obj = { id: id || store.newId(), date: $("#fd", el).value, categorie: $("#fc", el).value, eglise, egliseId: m ? m.id : "", notes: $("#fn", el).value, passages: $("#fp", el).value.trim(), reflexions: $("#fr", el).value, intentions: $("#fi", el).value };
    try { await store.put("journal", obj.id, obj); toast("Entrée enregistrée"); location.hash = "#/journal"; } catch (err) { console.error(err); toast("Enregistrement impossible"); }
  };
  const d = $("#jdel", el);
  if (d) d.onclick = async () => { if (!d.dataset.ok) { d.dataset.ok = 1; d.textContent = "Confirmer la suppression"; return; } await store.del("journal", id); toast("Entrée supprimée"); location.hash = "#/journal"; };
}
