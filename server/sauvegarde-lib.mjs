// Sauvegarde de Firestore : parcours complet (sous-collections comprises), mise en JSON fidèle aux types Firestore,
// comparaison avec la base. Fonctions pures, testées sans Firebase (tests/sauvegarde.test.mjs).
export const FORMAT = "guardian-angel-sauvegarde";

// ---- Valeurs Firestore → JSON (et retour) : horodatages, références, points géographiques et octets sont typés
const estTimestamp = v => v && typeof v.toMillis === "function" && "seconds" in v && "nanoseconds" in v;
const estReference = v => v && typeof v.path === "string" && v.firestore && typeof v.collection === "function";
const estGeo = v => v && typeof v.latitude === "number" && typeof v.longitude === "number" && typeof v.isEqual === "function";
export function encoder(v) {
  if (v === null || typeof v !== "object") return typeof v === "number" && !Number.isFinite(v) ? { __type: "nombre", v: String(v) } : v;
  if (estTimestamp(v)) return { __type: "date", s: v.seconds, n: v.nanoseconds };
  if (estReference(v)) return { __type: "ref", chemin: v.path };
  if (estGeo(v)) return { __type: "geo", lat: v.latitude, lon: v.longitude };
  if (v instanceof Uint8Array) return { __type: "octets", b64: Buffer.from(v).toString("base64") };
  if (v instanceof Date) return { __type: "date", s: Math.floor(v.getTime() / 1000), n: (v.getTime() % 1000) * 1e6 };
  if (Array.isArray(v)) return v.map(encoder);
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = encoder(v[k]);
  if ("__type" in v) return { __type: "objet", v: o };      // un vrai champ nommé « __type » reste distinct de nos marqueurs
  return o;
}
export function decoder(v, { Timestamp, GeoPoint, db }) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(x => decoder(x, { Timestamp, GeoPoint, db }));
  switch (v.__type) {
    case "date": return new Timestamp(v.s, v.n);
    case "ref": return db.doc(v.chemin);
    case "geo": return new GeoPoint(v.lat, v.lon);
    case "octets": return Buffer.from(v.b64, "base64");
    case "nombre": return Number(v.v);
    case "objet": return Object.fromEntries(Object.entries(v.v).map(([k, x]) => [k, decoder(x, { Timestamp, GeoPoint, db })]));
  }
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decoder(x, { Timestamp, GeoPoint, db })]));
}

// ---- Parcours de toute la base. Un document « absent » (null) a des sous-collections mais pas de contenu propre
// (ex. users/{uid} quand seul users/{uid}/journal existe) : on le note pour garder la structure, sans le réécrire.
export async function lireTout(db, { parLot = 300 } = {}) {
  const documents = {};
  const parcourir = async collections => {
    for (const col of collections) {
      const refs = await col.listDocuments();
      for (let i = 0; i < refs.length; i += parLot) {
        const lot = refs.slice(i, i + parLot);
        const snaps = await db.getAll(...lot);
        snaps.forEach((s, j) => { documents[lot[j].path] = s.exists ? encoder(s.data()) : null; });
      }
      for (const r of refs) await parcourir(await r.listCollections());
    }
  };
  await parcourir(await db.listCollections());
  return documents;
}

export const enveloppe = (projet, documents) => ({ format: FORMAT, version: 1, projet, documents: trier(documents) });
const trier = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
export const racine = chemin => chemin.split("/")[0];

// ---- Contrôle de forme : renvoie la liste des problèmes (vide = sauvegarde exploitable)
export function controler(b) {
  const pb = [];
  if (!b || b.format !== FORMAT) return ["ce fichier n'est pas une sauvegarde de Guardian Angel"];
  if (!b.projet) pb.push("projet Firebase non indiqué");
  if (!b.documents || typeof b.documents !== "object") return [...pb, "aucun document"];
  let mal = 0, gros = 0;
  for (const [chemin, d] of Object.entries(b.documents)) {
    if (chemin.split("/").length % 2 !== 0) mal++;
    if (d !== null && (typeof d !== "object" || Array.isArray(d))) mal++;
    if (d && JSON.stringify(d).length > 1_000_000) gros++;
  }
  if (mal) pb.push(`${mal} document(s) mal formé(s)`);
  if (gros) pb.push(`${gros} document(s) de plus d'1 Mo`);
  return pb;
}

// ---- Comparaison sauvegarde / base actuelle, par collection racine (nombres uniquement : rien de personnel)
export function comparer(sauvegarde, actuelle) {
  const parts = {};
  const p = c => (parts[c] ||= { sauvegarde: 0, base: 0, identiques: 0, modifies: 0, ajoutes: 0, disparus: 0 });
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [chemin, d] of Object.entries(sauvegarde)) {
    if (d === null) continue;
    const x = p(racine(chemin)); x.sauvegarde++;
    if (!(chemin in actuelle) || actuelle[chemin] === null) x.disparus++;
    else if (eq(d, actuelle[chemin])) x.identiques++; else x.modifies++;
  }
  for (const [chemin, d] of Object.entries(actuelle)) {
    if (d === null) continue;
    const x = p(racine(chemin)); x.base++;
    if (!(chemin in sauvegarde) || sauvegarde[chemin] === null) x.ajoutes++;
  }
  return trier(parts);
}
