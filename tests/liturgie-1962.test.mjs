import { test } from "node:test";
import assert from "node:assert/strict";
import { liturgie1962 } from "../public/js/liturgie-1962.js";
import { dn, iso } from "../public/js/liturgie-romain.js";
const L = (y, m, d) => liturgie1962(dn(y, m, d));

test("temporal 1962 — année 2026", () => {
  assert.equal(L(2026, 1, 6).titre, "Épiphanie du Seigneur");
  assert.equal(L(2026, 1, 11).titre, "Sainte Famille de Jésus, Marie et Joseph");
  assert.equal(L(2026, 1, 18).titre, "2e dimanche après l'Épiphanie");
  assert.equal(L(2026, 2, 1).titre, "Dimanche de la Septuagésime");
  assert.equal(L(2026, 2, 1).gloria, false);
  assert.equal(L(2026, 2, 18).titre, "Mercredi des Cendres");
  assert.equal(L(2026, 3, 15).couleur, "rose");
  assert.equal(L(2026, 3, 22).titre, "1er dimanche de la Passion");
  assert.equal(L(2026, 4, 3).pasDeMesse, true);
  assert.equal(L(2026, 4, 5).classe, 1);
  assert.equal(L(2026, 5, 14).titre, "Ascension du Seigneur");
  assert.equal(L(2026, 5, 24).couleur, "rouge");
  assert.equal(L(2026, 5, 31).titre, "Fête de la Très Sainte Trinité");
  assert.equal(L(2026, 6, 4).titre, "Fête-Dieu — Très Saint Corps du Christ");
  assert.equal(L(2026, 6, 14).titre, "3e dimanche après la Pentecôte");
});
test("fin de l'année liturgique : dimanches après l'Épiphanie reportés", () => {
  assert.equal(L(2026, 11, 8).titre, "5e dimanche après l'Épiphanie reporté");
  assert.equal(L(2026, 11, 15).titre, "6e dimanche après l'Épiphanie reporté");
  assert.equal(L(2026, 11, 22).titre, "24e et dernier dimanche après la Pentecôte");
  assert.equal(L(2026, 11, 29).titre, "1er dimanche de l'Avent");
});
test("sanctoral et préséance", () => {
  assert.equal(L(2026, 10, 25).titre, "Notre-Seigneur Jésus-Christ Roi");
  assert.equal(L(2026, 11, 1).titre, "Fête de tous les Saints");
  assert.equal(L(2026, 11, 2).couleur, "noir");
  assert.equal(L(2025, 11, 3).titre, "Commémoraison de tous les fidèles défunts"); // 2 nov. 2025 = dimanche
  assert.equal(L(2026, 12, 8).titre, "Immaculée Conception de la Bienheureuse Vierge Marie");
  assert.equal(L(2026, 12, 26).titre, "Saint Étienne, premier martyr");
  assert.equal(L(2026, 12, 27).titre, "Dimanche dans l'octave de la Nativité");
  assert.ok(L(2026, 12, 27).note.includes("Saint Jean"));
  assert.equal(L(2026, 3, 25).titre, "Annonciation de la Bienheureuse Vierge Marie");
  assert.equal(L(2027, 3, 25).titre.startsWith("Jeudi saint"), true); // fête empêchée par la Semaine sainte
  assert.equal(L(2028, 2, 25).titre, "Saint Matthias, apôtre"); // année bissextile
});
test("robustesse 2020-2040", () => {
  for (let n = dn(2020, 1, 1); n <= dn(2040, 12, 31); n++) {
    const r = liturgie1962(n);
    assert.ok(r.titre && !/NaN|undefined|^0e|-\d+e/.test(r.titre), iso(n) + " → " + r.titre);
    assert.ok(["vert", "violet", "rose", "blanc", "rouge", "noir"].includes(r.couleur), iso(n));
    assert.ok([1, 2, 3, 4].includes(r.classe), iso(n));
  }
});
