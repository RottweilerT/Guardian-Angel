// Outils communs d'interface et de données publiques.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let tt;
export function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); }
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
