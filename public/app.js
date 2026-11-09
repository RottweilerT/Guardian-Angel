// Guardian Angel — application principale (modules ES, Firebase JS SDK v10 via CDN).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, connectAuthEmulator, deleteUser, reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, onSnapshot, setDoc, deleteDoc, query, orderBy, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig as localConfig, useEmulators } from "./firebase-config.js";
import { liturgie, iso, fromIso, longDate, todayN, COUL } from "./liturgie.js";
import { ORD } from "./ordinaire.js";

/* ================= Utilitaires ================= */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem("messe-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("messe-" + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2200); }

// Nettoyage du HTML des lectures (source externe) : seules quelques balises de mise en forme sont gardées.
const ALLOWED = new Set(["P", "BR", "EM", "STRONG", "B", "I", "U", "SPAN", "SUP", "SUB", "SMALL", "DIV", "BLOCKQUOTE", "FONT"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "IMG", "SVG", "FORM", "INPUT"]);
function sanitize(html) {
  const d = new DOMParser().parseFromString("<div>" + (html || "") + "</div>", "text/html");
  const walk = node => {
    [...node.childNodes].forEach(c => {
      if (c.nodeType === 1) {
        if (DROP.has(c.tagName)) { c.remove(); return; }
        walk(c);
        if (!ALLOWED.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
        [...c.attributes].forEach(a => { if (a.name !== "class") c.removeAttribute(a.name); });
      } else if (c.nodeType !== 3) c.remove();
    });
  };
  const root = d.body.firstChild; walk(root); return root.innerHTML;
}

/* ================= État ================= */
const S = {
  cur: todayN(),
  lang: store.get("lang", "fr"),
  read: store.get("read", "full"),
  zoom: store.get("zoom", 1),
  messeIdx: 0,
  cloud: false,        // Firestore disponible (lectures)
  db: null, auth: null, user: null,
  dayDocs: {}, dayState: "", unsubDay: null, dayTimer: null,
  notes: {}, unsubNotes: null
};

/* ================= Firebase ================= */
async function loadConfig() {
  try {
    const r = await fetch("/__/firebase/init.json", { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch { /* hors Firebase Hosting */ }
  return localConfig && !String(localConfig.apiKey).startsWith("REMPLACER") ? localConfig : null;
}

async function initFirebase() {
  const cfg = await loadConfig();
  if (!cfg) return false;
  const app = initializeApp(cfg);
  S.auth = getAuth(app);
  try {
    S.db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    S.db = initializeFirestore(app, {});
  }
  if (useEmulators) {
    try { connectAuthEmulator(S.auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch {}
    try { connectFirestoreEmulator(S.db, "127.0.0.1", 8080); } catch {}
  }
  getRedirectResult(S.auth).catch(e => toast("Connexion impossible : " + (e.code || e.message)));
  return true;
}

async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(S.auth, provider); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
      await signInWithRedirect(S.auth, provider);
    } else if (e.code !== "auth/popup-closed-by-user") {
      toast("Connexion impossible : " + (e.code || e.message));
    }
  }
}

/* ================= Rendu de l'ordinaire ================= */
function lines(arr) {
  return arr.map(l => {
    if (l.startsWith("R:")) return `<p class="r">${esc(l.slice(2))}</p>`;
    if (l.startsWith("V:")) return `<p class="v">${esc(l.slice(2))}</p>`;
    if (l.startsWith("!")) return `<p class="rub">${esc(l.slice(1))}</p>`;
    return `<p>${esc(l)}</p>`;
  }).join("");
}
function textBlock(o) {
  const fr = `<div class="txt fr">${lines(o.fr)}</div>`, la = `<div class="txt la">${lines(o.la)}</div>`;
  return `<div class="cols">${S.lang === "fr" ? fr : S.lang === "la" ? la : fr + la}</div>`;
}
function item(title, inner, ref, cls = "") {
  return `<details class="item ${cls}" open><summary><span class="t">${esc(title)}</span>${ref ? `<span class="ref">${esc(ref)}</span>` : ""}</summary><div class="body">${inner}</div></details>`;
}
const ordItem = (k, t) => item(t || ORD[k].t, textBlock(ORD[k]));

/* ================= Jour liturgique ================= */
function getDay() {
  const r = liturgie(S.cur), d = S.dayDocs[iso(S.cur)];
  const info = { ...r, messes: [] };
  if (d) {
    ["titre", "sousTitre", "saint", "couleur", "temps"].forEach(k => { if (d[k]) info[k] = d[k]; });
    if (d.rang) info.rang = d.rang;
    if (info.rang === "solennite" || info.rang === "fete") info.gloria = true;
    if (info.rang === "solennite") info.credo = true;
    info.messes = Array.isArray(d.messes) ? d.messes : [];
    // compatibilité avec les documents « résumés » de l'artefact (champ lectures à plat)
    if (!info.messes.length && Array.isArray(d.lectures)) info.messes = [{ nom: "Messe du jour", lectures: d.lectures }];
    info.remarque = d.remarque;
  }
  if (info.sousTitre === info.titre) delete info.sousTitre;
  return info;
}

const LABEL = {
  lecture1: "Première lecture", lecture2: "Deuxième lecture", lecture3: "Troisième lecture", lecture4: "Quatrième lecture",
  lecture5: "Cinquième lecture", lecture6: "Sixième lecture", lecture7: "Septième lecture",
  psaume: "Psaume", psaume2: "Psaume", psaume3: "Psaume", psaume4: "Psaume", psaume5: "Psaume", psaume6: "Psaume", psaume7: "Psaume",
  sequence: "Séquence", evangile: "Évangile", entree: "Entrée messianique", epitre: "Épître"
};

function lectureBlock(l, extraAfter = "", extraBefore = "") {
  const label = LABEL[l.type] || (l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : "Lecture");
  let inner = extraBefore;
  const intro = l.titre || l.intro;
  if (intro && S.read === "full") inner += `<p class="intro">${esc(intro)}</p>`;
  if (l.refrain) inner += `<p class="refrain">${esc(l.refrain)}</p>`;
  if (S.read === "full" && l.contenu) inner += `<div class="lecture">${sanitize(l.contenu)}</div>`;
  else if (l.resume) inner += `<p class="resume">${esc(l.resume)}</p>`;
  if (extraAfter) inner += `<div style="margin-top:10px">${extraAfter}</div>`;
  return item(label, inner, l.ref, "proper");
}

function placeholder(label) {
  const msg = S.dayState === "loading" ? "Chargement des lectures…" : "Lecture pas encore disponible pour ce jour.";
  return item(label, `<p class="placeholder">${msg}</p>`, "", "proper");
}

function renderParole(L) {
  const m = L.messes[Math.min(S.messeIdx, L.messes.length - 1)];
  const fin = textBlock(ORD.parole);
  if (!m || !m.lectures || !m.lectures.length) {
    let h = placeholder("Première lecture") + placeholder("Psaume");
    if (L.deuxLectures) h += placeholder("Deuxième lecture");
    h += item("Acclamation de l'Évangile", L.alleluia ? `<p class="r">Alléluia. Alléluia.</p>` : `<p class="r">Gloire au Christ, Parole éternelle du Dieu vivant.</p>`);
    h += placeholder("Évangile");
    return h;
  }
  let h = "";
  const hasAcc = m.lectures.some(l => l.type === "acclamation" || (l.type === "evangile" && l.acclamation));
  m.lectures.forEach(l => {
    if (l.type === "acclamation") {
      h += item(L.alleluia ? "Acclamation de l'Évangile — Alléluia" : "Acclamation de l'Évangile",
        (L.alleluia ? `<p class="r">Alléluia. Alléluia.</p>` : "") + (l.resume ? `<p class="resume">${esc(l.resume)}</p>` : ""), l.ref);
      return;
    }
    if (l.type === "evangile") {
      if (l.acclamation) {
        h += item(L.alleluia ? "Acclamation de l'Évangile — Alléluia" : "Acclamation de l'Évangile",
          `<div class="lecture">${sanitize(l.acclamation.html)}</div>`, l.acclamation.ref);
      } else if (!hasAcc) {
        h += item("Acclamation de l'Évangile", L.alleluia ? `<p class="r">Alléluia. Alléluia.</p>` : `<p class="r">Gloire au Christ, Parole éternelle du Dieu vivant.</p>`);
      }
      h += lectureBlock(l, textBlock(ORD.evFin), `<div style="margin-bottom:8px">${textBlock(ORD.evIntro)}</div>`);
      return;
    }
    const isReading = /^lecture|^epitre/.test(l.type);
    h += lectureBlock(l, isReading ? fin : "");
  });
  return h;
}

function renderMass() {
  const L = getDay(), n = S.cur;
  const col = COUL[L.couleur] || COUL.vert;
  $("band").style.background = col;
  $("dateTxt").textContent = longDate(n);
  $("datePick").value = iso(n);
  $("goToday").hidden = n === todayN();
  $("titre").textContent = L.titre;
  $("sousTitre").textContent = L.sousTitre || "";
  const rangTxt = { solennite: "Solennité", fete: "Fête", memoire: "Mémoire", dimanche: "Dimanche", defunts: "Commémoration", triduum: "Triduum pascal" }[L.rang] || "Férie";
  $("chips").innerHTML = `<span class="chip"><span class="dot" style="background:${col}"></span>${esc(L.couleur)}</span><span class="chip">${esc(L.temps)}</span><span class="chip">${rangTxt}</span><span class="chip">Année ${L.annee} · semaine ${L.cycle}</span>`;
  $("saint").textContent = L.saint || "";
  document.title = "Guardian Angel — " + L.titre;

  const sel = $("messeSel");
  if (L.messes.length > 1) {
    sel.hidden = false;
    sel.innerHTML = L.messes.map((m, i) => `<option value="${i}"${i === S.messeIdx ? " selected" : ""}>${esc(m.nom)}</option>`).join("");
  } else sel.hidden = true;

  let h = "";
  if (L.pasDeMesse) h += `<p class="hidden-note">Aujourd'hui, il n'y a pas de messe : l'Église célèbre la Passion du Seigneur.</p>`;
  if (L.remarque) h += `<p class="hidden-note">${esc(L.remarque)}</p>`;

  h += `<div class="part" id="p-ouverture"><h2>Rites initiaux</h2>`;
  h += item("Chant d'entrée", `<p class="rub">Antienne d'ouverture ou chant d'entrée.</p>`);
  h += ordItem("signe") + ordItem("confiteor") + ordItem("kyrie");
  h += L.gloria ? ordItem("gloria") : `<p class="hidden-note">Pas de Gloria aujourd'hui.</p>`;
  h += ordItem("collecte") + `</div>`;

  h += `<div class="part" id="p-parole"><h2>Liturgie de la Parole</h2>`;
  h += `<div class="todo"><strong>À venir — source des lectures</strong>Le texte intégral des lectures sera récupéré automatiquement plus tard (source et méthode de scraping à définir). Pour l'instant : références et résumés quand ils sont disponibles.</div>`;
  h += renderParole(L);
  h += `<details class="item" open><summary><span class="t">Homélie</span></summary><div class="body" id="slot-notes"></div></details>`;
  h += L.credo ? ordItem("credo") : `<p class="hidden-note">Pas de Credo aujourd'hui.</p>`;
  h += ordItem("pu") + `</div>`;

  h += `<div class="part" id="p-eucharistie"><h2>Liturgie eucharistique</h2>`;
  h += ordItem("orate") + ordItem("preface") + ordItem("sanctus") + ordItem("anamnese") + ordItem("doxo");
  h += ordItem("pater") + ordItem("paix") + ordItem("agnus") + ordItem("ecce") + `</div>`;

  const ben = structuredClone(ORD.benediction);
  if (L.paschalEnvoi) {
    ben.fr[4] = "V:Allez, dans la paix du Christ, alléluia, alléluia."; ben.fr[5] = "R:Nous rendons grâce à Dieu, alléluia, alléluia.";
    ben.la[4] = "V:Ite, missa est, allelúia, allelúia."; ben.la[5] = "R:Deo grátias, allelúia, allelúia.";
  }
  h += `<div class="part" id="p-envoi"><h2>Rite de conclusion</h2>` + item(ben.t, textBlock(ben)) + `</div>`;

  document.body.appendChild($("notesBox")); // le sortir avant de réécrire #mass, sinon il serait détruit
  const m = $("mass"); m.className = S.lang === "both" ? "both" : ""; m.innerHTML = h;
  $("slot-notes").appendChild($("notesBox"));
  [...$("langSeg").children].forEach(b => b.classList.toggle("on", b.dataset.l === S.lang));
  [...$("readSeg").children].forEach(b => b.classList.toggle("on", b.dataset.r === S.read));
}

/* ================= Lectures (Firestore) ================= */
function subscribeDay() {
  if (!S.cloud) return;
  if (S.unsubDay) S.unsubDay();
  const key = iso(S.cur);
  if (!(key in S.dayDocs)) S.dayState = "loading";
  clearTimeout(S.dayTimer);
  S.dayTimer = setTimeout(() => { if (S.dayState === "loading") { S.dayState = "timeout"; renderMass(); } }, 10000);
  S.unsubDay = onSnapshot(doc(S.db, "jours", key), snap => {
    S.dayDocs[key] = snap.exists() ? snap.data() : null;
    if (!snap.metadata.fromCache) { S.dayState = ""; clearTimeout(S.dayTimer); }
    if (key === iso(S.cur)) renderMass();
  }, err => {
    console.warn("jours", err);
    S.dayState = ""; clearTimeout(S.dayTimer);
    if (key === iso(S.cur)) renderMass();
  });
}

/* ================= Notes ================= */
const NF = ["eglise", "celebrant", "homelie", "perso"];
let pending = null, saving = false, saveTimer = null;

function fillNotes() {
  const n = S.notes[iso(S.cur)] || {};
  NF.forEach(f => { $("n-" + f).value = n[f] || ""; });
  $("saveStatus").textContent = n.date ? "Enregistré" : "";
}
function readNotes() {
  const o = { date: iso(S.cur), titreJour: getDay().titre };
  NF.forEach(f => { o[f] = $("n-" + f).value; });
  return o;
}
const isEmpty = o => NF.every(f => !String(o[f] || "").trim());

function onInput() {
  pending = readNotes();
  $("saveStatus").textContent = "Modification…";
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900);
}

async function flush() {
  clearTimeout(saveTimer);
  if (saving || !pending) return;
  const o = pending; pending = null; saving = true;
  const empty = isEmpty(o);
  if (empty) delete S.notes[o.date]; else S.notes[o.date] = { ...o, updatedAt: Date.now() };
  try {
    if (S.user) {
      const ref = doc(S.db, "users", S.user.uid, "notes", o.date);
      const p = empty ? deleteDoc(ref) : setDoc(ref, { ...o, updatedAt: serverTimestamp() });
      // hors ligne, Firestore garde l'écriture en file d'attente : on n'attend pas le serveur pour l'afficher
      if (!navigator.onLine) { if (o.date === iso(S.cur)) $("saveStatus").textContent = "Enregistré sur l'appareil — synchronisation au retour du réseau"; p.catch(() => {}); }
      else { await p; if (o.date === iso(S.cur)) $("saveStatus").textContent = empty ? "" : "Enregistré ✓"; }
    } else {
      store.set("notes", S.notes);
      if (o.date === iso(S.cur)) $("saveStatus").textContent = empty ? "" : "Enregistré sur cet appareil ✓";
    }
  } catch (e) {
    console.error(e);
    if (o.date === iso(S.cur)) $("saveStatus").textContent = "Échec de l'enregistrement — réessayez";
  }
  saving = false;
  if (pending) flush();
  if (!$("view-notes").hidden) renderNotesList();
}
NF.forEach(f => $("n-" + f).addEventListener("input", onInput));

function subscribeNotes() {
  if (S.unsubNotes) S.unsubNotes();
  S.unsubNotes = onSnapshot(query(collection(S.db, "users", S.user.uid, "notes"), orderBy("date", "desc")), snap => {
    const m = {};
    snap.docs.forEach(d => { const v = d.data(); if (v && v.date) m[v.date] = { ...v, updatedAt: v.updatedAt?.toMillis ? v.updatedAt.toMillis() : v.updatedAt }; });
    S.notes = m;
    const active = NF.some(f => document.activeElement?.id === "n-" + f);
    if (!active && !pending) fillNotes();
    if (!$("view-notes").hidden) renderNotesList();
  }, err => console.warn("notes", err));
}

// Notes prises sans compte sur cet appareil : on les envoie une fois au premier passage connecté.
async function migrateLocalNotes() {
  const local = store.get("notes", {});
  const keys = Object.keys(local);
  if (!keys.length) return;
  const batch = writeBatch(S.db);
  keys.forEach(k => batch.set(doc(S.db, "users", S.user.uid, "notes", k), { ...local[k], updatedAt: serverTimestamp() }, { merge: true }));
  try { await batch.commit(); store.set("notes", {}); toast(keys.length + " note(s) de cet appareil synchronisée(s)"); } catch (e) { console.warn(e); }
}

function renderNotesList() {
  const q = $("search").value.trim().toLowerCase();
  const arr = Object.values(S.notes)
    .filter(n => !q || NF.concat("titreJour").some(f => String(n[f] || "").toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  updateAccountUI();
  if (!arr.length) { $("nlist").innerHTML = `<p class="empty">${q ? "Aucune note ne correspond." : "Pas encore de notes. Elles apparaîtront ici après votre première messe."}</p>`; return; }
  $("nlist").innerHTML = arr.map(n => {
    const meta = [n.eglise, n.celebrant].filter(Boolean).join(" · ");
    return `<div class="ncard"><div class="d">${esc(longDate(fromIso(n.date)))}${meta ? " — " + esc(meta) : ""}</div><div class="tt">${esc(n.titreJour || "")}</div><div class="ex">${esc([n.homelie, n.perso].filter(Boolean).join("\n\n"))}</div><div class="acts"><button data-open="${n.date}">Ouvrir ce jour</button><button data-copy="${n.date}">Copier</button></div></div>`;
  }).join("");
}

function noteToText(n) {
  return `${longDate(fromIso(n.date))} — ${n.titreJour || ""}\n${[n.eglise, n.celebrant].filter(Boolean).join(" · ")}\n\n${n.homelie || ""}\n\n${n.perso || ""}`.trim();
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sortedNotes() { return Object.values(S.notes).sort((a, b) => a.date.localeCompare(b.date)); }

$("exportJson").onclick = () => download("notes-messe.json", JSON.stringify(sortedNotes().map(n => { const o = { ...n }; delete o.updatedAt; return o; }), null, 2), "application/json");
$("exportMd").onclick = () => {
  const md = "# Mes notes de messe\n\n" + sortedNotes().map(n =>
    `## ${longDate(fromIso(n.date))} — ${n.titreJour || ""}\n` +
    ([n.eglise, n.celebrant].filter(Boolean).length ? `*${[n.eglise, n.celebrant].filter(Boolean).join(" · ")}*\n\n` : "\n") +
    (n.homelie ? `### Homélie\n${n.homelie}\n\n` : "") + (n.perso ? `### Résolution\n${n.perso}\n\n` : "")).join("");
  download("notes-messe.md", md, "text/markdown");
};
$("importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (f) importNotes(await f.text());
});
$("importPaste").onclick = async () => {
  try { importNotes(await navigator.clipboard.readText()); }
  catch { toast("Lecture du presse-papiers refusée — utilisez « Importer un fichier »"); }
};
async function importNotes(text) {
  try {
    const data = JSON.parse(text);
    const list = (Array.isArray(data) ? data : Object.values(data)).filter(n => n && /^\d{4}-\d{2}-\d{2}$/.test(n.date));
    if (!list.length) throw new Error("aucune note valide");
    const clean = n => { const o = { date: n.date, titreJour: String(n.titreJour || "") }; NF.forEach(k => { o[k] = String(n[k] || ""); }); return o; };
    if (S.user) {
      for (let i = 0; i < list.length; i += 400) {
        const b = writeBatch(S.db);
        list.slice(i, i + 400).forEach(n => b.set(doc(S.db, "users", S.user.uid, "notes", n.date), { ...clean(n), updatedAt: serverTimestamp() }));
        await b.commit();
      }
    } else {
      list.forEach(n => { S.notes[n.date] = { ...clean(n), updatedAt: Date.now() }; });
      store.set("notes", S.notes);
      renderNotesList();
    }
    toast(list.length + " note(s) importée(s)");
  } catch (err) { toast("Import impossible : " + err.message); }
}

$("nlist").addEventListener("click", async e => {
  const o = e.target.dataset.open, c = e.target.dataset.copy;
  if (o) { showView("messe"); goTo(fromIso(o)); setTimeout(() => $("notesBox").scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
  if (c) {
    try { await navigator.clipboard.writeText(noteToText(S.notes[c])); toast("Note copiée"); }
    catch { toast("Copie impossible"); }
  }
});
$("search").addEventListener("input", renderNotesList);

/* ================= Navigation ================= */
function goTo(n, fromHash) {
  if (pending) flush();
  S.cur = n; S.messeIdx = 0;
  fillNotes(); renderMass(); subscribeDay();
  if (!fromHash) history.replaceState(null, "", n === todayN() ? location.pathname : "#/" + iso(n));
  window.scrollTo({ top: 0 });
}
function showView(v) {
  $("view-messe").hidden = v !== "messe"; $("view-notes").hidden = v !== "notes";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.view === v));
  $("fab").hidden = v !== "messe";
  if (v === "notes") { renderNotesList(); history.replaceState(null, "", "#/notes"); }
  else if (location.hash === "#/notes") history.replaceState(null, "", S.cur === todayN() ? location.pathname : "#/" + iso(S.cur));
  window.scrollTo({ top: 0 });
}
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "notes") { showView("notes"); return; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(h)) { showView("messe"); goTo(fromIso(h), true); return; }
}
window.addEventListener("hashchange", route);

$("prev").onclick = () => goTo(S.cur - 1);
$("next").onclick = () => goTo(S.cur + 1);
$("goToday").onclick = () => goTo(todayN());
$("datePick").addEventListener("change", e => { if (e.target.value) goTo(fromIso(e.target.value)); });
$("langSeg").addEventListener("click", e => { const l = e.target.dataset.l; if (!l) return; S.lang = l; store.set("lang", l); renderMass(); });
$("readSeg").addEventListener("click", e => { const r = e.target.dataset.r; if (!r) return; S.read = r; store.set("read", r); renderMass(); });
$("messeSel").addEventListener("change", e => { S.messeIdx = +e.target.value; renderMass(); });
$("foldSeg").addEventListener("click", e => { const f = e.target.dataset.f; if (!f) return; document.querySelectorAll("#mass details").forEach(d => { d.open = f === "open"; }); });
document.querySelector(".jump").addEventListener("click", e => {
  const j = e.target.dataset.j; if (!j) return;
  const el = $(j); const d = el.closest("details"); if (d) d.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("fab").onclick = () => {
  showView("messe"); const d = $("notesBox").closest("details"); if (d) d.open = true;
  $("notesBox").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("n-homelie").focus({ preventScroll: true }), 400);
};
document.querySelectorAll(".tab").forEach(t => { t.onclick = () => showView(t.dataset.view); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && pending) flush();
  if (!document.hidden && wakeOn) requestWake();
  if (!document.hidden && S.cur !== todayN() && !location.hash) goTo(todayN()); // l'appli reste ouverte d'un jour à l'autre
});
window.addEventListener("beforeunload", () => { if (pending) flush(); });

// Taille du texte
function applyZoom() { $("wrap").style.zoom = S.zoom; store.set("zoom", S.zoom); }
$("zoomIn").onclick = () => { S.zoom = Math.min(1.6, +(S.zoom + 0.1).toFixed(2)); applyZoom(); };
$("zoomOut").onclick = () => { S.zoom = Math.max(0.8, +(S.zoom - 0.1).toFixed(2)); applyZoom(); };

// Garder l'écran allumé pendant la messe
let wakeLock = null, wakeOn = false;
async function requestWake() {
  try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
  catch { wakeOn = false; $("wake").classList.remove("on"); toast("Impossible de garder l'écran allumé sur cet appareil"); }
}
$("wake").onclick = async () => {
  if (!("wakeLock" in navigator)) { toast("Fonction non disponible sur ce navigateur"); return; }
  wakeOn = !wakeOn; $("wake").classList.toggle("on", wakeOn);
  if (wakeOn) { await requestWake(); if (wakeOn) toast("L'écran restera allumé"); } else if (wakeLock) { wakeLock.release(); toast("Mise en veille normale"); }
};

function banner(msg) { const b = $("banner"); b.textContent = msg; b.hidden = !msg; }
window.addEventListener("offline", () => banner("Hors ligne — les données déjà chargées restent disponibles."));
window.addEventListener("online", () => banner(""));

/* ================= Compte ================= */
function updateAccountUI() {
  const u = S.user;
  $("who").textContent = u ? "Connecté : " + (u.email || u.displayName) + " — notes synchronisées"
    : S.auth ? "Non connecté — notes enregistrées sur cet appareil uniquement" : "Notes enregistrées sur cet appareil";
  $("logout").textContent = u ? "Se déconnecter" : "Se connecter avec Google";
  $("logout").hidden = !S.auth;
  $("deleteAccount").hidden = !u;
  $("noteSync").hidden = !!u || !S.auth;
}
$("logout").onclick = async () => {
  if (S.user) { if (pending) await flush(); await signOut(S.auth); toast("Déconnecté"); }
  else login();
};
$("noteLogin").onclick = e => { e.preventDefault(); login(); };

// Suppression du compte et de toutes les notes (RGPD)
let confirmTimer = null;
$("deleteAccount").onclick = async () => {
  const btn = $("deleteAccount");
  if (!btn.dataset.armed) {   // double clic de confirmation (pas de confirm() bloquant)
    btn.dataset.armed = "1"; btn.textContent = "Confirmer : tout supprimer définitivement";
    clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = "Supprimer mon compte et mes notes"; }, 6000);
    return;
  }
  clearTimeout(confirmTimer); delete btn.dataset.armed; btn.disabled = true; btn.textContent = "Suppression…";
  try {
    const user = S.user;
    if (S.unsubNotes) { S.unsubNotes(); S.unsubNotes = null; }
    const dates = Object.keys(S.notes);
    for (let i = 0; i < dates.length; i += 400) {
      const b = writeBatch(S.db);
      dates.slice(i, i + 400).forEach(d => b.delete(doc(S.db, "users", user.uid, "notes", d)));
      await b.commit();
    }
    try { await deleteUser(user); }
    catch (e) {
      if (e.code !== "auth/requires-recent-login") throw e;
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await deleteUser(user);
    }
    S.notes = {}; store.set("notes", {}); fillNotes(); renderNotesList();
    toast("Compte et notes supprimés");
  } catch (e) {
    console.error(e); toast("Suppression interrompue : " + (e.code || e.message));
    if (S.user) subscribeNotes();
  }
  btn.disabled = false; btn.textContent = "Supprimer mon compte et mes notes";
};

/* ================= Démarrage ================= */
applyZoom(); S.notes = store.get("notes", {}); fillNotes(); renderMass(); route();

(async () => {
  const ok = await initFirebase().catch(e => { console.error(e); return false; });
  if (!ok) { updateAccountUI(); return; }      // sans Firebase : calendrier, ordinaire et notes locales
  S.cloud = true;
  subscribeDay();                              // les lectures sont publiques : pas besoin de compte
  onAuthStateChanged(S.auth, user => {
    S.user = user;
    if (user) { subscribeNotes(); migrateLocalNotes(); }
    else { if (S.unsubNotes) { S.unsubNotes(); S.unsubNotes = null; } S.notes = store.get("notes", {}); fillNotes(); }
    updateAccountUI();
    if (!$("view-notes").hidden) renderNotesList();
  });
})();

if ("serviceWorker" in navigator && !useEmulators) {
  navigator.serviceWorker.register("/sw.js").catch(e => console.warn("SW", e));
}
