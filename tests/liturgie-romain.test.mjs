import { test } from "node:test";
import assert from "node:assert/strict";
import { liturgie, easter, dn, iso, advent1 } from "../public/js/liturgie-romain.js";

const L = (y, m, d) => liturgie(dn(y, m, d));

test("dates de Pâques (comput grégorien)", () => {
  assert.equal(iso(easter(2025)), "2025-04-20");
  assert.equal(iso(easter(2026)), "2026-04-05");
  assert.equal(iso(easter(2027)), "2027-03-28");
  assert.equal(iso(easter(2028)), "2028-04-16");
  assert.equal(iso(easter(2038)), "2038-04-25");
});

test("premier dimanche de l'Avent", () => {
  assert.equal(iso(advent1(2025)), "2025-11-30");
  assert.equal(iso(advent1(2026)), "2026-11-29");
  assert.equal(iso(advent1(2027)), "2027-11-28");
});

test("temps ordinaire et cycles", () => {
  const r = L(2026, 11, 8);
  assert.equal(r.titre, "32e dimanche du temps ordinaire");
  assert.equal(r.couleur, "vert");
  assert.equal(r.annee, "A");
  assert.equal(r.cycle, "II");
  assert.ok(r.gloria && r.credo && r.deuxLectures);
  assert.equal(L(2026, 11, 13).titre, "Vendredi de la 32e semaine du temps ordinaire");
  assert.equal(L(2026, 1, 12).titre, "Lundi de la 1re semaine du temps ordinaire");
  assert.equal(L(2025, 11, 23).annee, "C");
  assert.equal(L(2025, 11, 30).annee, "A");
  assert.equal(L(2026, 11, 29).annee, "B");
});

test("Avent et Noël", () => {
  assert.equal(L(2026, 11, 29).titre, "1er dimanche de l'Avent");
  assert.equal(L(2026, 11, 29).couleur, "violet");
  assert.equal(L(2026, 11, 29).gloria, false);
  assert.equal(L(2026, 12, 13).couleur, "rose");
  assert.equal(L(2026, 12, 18).titre, "Vendredi 18 décembre");
  assert.equal(L(2026, 12, 8).titre, "Immaculée Conception de la Vierge Marie");
  assert.equal(L(2026, 12, 25).rang, "solennite");
  assert.equal(L(2026, 12, 27).titre, "La Sainte Famille de Jésus, Marie et Joseph");
  assert.equal(L(2027, 1, 1).titre, "Sainte Marie, Mère de Dieu");
  assert.equal(L(2027, 1, 3).titre, "Épiphanie du Seigneur");
  assert.equal(L(2027, 1, 10).titre, "Baptême du Seigneur");
});

test("Carême, Semaine sainte, temps pascal", () => {
  assert.equal(L(2027, 2, 10).titre, "Mercredi des Cendres");
  assert.equal(L(2026, 3, 15).couleur, "rose");
  assert.equal(L(2026, 3, 22).titre, "5e dimanche de Carême");
  assert.equal(L(2026, 3, 19).rang, "solennite");
  assert.equal(L(2026, 3, 29).couleur, "rouge");
  assert.equal(L(2026, 4, 3).pasDeMesse, true);
  assert.equal(L(2026, 4, 5).rang, "solennite");
  assert.equal(L(2026, 4, 6).titre, "Lundi dans l'octave de Pâques");
  assert.equal(L(2026, 4, 6).gloria, true);
  assert.equal(L(2026, 5, 14).titre, "Ascension du Seigneur");
  assert.equal(L(2026, 5, 24).couleur, "rouge");
  assert.equal(L(2026, 5, 24).paschalEnvoi, true);
  assert.equal(L(2026, 6, 7).titre, "Le Saint-Sacrement du Corps et du Sang du Christ");
});

test("fêtes et préséance", () => {
  assert.equal(L(2026, 11, 9).titre, "Dédicace de la basilique du Latran");
  assert.equal(L(2026, 11, 9).credo, false);
  assert.equal(L(2025, 11, 9).titre, "Dédicace de la basilique du Latran"); // dimanche : fête du Seigneur
  assert.equal(L(2025, 11, 2).titre, "Commémoration de tous les fidèles défunts");
  assert.equal(L(2025, 11, 2).gloria, false);
  assert.equal(L(2026, 6, 29).couleur, "rouge");
  assert.equal(L(2026, 11, 22).titre, "Notre Seigneur Jésus Christ, Roi de l'univers");
  assert.equal(L(2026, 11, 30).titre, "Saint André, apôtre"); // fête en semaine de l'Avent
  assert.equal(L(2027, 11, 30).titre, "Saint André, apôtre");
});

test("aucune date ne fait planter le calcul (2020-2040)", () => {
  for (let n = dn(2020, 1, 1); n <= dn(2040, 12, 31); n++) {
    const r = liturgie(n);
    assert.ok(r.titre && !r.titre.includes("NaN") && !r.titre.includes("undefined"), iso(n) + " → " + r.titre);
    assert.ok(["vert", "violet", "rose", "blanc", "rouge"].includes(r.couleur), iso(n));
  }
});
