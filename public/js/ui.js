// Outils communs d'interface et de données publiques.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let tt;
export function toast(msg) { const t = $("#toast"); t.textContent = msg; t.style.pointerEvents = ""; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); }
// Message avec un bouton (ex. « Annuler » après une suppression)
export function toastAction(msg, label, fn) {
  const t = $("#toast"); t.textContent = msg + " ";
  const b = document.createElement("button"); b.className = "btn ghost sm"; b.style.cssText = "margin-left:8px;color:inherit;border-color:currentColor"; b.textContent = label;
  b.onclick = () => { t.classList.remove("on"); t.style.pointerEvents = ""; fn(); }; t.appendChild(b);
  t.style.pointerEvents = "auto"; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = ""; }, 6000);
}
// Bouton de suppression en deux temps : 1er appui « Supprimer ? », 2e appui confirme (revient tout seul après 4 s)
export const BTN_SUPPR = id => `<button class="btn ghost sm" data-suppr="${esc(id)}" aria-label="Supprimer" title="Supprimer" style="padding:4px 10px;flex:none">✕</button>`;
export function brancherSuppression(root, onDelete) {
  root.querySelectorAll("[data-suppr]").forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Supprimer ?"; b.classList.add("danger"); b.classList.remove("ghost"); setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = "✕"; b.classList.remove("danger"); b.classList.add("ghost"); } }, 4000); return; }
    b.disabled = true; onDelete(b.dataset.suppr);
  });
}
export const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export const frDate = iso => { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return iso || ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
export const safeUrl = u => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch { return null; } };
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Fenêtre modale accessible (élément <dialog>). Renvoie une promesse résolue à la fermeture.
export function modal(html, onOpen) {
  const d = $("#dlg"); d.innerHTML = html;
  return new Promise(res => {
    const done = v => { d.close(); d.onclose = null; res(v); };
    d.onclose = () => res(null);
    d.onclick = e => { const b = e.target.closest("[data-close]"); if (b) done(b.dataset.close); };
    if (onOpen) onOpen(d, done);
    d.showModal();
  });
}

// --- Églises (données OpenStreetMap extraites par scripts/fetch-churches.mjs) ---
let churchesP = null;
export function loadChurches() {
  if (!churchesP) churchesP = fetch("/data/churches.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => ({ meta: j.meta || {}, list: Array.isArray(j.churches) ? j.churches : [] }))
    .catch(e => { churchesP = null; return { meta: { erreur: String(e.message || e) }, list: [] }; });
  return churchesP;
}
export const churchLabel = c => c.name || "Église (nom non renseigné)";
export const arrLabel = a => (a ? (a === 1 ? "1er" : a + "e") + " arr." : "");
export function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fetchJson = url => fetch(url).then(r => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null)).catch(() => null);
