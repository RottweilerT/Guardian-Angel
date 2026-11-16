// Sermons enregistrés : stockés uniquement sur cet appareil (IndexedDB). L'audio n'est jamais envoyé sur un serveur.
const DB = "ga-sermons", V = 1;
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open(DB, V);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("sermons")) d.createObjectStore("sermons", { keyPath: "id" });
      if (!d.objectStoreNames.contains("morceaux")) d.createObjectStore("morceaux", { autoIncrement: true }).createIndex("sermon", "sermon");
    };
    r.onsuccess = () => res(r.result); r.onerror = () => { dbP = null; rej(r.error); };
  });
  return dbP;
}
const tx = async (stores, mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(stores, mode); let out; Promise.resolve(fn(t)).then(v => { out = v; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
};
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const save = s => tx(["sermons"], "readwrite", t => req(t.objectStore("sermons").put(s)));
export const get = id => tx(["sermons"], "readonly", t => req(t.objectStore("sermons").get(id)));
export const list = () => tx(["sermons"], "readonly", t => req(t.objectStore("sermons").getAll()));
export const addChunk = (sermon, blob) => tx(["morceaux"], "readwrite", t => req(t.objectStore("morceaux").add({ sermon, blob })));
export async function audio(sermon, type) {
  const parts = await tx(["morceaux"], "readonly", t => req(t.objectStore("morceaux").index("sermon").getAll(sermon)));
  return parts.length ? new Blob(parts.map(p => p.blob), { type: type || parts[0].blob.type }) : null;
}
export async function remove(id) {
  await tx(["sermons", "morceaux"], "readwrite", t => {
    t.objectStore("sermons").delete(id);
    const idx = t.objectStore("morceaux").index("sermon"); const c = idx.openCursor(IDBKeyRange.only(id));
    c.onsuccess = () => { const cur = c.result; if (cur) { cur.delete(); cur.continue(); } };
  });
}
