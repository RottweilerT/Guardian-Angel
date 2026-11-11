// Calendrier selon le missel de 1962 (rubriques de 1960) — moteur indicatif.
// Périmètre : cycle temporal complet + fêtes fixes de 1re et 2e classe du calendrier universel.
// NON GÉRÉ : fêtes de 3e classe, commémoraisons, translations, Quatre-Temps, Rogations, calendriers propres.
// ⚠ À faire vérifier par une personne compétente avant toute publication (voir docs/RISQUES_JURIDIQUES.md).
import { dn, ymd, dow, sob, easter, advent1, JOURS, cap } from "./liturgie-romain.js";

const ord = k => (k === 1 ? "1er" : k + "e");
const ordF = k => (k === 1 ? "1re" : k + "e");

// [mois, jour, titre, classe, couleur, drapeaux]  S = fête du Seigneur (l'emporte sur un dimanche de 2e classe) · C = Credo
export const FETES_1962 = [
  [1, 13, "Commémoraison du Baptême de Notre-Seigneur", 2, "blanc", "SC"],
  [2, 2, "Purification de la Bienheureuse Vierge Marie", 2, "blanc", "SC"],
  [2, 22, "Chaire de saint Pierre, apôtre", 2, "blanc", "C"],
  [2, 24, "Saint Matthias, apôtre", 2, "rouge", "C"],
  [3, 19, "Saint Joseph, époux de la Bienheureuse Vierge Marie", 1, "blanc", "C"],
  [3, 25, "Annonciation de la Bienheureuse Vierge Marie", 1, "blanc", "C"],
  [4, 25, "Saint Marc, évangéliste", 2, "rouge", "C"],
  [5, 1, "Saint Joseph artisan", 1, "blanc", "C"],
  [5, 11, "Saints Philippe et Jacques, apôtres", 2, "rouge", "C"],
  [5, 31, "Bienheureuse Vierge Marie Reine", 2, "blanc", "C"],
  [6, 24, "Nativité de saint Jean-Baptiste", 1, "blanc", "C"],
  [6, 29, "Saints Pierre et Paul, apôtres", 1, "rouge", "C"],
  [7, 1, "Très Précieux Sang de Notre-Seigneur", 1, "rouge", "C"],
  [7, 2, "Visitation de la Bienheureuse Vierge Marie", 2, "blanc", "C"],
  [7, 25, "Saint Jacques, apôtre", 2, "rouge", "C"],
  [7, 26, "Sainte Anne, mère de la Bienheureuse Vierge Marie", 2, "blanc", ""],
  [8, 6, "Transfiguration de Notre-Seigneur", 2, "blanc", "SC"],
  [8, 10, "Saint Laurent, martyr", 2, "rouge", ""],
  [8, 15, "Assomption de la Bienheureuse Vierge Marie", 1, "blanc", "C"],
  [8, 16, "Saint Joachim, père de la Bienheureuse Vierge Marie", 2, "blanc", ""],
  [8, 22, "Cœur Immaculé de Marie", 2, "blanc", "C"],
  [8, 24, "Saint Barthélemy, apôtre", 2, "rouge", "C"],
  [9, 8, "Nativité de la Bienheureuse Vierge Marie", 2, "blanc", "C"],
  [9, 14, "Exaltation de la Sainte Croix", 2, "rouge", "SC"],
  [9, 15, "Notre-Dame des Sept Douleurs", 2, "blanc", "C"],
  [9, 21, "Saint Matthieu, apôtre et évangéliste", 2, "rouge", "C"],
  [9, 29, "Dédicace de saint Michel Archange", 1, "blanc", "C"],
  [10, 7, "Notre-Dame du Rosaire", 2, "blanc", "C"],
  [10, 11, "Maternité de la Bienheureuse Vierge Marie", 2, "blanc", "C"],
  [10, 18, "Saint Luc, évangéliste", 2, "rouge", "C"],
  [10, 28, "Saints Simon et Jude, apôtres", 2, "rouge", "C"],
  [11, 1, "Fête de tous les Saints", 1, "blanc", "C"],
  [11, 9, "Dédicace de l'archibasilique du Très Saint Sauveur", 2, "blanc", "SC"],
  [11, 30, "Saint André, apôtre", 2, "rouge", "C"],
  [12, 8, "Immaculée Conception de la Bienheureuse Vierge Marie", 1, "blanc", "C"],
  [12, 21, "Saint Thomas, apôtre", 2, "rouge", "C"],
  [12, 26, "Saint Étienne, premier martyr", 2, "rouge", "C"],
  [12, 27, "Saint Jean, apôtre et évangéliste", 2, "blanc", "C"],
  [12, 28, "Saints Innocents, martyrs", 2, "rouge", "C"]
];

export function liturgie1962(n) {
  const [y, m, d] = ymd(n), w = dow(n), J = cap(JOURS[w]);
  const E = easter(y), A1 = advent1(y), xmas = dn(y, 12, 25), epi = dn(y, 1, 6);
  const sept = E - 63, ash = E - 46, pent = E + 49;
  const r = { titre: "", temps: "", couleur: "vert", classe: 4, gloria: false, credo: w === 0, dimanche: w === 0 };
  const set = (titre, classe, couleur, gloria) => { r.titre = titre; r.classe = classe; if (couleur) r.couleur = couleur; if (gloria !== undefined) r.gloria = gloria; };

  if (n < epi) {
    r.temps = "Temps de Noël"; r.couleur = "blanc"; r.gloria = true;
    let nom = dn(y, 1, 2); for (let i = dn(y, 1, 2); i <= dn(y, 1, 5); i++) if (dow(i) === 0) nom = i;
    if (d === 1) { set("Octave de la Nativité du Seigneur", 1); r.credo = true; }
    else if (n === nom) { set("Très Saint Nom de Jésus", 2); r.credo = true; }
    else set("Férie du temps de Noël", 4);
  } else if (n === epi) {
    r.temps = "Temps de l'Épiphanie"; set("Épiphanie du Seigneur", 1, "blanc", true); r.credo = true;
  } else if (n < sept) {
    const hf = epi + (7 - dow(epi));
    const apres13 = n > dn(y, 1, 13);
    r.temps = apres13 ? "Temps après l'Épiphanie" : "Temps de l'Épiphanie"; r.couleur = apres13 ? "vert" : "blanc";
    const k = (sob(n) - hf) / 7 + 1;
    if (n === hf) { set("Sainte Famille de Jésus, Marie et Joseph", 2, "blanc", true); }
    else if (w === 0) set(ord(k) + " dimanche après l'Épiphanie", 2, "vert", true);
    else if (k < 1) set(J + " après l'Épiphanie", 4);
    else set(J + " de la semaine du " + ord(k) + " dimanche après l'Épiphanie", 4);
  } else if (n < ash) {
    r.temps = "Temps de la Septuagésime"; r.couleur = "violet";
    const noms = ["Septuagésime", "Sexagésime", "Quinquagésime"], k = (sob(n) - sept) / 7;
    if (w === 0) set("Dimanche de la " + noms[k], 2);
    else set(J + " après la " + noms[k], 4);
  } else if (n < E) {
    r.temps = n >= E - 14 ? "Temps de la Passion" : "Carême"; r.couleur = "violet";
    if (n === ash) set("Mercredi des Cendres", 1);
    else if (n < E - 42) set(J + " après les Cendres", 3);
    else if (n === E - 14) set("1er dimanche de la Passion", 1);
    else if (n === E - 7) set("2e dimanche de la Passion, ou dimanche des Rameaux", 1);
    else if (n === E - 3) { set("Jeudi saint — Messe vespérale de la Cène du Seigneur", 1, "blanc", true); }
    else if (n === E - 2) { set("Vendredi saint — Action liturgique de la Passion et de la Mort du Seigneur", 1, "noir"); r.pasDeMesse = true; }
    else if (n === E - 1) { set("Samedi saint — Vigile pascale", 1, "blanc", true); }
    else if (n > E - 7) set(J + " saint", 1);
    else if (n > E - 14) set(J + " de la semaine de la Passion", 3);
    else {
      const k = (sob(n) - (E - 42)) / 7 + 1;
      if (w === 0) { set(ord(k) + " dimanche de Carême" + (k === 4 ? " (Lætare)" : ""), 1); if (k === 4) r.couleur = "rose"; }
      else set(J + " de la " + ordF(k) + " semaine de Carême", 3);
    }
  } else if (n < pent + 7) {
    r.temps = "Temps pascal"; r.couleur = "blanc"; r.gloria = true;
    const k = (sob(n) - E) / 7;
    if (n === E) { set("Dimanche de la Résurrection", 1); }
    else if (n < E + 7) { set(J + " de Pâques", 1); r.credo = true; }
    else if (n === E + 7) set("Dimanche in albis (1er dimanche après Pâques)", 1);
    else if (n === E + 39) { set("Ascension du Seigneur", 1); r.credo = true; }
    else if (n === E + 42) set("Dimanche après l'Ascension", 2);
    else if (n === E + 48) { set("Vigile de la Pentecôte", 1, "rouge"); }
    else if (n === pent) set("Dimanche de la Pentecôte", 1, "rouge");
    else if (n > pent) { set(J + " de la Pentecôte", 1, "rouge"); r.credo = true; }
    else if (w === 0) set(ord(k) + " dimanche après Pâques", 2);
    else set(J + " de la " + ordF(k) + " semaine après l'octave de Pâques", 4);
  } else if (n < A1) {
    r.temps = "Temps après la Pentecôte";
    const k = (sob(n) - pent) / 7, T = (A1 - 7 - pent) / 7;
    let christRoi = dn(y, 10, 31); while (dow(christRoi) !== 0) christRoi--;
    if (n === pent + 7) set("Fête de la Très Sainte Trinité", 1, "blanc", true);
    else if (n === pent + 11) { set("Fête-Dieu — Très Saint Corps du Christ", 1, "blanc", true); r.credo = true; }
    else if (n === pent + 19) { set("Sacré-Cœur de Jésus", 1, "blanc", true); r.credo = true; }
    else if (n === christRoi) { set("Notre-Seigneur Jésus-Christ Roi", 1, "blanc", true); r.sousTitre = ord(k) + " dimanche après la Pentecôte"; }
    else if (w === 0) {
      if (k >= T) set("24e et dernier dimanche après la Pentecôte", 2, "vert", true);
      else if (k >= 24) { set(ord(7 - T + k) + " dimanche après l'Épiphanie reporté", 2, "vert", true); r.sousTitre = ord(k) + " dimanche après la Pentecôte"; }
      else set(ord(k) + " dimanche après la Pentecôte", 2, "vert", true);
    } else set(J + " de la " + ordF(k) + " semaine après la Pentecôte", 4);
  } else if (n < xmas) {
    r.temps = "Avent"; r.couleur = "violet";
    const k = (sob(n) - A1) / 7 + 1;
    if (w === 0) { set(ord(k) + " dimanche de l'Avent" + (k === 3 ? " (Gaudete)" : ""), 1); if (k === 3) r.couleur = "rose"; }
    else if (d === 24) set("Vigile de la Nativité du Seigneur", 1);
    else set(J + " de la " + ordF(k) + " semaine de l'Avent", d >= 17 ? 2 : 3);
    if (w === 0 && d === 24) set("Vigile de la Nativité du Seigneur", 1, "violet");
  } else {
    r.temps = "Temps de Noël"; r.couleur = "blanc"; r.gloria = true; r.credo = true;
    if (n === xmas) set("Nativité du Seigneur", 1);
    else if (w === 0) set("Dimanche dans l'octave de la Nativité", 2);
    else set(ord(d - 24) + " jour dans l'octave de la Nativité", 2);
  }
  r.base = r.titre;

  // Sanctoral (1re et 2e classe)
  let f = FETES_1962.find(x => x[0] === m && x[1] === d);
  if (m === 1 && d === 13 && w === 0) f = undefined; // la Sainte Famille l'emporte
  const bissextile = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (m === 2 && bissextile) f = d === 25 ? FETES_1962.find(x => x[2].startsWith("Saint Matthias")) : d === 24 ? undefined : f;
  const defunts = (m === 11 && d === 2 && w !== 0) || (m === 11 && d === 3 && w === 1);
  if (defunts) {
    Object.assign(r, { titre: "Commémoraison de tous les fidèles défunts", classe: 1, couleur: "noir", gloria: false, credo: false, sousTitre: r.base });
  } else if (f) {
    const [, , titre, classe, couleur, fl] = f;
    let gagne;
    if (classe === 1) gagne = r.classe > 1 || (m === 12 && d === 8);
    else gagne = r.classe >= 3 || (r.classe === 2 && (w !== 0 || fl.includes("S")));
    if (gagne) Object.assign(r, { titre, classe, couleur, gloria: true, credo: fl.includes("C") || classe === 1 || w === 0, sousTitre: r.base });
    else r.note = titre + " : fête empêchée ce jour (commémoraison ou translation non calculée).";
  }
  r.alleluia = !["Temps de la Septuagésime", "Carême", "Temps de la Passion"].includes(r.temps);
  return r;
}
