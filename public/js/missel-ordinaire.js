// Forme ordinaire : déroulement de la messe avec les parties latines anciennes (domaine public) et les lectures du jour
// (références : Ambo Liturgical Calendars, MIT ; texte : Bible Fillion, domaine public). Données : tools/missel-ordinaire/build.mjs.
// Les oraisons, antiennes, refrains et la traduction liturgique française (AELF) ne sont pas intégrés.
import { esc, fetchJson } from "./ui.js";
import { ORDO } from "./ordo.js";

export const jourOrdinaire = date => fetchJson(`/missel-ordinaire/jours/${date}.json`);

// étape du déroulement → partie latine de ordo.js
const LATIN = {
  "Salutation": "signe", "Kyrie": "kyrie", "Gloire à Dieu": "gloria", "Prière d'ouverture": "collecte", "Évangile": "evangile",
  "Profession de foi": "credo", "Invitation à la prière": "orate", "Dialogue de la préface et préface": "preface",
  "Saint, saint, saint": "sanctus", "Doxologie": "doxo", "Notre Père": "pater", "Prière pour la paix et geste de paix": "paix",
  "Fraction du pain": "agnus", "Communion": "communion", "Bénédiction": "envoi",
};
// étape → lectures du jour
const LECTURES = {
  "Première lecture": id => id === "first-reading" || /^old-testament-reading/.test(id),
  "Psaume": id => id === "responsorial-psalm" || /^old-testament-psalm/.test(id),
  "Deuxième lecture": id => id === "second-reading" || id === "epistle",
  "Évangile": id => id === "gospel",
};

const ligne = l => {
  if (l.startsWith("!")) return `<p class="rub">${esc(l.slice(1))}</p>`;
  const m = l.match(/^([VR]):(.*)$/);
  return `<p class="la${m ? " " + m[1].toLowerCase() : ""}" lang="la">${esc(m ? m[2] : l)}</p>`;
};

function lecture(l, psaume) {
  const vulg = l.ref_vulgate && l.fr ? ` <span class="small muted">(Bible Fillion${psaume ? `, Ps ${esc(l.ref_vulgate.split(":")[0])} dans la Vulgate` : ""})</span>` : "";
  return `<div class="propre"><h3 class="serif">${esc(l.titre)} <span class="small muted">— ${esc(l.ref_fr || l.ref)}</span>${vulg}</h3>
    ${l.fr ? `<p class="texte-bible">${esc(l.fr)}</p>` : `<p class="small muted" style="font-family:var(--sans)">Texte non disponible dans une traduction libre de droits fidèle à ce passage.</p>`}</div>`;
}

export function renduOrdinaire(F, jour, { liens } = {}) {
  const latin = Object.fromEntries(ORDO.romain.filter(p => p.la && p.droits === "PUBLIC_DOMAIN").map(p => [p.id, p.la]));
  let h = "", num = 0;
  for (const [section, etapes] of F.sections) {
    h += `<h2>${esc(section)}</h2>`;
    for (const [titre, lat, quand] of etapes) {
      num++;
      const la = LATIN[titre] && latin[LATIN[titre]];
      const ls = jour && LECTURES[titre] ? jour.lectures.filter(l => LECTURES[titre](l.id)) : [];
      const lien = liens && /^(Homélie)$/.test(titre) ? `<p class="small" style="font-family:var(--sans)">${liens}</p>` : "";
      const entete = `<span class="muted small">${num}.</span> ${esc(titre)}${lat && lat !== titre ? ` <em class="muted small" lang="la">— ${esc(lat)}</em>` : ""}`;
      const note = quand ? `<p class="expl">${esc(quand)}</p>` : "";
      if (!la && !ls.length) { h += `<div class="etape">${entete}${note}${lien}</div>`; continue; }
      h += `<details${ls.length ? " open" : ""}><summary><span>${entete}${ls.length ? ` <span class="chip sm">lecture du jour</span>` : ""}</span></summary><div class="body">${note}
        ${la ? `<div class="ordinaire">${la.map(ligne).join("")}</div>` : ""}${ls.map(l => lecture(l, l.id.includes("psalm"))).join("")}${lien}</div></details>`;
    }
  }
  return h;
}
