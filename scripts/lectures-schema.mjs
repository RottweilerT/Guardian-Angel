// Format d'un fichier data/lectures/AAAA-MM-JJ.json (un jour = un fichier).
// Utilisé par l'import Firestore et par les tests.

export const TYPES = ["lecture1", "lecture2", "lecture3", "lecture4", "lecture5", "lecture6", "lecture7",
  "psaume", "psaume2", "psaume3", "psaume4", "psaume5", "psaume6", "psaume7",
  "sequence", "acclamation", "evangile", "entree"];
export const COULEURS = ["vert", "violet", "rose", "blanc", "rouge", "noir"];
export const RANGS = ["solennite", "fete", "memoire", "dimanche", "ferie", "defunts"];
const DAY_FIELDS = ["date", "titre", "sousTitre", "saint", "rang", "couleur", "remarque", "lectures", "messes"];
const LECT_FIELDS = ["type", "ref", "intro", "titre", "resume", "refrain", "contenu", "acclamation"];

/** Renvoie la liste des erreurs (vide = fichier valide). */
export function validateDay(doc, fileDate) {
  const err = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["le fichier doit contenir un objet JSON"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.date || "")) err.push("champ date absent ou mal formé (AAAA-MM-JJ)");
  if (fileDate && doc.date !== fileDate) err.push(`la date (${doc.date}) ne correspond pas au nom du fichier (${fileDate})`);
  Object.keys(doc).forEach(k => { if (!DAY_FIELDS.includes(k)) err.push(`champ inconnu : ${k}`); });
  if (doc.couleur && !COULEURS.includes(doc.couleur)) err.push(`couleur inconnue : ${doc.couleur}`);
  if (doc.rang && !RANGS.includes(doc.rang)) err.push(`rang inconnu : ${doc.rang}`);
  ["titre", "sousTitre", "saint", "remarque"].forEach(k => { if (doc[k] != null && typeof doc[k] !== "string") err.push(`${k} doit être un texte`); });
  const messes = doc.messes || (doc.lectures ? [{ nom: "Messe du jour", lectures: doc.lectures }] : []);
  if (!Array.isArray(messes) || !messes.length) err.push("aucune lecture (champ lectures ou messes)");
  (Array.isArray(messes) ? messes : []).forEach((m, i) => {
    if (!Array.isArray(m.lectures)) { err.push(`messes[${i}].lectures doit être une liste`); return; }
    m.lectures.forEach((l, j) => {
      const at = `lecture ${j + 1}${messes.length > 1 ? " (messe " + (i + 1) + ")" : ""}`;
      if (!TYPES.includes(l.type)) err.push(`${at} : type inconnu « ${l.type} »`);
      Object.keys(l).forEach(k => { if (!LECT_FIELDS.includes(k)) err.push(`${at} : champ inconnu ${k}`); });
      ["ref", "intro", "titre", "resume", "refrain", "contenu"].forEach(k => { if (l[k] != null && typeof l[k] !== "string") err.push(`${at} : ${k} doit être un texte`); });
    });
  });
  return err;
}
