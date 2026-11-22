// Missel de 1962 : ordinaire latin + propre du jour (Missale Meum / Divinum Officium, textes latins du domaine public),
// épîtres, leçons et évangiles en français (Bible Fillion, domaine public). Données produites par tools/missel1962/build.py.
import { esc, fetchJson } from "./ui.js";

let ordoP = null;
export const ordo1962 = () => (ordoP ||= fetchJson("/missel1962/ordo.json").then(o => { if (!o) ordoP = null; return o; }));
export const jour1962 = date => fetchJson(`/missel1962/jours/${date}.json`);

// Texte latin de Divinum Officium : « *Ps 84:2* » = référence, ℣./℟., « S. » prêtre, « M. » servants…
const ROLES = { S: "Prêtre", M: "Servants", P: "Prêtre", D: "Diacre", C: "Chœur", O: "Tous", V: "℣", R: "℟", r: "℟" };
export function latin(txt) {
  return String(txt || "").split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
    const ref = l.match(/^\*([^*]+)\*$/);
    if (ref) return `<p class="ref">${esc(ref[1])}</p>`;
    const role = l.match(/^([SMPDCOVRr])\.\s+(.*)$/);
    let cls = "", body = l;
    if (role && "VRr".includes(role[1])) { cls = role[1] === "V" ? "v" : "r"; body = role[2]; }
    else if (role) return `<p class="la" lang="la"><span class="role">${ROLES[role[1]]} :</span> ${inl(role[2])}</p>`;
    if (/^℣\.?\s*/.test(body)) { cls = "v"; body = body.replace(/^℣\.?\s*/, ""); }
    else if (/^℟\.?\s*/.test(body)) { cls = "r"; body = body.replace(/^℟\.?\s*/, ""); }
    return `<p class="la ${cls}" lang="la">${inl(body)}</p>`;
  }).join("");
}
const inl = s => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\+\+?/g, "✠");

// Une section du propre : latin et, pour les lectures, le français à côté
function section(s) {
  const fr = s.fr ? `<div><p class="small muted" style="margin:0 0 4px">Bible Fillion</p><p class="texte-bible">${esc(s.fr)}</p></div>` : "";
  return `<div class="propre"><h3 class="serif">${esc(s.titre)}${s.ref ? ` <span class="small muted">— ${esc(s.ref)}</span>` : ""}</h3>
    <div class="cols${fr ? " deux" : ""}"><div>${latin(s.la)}</div>${fr}</div></div>`;
}

// Corps du missel du jour : chaque partie de l'ordinaire, avec le propre inséré à sa place
export function rendu1962(ordo, messe, { liens } = {}) {
  const par = new Map(messe.sections.map(s => [s.id, s])), places = new Set();
  ordo.parties.forEach(p => p.propre.forEach(id => places.add(id)));
  const autres = messe.sections.filter(s => !places.has(s.id));
  let h = "", num = 0;
  if (autres.length) h += `<h2>Rites propres du jour</h2>` + autres.map(s => `<details open><summary>${esc(s.titre)}</summary><div class="body">${section(s)}</div></details>`).join("");
  h += `<h2>Ordinaire et propre de la messe</h2>`;
  for (const p of ordo.parties) {
    const pr = p.propre.map(id => par.get(id)).filter(Boolean);
    if (!pr.length && !p.la.length) continue;
    num++;
    const lien = liens && p.cle === "The Gospel" ? `<p class="small" style="font-family:var(--sans)">Sermon : ${liens}</p>` : "";
    h += `<details${pr.length ? " open" : ""}><summary><span class="muted small">${num}.</span> ${esc(p.titre)}${pr.length ? ` <span class="chip sm">propre du jour</span>` : ""}</summary>
      <div class="body">${p.la.map(t => `<div class="ordinaire">${latin(t)}</div>`).join("")}${pr.map(section).join("")}${lien}</div></details>`;
  }
  return h;
}
