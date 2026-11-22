// Onglet « Sermon » : un seul espace vertical pour suivre tout le parcours d'un sermon.
//   1. Audio du sermon      — enregistrement (pause, reprise, sauvegarde toutes les 5 s), lecteur (×1, ×1,5, ×2)
//   2. Transcription        — sur l'appareil (Whisper), par tranches, reprise possible ; lecture, correction, copie,
//                             analyse d'un passage sélectionné
//   3. Comprendre le sermon — plan détaillé et résumé
//   4. Mes notes            — notes personnelles + approfondissement croisé (sermon / analyses / notes)
// IA : choix de l'utilisateur, « Copier vers Claude » — chaque bouton prépare une demande complète, la copie et ouvre Claude ;
// la réponse est collée dans l'application et conservée. Rien n'est envoyé automatiquement à un service d'IA.
// Stockage : uniquement sur l'appareil (IndexedDB « ga-sermons »).
import { esc, $, $$, toast, today, frDate, modal, BTN_SUPPR, brancherSuppression } from "../ui.js";
import * as store from "../store.js";
import * as sdb from "../sermon-db.js";

const TYPES = { ok: ["✓", "Compris"], q: ["?", "Pas compris"], imp: ["★", "Important"], note: ["✎", "Note"] };
const hms = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(x).padStart(2, "0"); };
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
const CLAUDE = "https://claude.ai/new";
// Légendes accolées à chaque note (une ou plusieurs par note)
const LEGENDES = [
  ["Compris", "✓"], ["Pas compris", "?"], ["Ma réflexion", "💭"], ["Dit par l'abbé", "🗣"],
  ["Question", "❓"], ["Important", "★"], ["Référence biblique", "📖"], ["À vivre", "🎯"],
];
const RE_LEG = new RegExp("\\s*\\[(" + LEGENDES.map(([l]) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\]", "g");
// texte libre → [{ texte, legendes[] }] (une ligne = une note)
const lireNotes = t => (t || "").split("\n").map(l => ({ legendes: [...l.matchAll(RE_LEG)].map(m => m[1]), texte: l.replace(RE_LEG, "").trim() })).filter(n => n.texte);
// anciennes notes (versions précédentes de l'onglet) → texte avec légendes
function migrerNotes(s) {
  if (s.notesTexte != null) return;
  const L = { ok: "Compris", q: "Pas compris", imp: "Important" }, M = { questions: "Question", flou: "Pas compris", marquants: "Important", comprehension: "Ma réflexion" }, lignes = [];
  for (const [k, v] of Object.entries(s.mesNotes || {})) for (const l of (v || "").split("\n")) if (l.trim()) lignes.push(l.trim() + (M[k] ? ` [${M[k]}]` : ""));
  for (const n of s.notes || []) { const t = n.texte || (n.contexte ? `« ${n.contexte} »` : ""); if (t) lignes.push(t + (L[n.type] ? ` [${L[n.type]}]` : "") + (n.contexte && n.texte ? ` [Dit par l'abbé]` : "")); }
  s.notesTexte = lignes.join("\n");
}
const IA = {
  plan: { titre: "Plan détaillé et expliqué", bouton: "Générer le plan détaillé" },
  resume: { titre: "Résumé du sermon", bouton: "Générer le résumé" },
  approfondir: { titre: "Résumé de mes notes et approfondissement", bouton: "Résumer et approfondir mes notes" },
};

// ---------------------------------------------------------------- enregistrement (global : continue hors de la page)
const R = { actif: false };
let rafId = 0;
const duree = () => !R.actif ? 0 : (R.cumul + (R.pause ? 0 : (Date.now() - R.depart) / 1000));
function pastille() {
  let p = document.getElementById("pastilleSermon");
  const ici = location.hash === "#/sermon/" + R.id;
  if (R.actif && !ici && !p) {
    p = document.createElement("a"); p.id = "pastilleSermon"; p.href = "#/sermon/" + R.id;
    p.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(74px + env(safe-area-inset-bottom,0px));z-index:900;background:#B3261E;color:#fff;border-radius:999px;padding:7px 14px;font-size:14px;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.25)";
    document.body.appendChild(p);
  }
  if ((!R.actif || ici) && p) { p.remove(); p = null; }
  if (p) p.textContent = `● ${R.pause ? "En pause" : "Enregistrement"} ${hms(duree())}`;
}
setInterval(() => {
  if (!R.actif) return;
  pastille();
  const t = document.getElementById("srTemps"); if (t) t.textContent = hms(duree());
  if (R.s && Date.now() - (R.dernier || 0) > 15000) { R.dernier = Date.now(); R.s.duree = Math.round(duree()); sdb.save(R.s).catch(() => {}); }
}, 1000);
window.addEventListener("hashchange", pastille);
const avantFermeture = e => { if (R.actif) { e.preventDefault(); e.returnValue = ""; } };

async function demarrer(opts) {
  const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  try { await navigator.storage?.persist?.(); } catch {}                       // évite que le navigateur efface l'audio pour faire de la place
  const id = "s" + Date.now().toString(36);
  const s = { id, date: today(), debut: new Date().toISOString(), eglise: opts.eglise || "", predicateur: opts.predicateur || "", accord: true, mime: MIME,
    duree: 0, enCours: true, transcription: [], notesTexte: "", ia: {}, passages: [] };
  await sdb.save(s);
  const rec = new MediaRecorder(flux, MIME ? { mimeType: MIME, audioBitsPerSecond: 32000 } : undefined);
  rec.ondataavailable = e => { if (e.data && e.data.size) sdb.addChunk(id, e.data).catch(() => toast("⚠ Sauvegarde de l'audio impossible : stockage plein ?")); };
  rec.onerror = () => toast("⚠ L'enregistrement a été interrompu par le téléphone ; l'audio déjà enregistré est conservé.");
  rec.start(5000);                                    // un morceau toutes les 5 s : rien n'est perdu si l'appli se ferme
  Object.assign(R, { actif: true, pause: false, id, s, flux, rec, depart: Date.now(), cumul: 0, dernier: Date.now() });
  flux.getAudioTracks()[0]?.addEventListener("ended", () => { if (R.actif) toast("⚠ Le micro a été coupé par le téléphone ; arrêtez et sauvegardez."); });
  try { R.lock = await navigator.wakeLock?.request("screen"); } catch {}
  document.addEventListener("visibilitychange", reverrouiller);
  window.addEventListener("beforeunload", avantFermeture);
  try { const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(flux).connect(an); R.ac = ac; R.an = an; } catch {}
  return id;
}
async function reverrouiller() { if (R.actif && document.visibilityState === "visible") try { R.lock = await navigator.wakeLock?.request("screen"); } catch {} }
function basculerPause() {
  if (!R.actif) return;
  if (R.pause) { R.rec.resume(); R.depart = Date.now(); R.pause = false; }
  else { R.rec.pause(); R.cumul += (Date.now() - R.depart) / 1000; R.pause = true; }
  pastille();
}
async function terminer() {
  const s = R.s; s.duree = Math.round(duree()); s.enCours = false;
  await new Promise(res => { R.rec.onstop = res; try { R.rec.stop(); } catch { res(); } });
  R.flux.getTracks().forEach(t => t.stop()); try { R.ac?.close(); } catch {} try { R.lock?.release(); } catch {}
  document.removeEventListener("visibilitychange", reverrouiller);
  window.removeEventListener("beforeunload", avantFermeture);
  cancelAnimationFrame(rafId);
  Object.assign(R, { actif: false, rec: null, flux: null, s: null });
  await sdb.save(s); pastille();
  return s;
}
// Enregistrement resté « en cours » alors que l'application a été fermée : on le récupère tel quel
async function recuperer(s) {
  if (!s.enCours || (R.actif && R.id === s.id)) return s;
  const n = await sdb.nbMorceaux(s.id).catch(() => 0);
  Object.assign(s, { enCours: false, interrompu: true, duree: Math.max(s.duree || 0, n * 5) });
  await sdb.save(s);
  return s;
}

// ---------------------------------------------------------------- transcription (par tranches de 5 min, reprise possible)
const JOBS = new Map();          // id → { etat, pct, msg }
const TRANCHE = 300;
function decoupe(audio, debut) { // fin de tranche placée dans un silence, pour ne pas couper un mot
  const sr = 16000, cible = debut + TRANCHE * sr;
  if (cible >= audio.length) return audio.length;
  let best = cible, min = Infinity;
  for (let p = cible - 5 * sr; p < Math.min(audio.length - 1600, cible + 5 * sr); p += 1600) {
    let e = 0; for (let i = p; i < p + 1600; i += 4) e += audio[i] * audio[i];
    if (e < min) { min = e; best = p + 800; }
  }
  return best;
}
function majEtatTranscription(id) {
  const box = document.getElementById("trEtat"); if (!box || box.dataset.id !== id) return;
  const j = JOBS.get(id);
  box.innerHTML = j ? `${j.etat === "erreur" ? "⚠ " : ""}${esc(j.msg)}${j.etat !== "erreur" ? `<div class="barre"><div style="width:${Math.round(j.pct || 0)}%"></div></div>` : ""}` : "";
}
async function transcrireSermon(id, { reprendre }) {
  if (JOBS.get(id)?.etat === "cours") return;
  const j = { etat: "cours", pct: 0, msg: "Préparation de l'audio…" }; JOBS.set(id, j);
  const dire = (msg, pct) => { j.msg = msg; if (pct != null) j.pct = pct; majEtatTranscription(id); };
  let lock = null, w = null; try { lock = await navigator.wakeLock?.request("screen"); } catch {}
  try {
    let s = await sdb.get(id);
    const blob = await sdb.audio(id, s.mime);
    if (!blob) throw new Error("audio introuvable");
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close();
    const audio = buf.getChannelData(0), total = audio.length / 16000;
    let fait = reprendre && s.trEtat ? s.trEtat.fait || 0 : 0;
    if (!fait) { s.transcription = []; }
    s.trEtat = { fait, total, termine: false }; await sdb.save(s);
    // un moteur : worker si possible, sinon dans la page
    let moteur = null;
    const viaWorker = () => new Promise((ok, ko) => {
      try { w = new Worker("/js/transcription-worker.js", { type: "module" }); } catch { ko(); return; }
      const garde = setTimeout(() => { w.terminate(); w = null; ko(); }, 20000);
      w.onmessage = ({ data: m }) => { if (m.type === "demarre") { clearTimeout(garde); ok(); } };
      w.onerror = e => { e.preventDefault?.(); clearTimeout(garde); w?.terminate(); w = null; ko(); };
    });
    try {
      await viaWorker();
      moteur = (tr, suivi) => new Promise((ok, ko) => {
        w.onmessage = ({ data: m }) => { if (m.type === "fini") ok(m.morceaux); else if (m.type === "erreur") ko(new Error(m.message)); else suivi(m); };
        w.onerror = e => { e.preventDefault?.(); ko(new Error(e.message || "erreur du module de transcription")); };
        w.postMessage({ type: "transcrire", audio: tr }, [tr.buffer]);
      });
    } catch {
      const { transcrire } = await import("/js/transcrire.js");
      moteur = (tr, suivi) => transcrire(tr, suivi);
    }
    while (fait < total - 1) {
      const a = Math.round(fait * 16000), b = decoupe(audio, a), tr = audio.slice(a, b), dt = (b - a) / 16000;
      const morceaux = await moteur(tr, m => {
        if (m.type === "telechargement") dire(`Téléchargement du modèle de reconnaissance vocale : ${m.total ? Math.round(100 * m.loaded / m.total) + " %" : Math.round(m.loaded / 1e6) + " Mo"} (une seule fois)`, 0);
        else if (m.type === "avance") dire(`Transcription en cours… ${hms(fait + Math.min(m.fait, dt))} sur ${hms(total)}`, 100 * (fait + Math.min(m.fait, dt)) / total);
        else if (m.type === "pret") dire(`Transcription en cours… ${hms(fait)} sur ${hms(total)}`, 100 * fait / total);
      });
      s = await sdb.get(id);                                   // relu : l'utilisateur a pu écrire des notes entre-temps
      s.transcription.push(...morceaux.map(x => ({ t: Math.round(fait + x.t), texte: x.texte })));
      fait += dt; s.trEtat = { fait, total, termine: fait >= total - 1 };
      await sdb.save(s);
      dire(`Transcription en cours… ${hms(fait)} sur ${hms(total)} (enregistrée au fur et à mesure)`, 100 * fait / total);
      rafraichirTranscription(id, s);
    }
    j.etat = "fini"; dire("Transcription terminée.", 100);
    toast("Transcription terminée");
    const fin = await sdb.get(id);
    rafraichirTranscription(id, fin, true);
    if (document.getElementById("trEtat")?.dataset.id === id) for (const type of Object.keys(IA)) {     // les analyses deviennent possibles
      const box = document.getElementById("ia_" + type); if (box) box.outerHTML = blocIA(fin, type);
    }
    if (document.getElementById("trEtat")?.dataset.id === id) brancherIA(document, id);
  } catch (e) {
    const m = String(e && e.message || e);
    const aide = /import|fetch|module|Content Security|NetworkError|Load failed/i.test(m)
      ? "Le moteur de transcription n'a pas pu être téléchargé : vérifiez la connexion, puis fermez complètement l'application et rouvrez-la."
      : /memory|mémoire|allocation|OOM/i.test(m) ? "Le téléphone manque de mémoire : fermez les autres applications puis « Reprendre »." : "Vous pouvez reprendre là où la transcription s'est arrêtée.";
    j.etat = "erreur"; dire(`Transcription interrompue (${m.slice(0, 160)}). ${aide}`);
    rafraichirTranscription(id, await sdb.get(id).catch(() => null), true);
  } finally { try { lock?.release(); } catch {} try { w?.terminate(); } catch {} }
}

// ---------------------------------------------------------------- demandes préparées pour Claude
const entete = s => `Sermon (homélie) catholique${s.eglise ? `, église ${s.eglise}` : ""}, ${frDate(s.date)}${s.predicateur ? `, prédicateur : ${s.predicateur}` : ""}, durée ${hms(s.duree)}.`;
const texteTr = s => s.transcription.map(x => `[${hms(x.t)}] ${x.texte}`).join("\n");
const AVERT = "La transcription a été faite automatiquement : elle peut contenir des erreurs (noms propres, citations). Ne complète pas ce qui manque et n'invente aucun propos du prédicateur ; si un passage est incompréhensible, dis-le.";
const mesNotesTexte = s => {
  migrerNotes(s);
  const notes = lireNotes(s.notesTexte);
  if (!notes.length) return "(aucune note)";
  const tout = notes.map((n, i) => `${i + 1}. ${n.texte}${n.legendes.length ? "  [" + n.legendes.join(", ") + "]" : "  [sans légende]"}`).join("\n");
  const groupes = LEGENDES.map(([l]) => { const x = notes.map((n, i) => n.legendes.includes(l) ? i + 1 : 0).filter(Boolean); return x.length ? `- ${l} : notes ${x.join(", ")}` : ""; }).filter(Boolean).join("\n");
  return `Mes notes, dans l'ordre (chaque note porte entre crochets la ou les légendes que je lui ai données) :\n${tout}\n\nRépartition par légende :\n${groupes || "(aucune légende)"}`;
};
function demande(type, s, passage) {
  if (type === "plan") return `${entete(s)}
${AVERT}

Rédige en français un PLAN DÉTAILLÉ ET EXPLIQUÉ de ce sermon, assez complet pour retrouver tout le raisonnement du prédicateur :
1. Le thème central.
2. Le contexte général et l'introduction du prédicateur.
3. Les grandes parties, dans leur ordre réel (avec un titre chacune et le moment approximatif [m:ss]).
4. Pour chaque partie : les sous-parties et les idées développées, expliquées en quelques phrases (pas seulement des titres).
5. Les arguments, exemples et illustrations utilisés.
6. Les références bibliques mentionnées (avec la référence exacte quand elle est identifiable ; signale celles qui sont incertaines).
7. L'explication des principaux enseignements.
8. Les applications pratiques et spirituelles proposées.
9. La conclusion et le message final.
Distingue toujours ce que le prédicateur a dit (marqué « Sermon : ») de ce que tu ajoutes pour expliquer (marqué « Explication : »). Utilise des titres (#, ##) et des listes.

TRANSCRIPTION
${texteTr(s)}`;
  if (type === "resume") return `${entete(s)}
${AVERT}

Rédige en français un RÉSUMÉ clair, fidèle et court (15 lignes au maximum) de ce sermon :
- le sujet principal ;
- le message essentiel du prédicateur ;
- les principales idées à retenir ;
- les enseignements spirituels importants ;
- les applications concrètes pour la vie quotidienne, s'il y en a.
Ne rapporte que ce qui a été dit ; n'ajoute pas d'idées qui ne sont pas dans le sermon.

TRANSCRIPTION
${texteTr(s)}`;
  if (type === "approfondir") return `${entete(s)}
${s.transcription.length ? AVERT : "Je n'ai pas de transcription : seulement mes notes."}

Je suis un paroissien. J'ai pris des notes pendant le sermon et j'ai mis une légende sur chacune : Compris, Pas compris, Ma réflexion (ce que j'ai pensé moi-même), Dit par l'abbé (ce que le prédicateur a dit), Question, Important, Référence biblique, À vivre.
Fais-moi, en français, de façon pédagogique, bienveillante et rigoureuse :
1. Un RÉSUMÉ DU SERMON À PARTIR DE MES NOTES, organisé ainsi :
   - ce que l'abbé a clairement dit (notes « Dit par l'abbé ») ;
   - ce que j'ai compris ;
   - ce que je n'ai pas compris — explique chaque point simplement${s.transcription.length ? ", en citant le passage du sermon correspondant avec [m:ss]" : ""} ;
   - mes propres réflexions (notes « Ma réflexion »), en les distinguant bien de ce qu'a dit l'abbé${s.transcription.length ? ", et en signalant si elles rejoignent ou non le sermon (sans jamais juger une réflexion fausse sans t'appuyer sur ce qu'il dit)" : ""} ;
   - les réponses à mes questions ;
   - ce que je retiens d'important et ce que je veux vivre.
${s.transcription.length ? "2. Les idées importantes du sermon absentes de mes notes.\n3. Les notes dont la légende semble ne pas correspondre au sermon (par exemple une note « Dit par l'abbé » qu'on ne retrouve pas dans la transcription).\n4." : "2."} Deux ou trois pistes pour prolonger ma réflexion et ma prière.
Distingue toujours trois voix : « L'abbé : » (ce qui a été dit), « Vos notes : » (ce que j'ai écrit), « Explication : » (ce que tu ajoutes, en t'appuyant sur l'enseignement de l'Église catholique quand c'est utile).

MES NOTES
${mesNotesTexte(s)}
${s.transcription.length ? `
TRANSCRIPTION
${texteTr(s)}

PLAN DÉTAILLÉ
${s.ia?.plan?.texte || "(pas encore généré)"}

RÉSUMÉ
${s.ia?.resume?.texte || "(pas encore généré)"}` : ""}`;
  return `${entete(s)}
${AVERT}

Explique-moi précisément, en français, le PASSAGE ci-dessous de ce sermon : ce que le prédicateur veut dire, les mots ou références difficiles, et comment ce passage s'inscrit dans l'ensemble du sermon (la transcription complète est donnée en contexte). Distingue ce qui est dit dans le sermon (« Sermon : ») de tes explications (« Explication : »).

PASSAGE
« ${passage} »

TRANSCRIPTION COMPLÈTE (contexte)
${texteTr(s)}`;
}
async function envoyerVersClaude(texte) {
  let copie = false;
  try { await navigator.clipboard.writeText(texte); copie = true; } catch {}
  const court = encodeURIComponent(texte).length < 7000;
  window.open(court ? CLAUDE + "?q=" + encodeURIComponent(texte) : CLAUDE, "_blank", "noopener");
  if (copie) toast(court ? "Demande prête dans Claude (aussi copiée)" : "Demande copiée : collez-la dans Claude, puis rapportez la réponse ici");
  else await modal(`<h2>Copier la demande</h2><p class="small">Copiez ce texte et collez-le dans Claude.</p><textarea style="min-height:240px" readonly>${esc(texte)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close="x">Fermer</button></div>`, d => d.querySelector("textarea").select());
}

// Petit rendu Markdown (titres, listes, gras) pour les réponses de Claude
function md(t) {
  const lignes = esc(t || "").split("\n"); let h = "", liste = null;
  const ferme = () => { if (liste) { h += `</${liste}>`; liste = null; } };
  const inl = x => x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/\[(\d+:\d\d(?::\d\d)?)\]/g, `<button class="ts" data-t="$1">$1</button>`);
  for (const l of lignes) {
    let m;
    if ((m = l.match(/^\s*(#{1,4})\s+(.*)$/))) { ferme(); h += `<h${Math.min(5, m[1].length + 2)} class="serif">${inl(m[2])}</h${Math.min(5, m[1].length + 2)}>`; }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (liste !== "ul") { ferme(); h += "<ul>"; liste = "ul"; } h += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (liste !== "ol") { ferme(); h += "<ol>"; liste = "ol"; } h += `<li>${inl(m[1])}</li>`; }
    else if (!l.trim()) ferme();
    else { ferme(); h += `<p>${inl(l)}</p>`; }
  }
  ferme(); return h;
}
const secondes = t => t.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);

// ---------------------------------------------------------------- page d'accueil de l'onglet
export default async function sermon(el, [id]) {
  if (id) return page(el, id);
  if (R.actif) { location.hash = "#/sermon/" + R.id; return; }
  const mc = store.prefs.get("messeEnCours", null), egliseJour = mc && mc.date === today() ? mc.eglise : "";
  const tous = (await Promise.all((await sdb.list().catch(() => [])).map(recuperer))).sort((a, b) => (b.debut || "").localeCompare(a.debut || ""));
  const ok = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  el.innerHTML = `<section class="hero"><div class="kicker">Homélie</div><h1>Sermon</h1><p>J'enregistre → je réécoute → je transcris → je comprends → j'approfondis avec mes notes.</p><span class="orn"></span></section>
  ${ok ? `<section class="bloc"><h2 class="bloc-t"><span class="num">1</span> Enregistrer un nouveau sermon</h2>
    <label for="se">Église</label><input id="se" maxlength="200" value="${esc(egliseJour)}">
    <label for="sp">Prédicateur (facultatif)</label><input id="sp" maxlength="120">
    <label class="field-inline" style="margin-top:12px"><input type="checkbox" id="sa"> Le prédicateur a donné son accord pour l'enregistrement, réservé à mon usage personnel</label>
    <p class="center" style="margin:14px 0 0"><button class="btn gros" id="sgo" disabled><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg> Enregistrer le sermon</button></p>
    <p class="small muted" style="margin:10px 0 0">L'audio est sauvegardé sur ce téléphone toutes les 5 secondes : rien n'est perdu si l'application se ferme. L'écran reste allumé pendant l'enregistrement.</p>
  </section>` : `<div class="notice">L'enregistrement audio n'est pas possible sur ce navigateur.</div>`}
  <h2 class="sec">Mes sermons</h2>
  ${tous.length ? `<ul class="list" id="slist">${tous.map(s => `<li style="display:flex;gap:10px;align-items:flex-start"><a href="#/sermon/${s.id}" style="text-decoration:none;color:inherit;display:block;flex:1"><strong class="serif">${esc(s.eglise || "Sermon")}</strong> <span class="small muted">— ${esc(frDate(s.date))} · ${hms(s.duree)}</span><br>
    <span class="small muted">${etapes(s)}</span></a>${BTN_SUPPR(s.id)}</li>`).join("")}</ul>` : `<div class="empty">Aucun sermon enregistré.</div>`}
  <details class="small" style="margin-top:18px"><summary class="muted">Où vont mes données ?</summary>${confidentialite()}</details>`;
  const sl = $("#slist", el);
  if (sl) brancherSuppression(sl, async sid => { try { await sdb.remove(sid); toast("Sermon supprimé (audio, transcription, analyses, notes)"); } catch { toast("Suppression impossible"); } sermon(el, []); });
  if (!ok) return;
  $("#sa", el).onchange = e => { $("#sgo", el).disabled = !e.target.checked; };
  $("#sgo", el).onclick = async () => {
    try { const nid = await demarrer({ eglise: $("#se", el).value.trim(), predicateur: $("#sp", el).value.trim() }); location.hash = "#/sermon/" + nid; }
    catch (e) { aideMicro(el, e); }
  };
}
const etapes = s => [s.duree ? "🎧 audio" : "", s.transcription?.length ? "📝 transcrit" : "", s.ia?.plan?.texte ? "🗂 plan" : "", s.ia?.resume?.texte ? "📌 résumé" : "",
  (s.notesTexte || "").trim() || Object.values(s.mesNotes || {}).some(x => (x || "").trim()) || s.notes?.length ? "✎ notes" : "", s.ia?.approfondir?.texte ? "🔎 résumé de mes notes" : "", s.interrompu ? "⚠ enregistrement interrompu" : ""].filter(Boolean).join(" · ") || "—";
const confidentialite = () => `<div class="notice small" style="margin-top:8px">
  <strong>Sur ce téléphone uniquement</strong> : l'audio, la transcription, les analyses collées et vos notes (base locale du navigateur). Ils ne sont pas envoyés aux serveurs de l'application.<br>
  <strong>Transcription</strong> : faite sur le téléphone (modèle Whisper, téléchargé une fois depuis Hugging Face via jsDelivr) ; l'audio n'est envoyé nulle part.<br>
  <strong>Analyses par IA</strong> : rien n'est envoyé automatiquement. Les boutons préparent une demande (transcription, et vos notes pour « Approfondir ») et ouvrent Claude ; le texte n'est transmis à Anthropic que si vous l'y envoyez.<br>
  <strong>Suppression</strong> : bouton ✕ ou « Supprimer ce sermon » ; « Supprimer l'audio seulement » libère de la place en gardant le texte. Profil → « Supprimer toutes mes données » efface aussi tous les sermons.</div>`;

// Micro refusé : cause probable et solution
async function aideMicro(el, e) {
  let etat = "";
  try { etat = (await navigator.permissions.query({ name: "microphone" })).state; } catch {}
  const politique = document.featurePolicy && !document.featurePolicy.allowsFeature("microphone");
  let msg;
  if (politique) msg = `L'application ouverte sur ce téléphone est encore l'ancienne version, qui bloquait le micro. <strong>Fermez complètement l'application</strong>, rouvrez-la, puis réessayez.`;
  else if (etat === "denied") msg = `Le micro a été refusé pour ce site. Dans Chrome : <strong>⋮ → Paramètres → Paramètres des sites → Micro</strong>, autorisez « guardian-angel-62a43.web.app », puis réessayez. Si l'appli est installée : appui long sur son icône → <strong>Infos sur l'appli → Autorisations → Micro → Autoriser</strong>.`;
  else if (e && e.name === "NotFoundError") msg = "Aucun micro n'a été trouvé sur cet appareil.";
  else if (e && e.name === "NotReadableError") msg = "Le micro est déjà utilisé par une autre application (appel, dictaphone…). Fermez-la puis réessayez.";
  else if (e && e.name === "NotAllowedError") msg = `Le micro n'a pas été autorisé. Réessayez et choisissez <strong>« Autoriser »</strong> quand le téléphone le demande.`;
  else msg = "Impossible de démarrer l'enregistrement (" + esc(e?.name || String(e)) + ").";
  let box = document.getElementById("aideMicro");
  if (!box) { box = document.createElement("div"); box.id = "aideMicro"; box.className = "notice err small"; $("#sgo", el)?.closest(".bloc")?.after(box); }
  box.innerHTML = "🎙 " + msg; box.scrollIntoView({ block: "center", behavior: "smooth" });
}

// ---------------------------------------------------------------- page d'un sermon : les 4 sections
const statut = (cls, txt) => `<span class="statut ${cls}">${txt}</span>`;
let urlAudio = "";

async function page(el, id) {
  let s = await sdb.get(id);
  if (!s) { el.innerHTML = `<div class="empty">Sermon introuvable. <a href="#/sermon">Retour</a></div>`; return; }
  s = await recuperer(s);
  if (R.actif && R.id === id) s = R.s;
  const enregistrement = R.actif && R.id === id;
  const blob = enregistrement ? null : await sdb.audio(id, s.mime).catch(() => null);
  if (urlAudio) URL.revokeObjectURL(urlAudio);
  urlAudio = blob ? URL.createObjectURL(blob) : "";
  s.ia ||= {}; s.passages ||= []; migrerNotes(s);
  const ext = (s.mime || blob?.type || "").includes("mp4") ? "m4a" : (s.mime || "").includes("ogg") ? "ogg" : "webm";
  const job = JOBS.get(id), trCours = job?.etat === "cours";
  const trSt = trCours ? statut("cours", "Transcription en cours") : job?.etat === "erreur" || (s.trEtat && !s.trEtat.termine && s.transcription.length) ? statut("err", "Interrompue")
    : s.transcription.length ? statut("ok", "Terminée") : statut("", enregistrement ? "Après l'enregistrement" : "À faire");
  const vit = store.prefs.get("sermonVitesse", 1);

  el.innerHTML = `<div id="pgSermon"><section class="hero" style="padding-bottom:16px"><div class="kicker">${esc(frDate(s.date))}${s.duree ? " · " + hms(s.duree) : ""}</div><h1>${esc(s.eglise || "Sermon")}</h1>${s.predicateur ? `<p>${esc(s.predicateur)}</p>` : ""}
    <p class="small" style="margin-top:6px"><a href="#/sermon">‹ Tous mes sermons</a></p></section>

  <details class="bloc" open id="b1"><summary><h2 class="bloc-t"><span class="num">1</span> Audio du sermon</h2>${enregistrement ? statut(R.pause ? "pause" : "rec", R.pause ? "En pause" : "Enregistrement") : blob ? statut("ok", "Sauvegardé") : statut("err", "Pas d'audio")}</summary>
    ${enregistrement ? `<div class="enreg">
      <div class="voyant${R.pause ? " pause" : ""}" aria-hidden="true"></div>
      <div class="chrono" id="srTemps" aria-live="off">${hms(duree())}</div>
      <div class="niveau"><div id="srNiv"></div></div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" id="srPause">${R.pause ? "▶ Reprendre" : "❚❚ Pause"}</button><button class="btn rouge" id="srFin">■ Arrêter et sauvegarder</button></div>
      <p class="small muted" style="margin:10px 0 0">Sauvegarde automatique toutes les 5 s. Vous pouvez écrire vos notes juste en dessous, ou utiliser d'autres pages de l'application : l'enregistrement continue (pastille rouge en bas de l'écran). Verrouiller l'écran ou changer d'application peut l'interrompre sur certains téléphones.</p>
    </div>` : blob ? `${s.interrompu ? `<div class="notice small">L'enregistrement s'est arrêté avant la fin (application fermée ou téléphone en veille). Tout ce qui avait été enregistré jusque-là est conservé.</div>` : ""}
    <div class="lecteur" id="lecteur">
      <audio id="aud" preload="metadata" src="${urlAudio}"></audio>
      <div class="row" style="gap:6px;flex-wrap:nowrap">
        <button class="btn rond" id="lPlay" aria-label="Lecture">▶</button>
        <input type="range" id="lPos" min="0" max="${Math.max(1, s.duree || 1)}" step="1" value="0" aria-label="Position dans l'enregistrement" style="flex:1">
      </div>
      <div class="row between small" style="margin-top:6px"><span id="lTemps" class="muted">0:00 / ${hms(s.duree)}</span>
        <span class="row" style="gap:4px"><button class="btn ghost sm" id="lMoins" aria-label="Reculer de 15 secondes">−15 s</button><button class="btn ghost sm" id="lPlus" aria-label="Avancer de 15 secondes">+15 s</button></span></div>
      <div class="row" style="justify-content:center;margin-top:8px"><div class="seg" id="lVit" role="group" aria-label="Vitesse de lecture">${[[1, "×1"], [1.5, "×1,5"], [2, "×2"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === vit}">${l}</button>`).join("")}</div></div>
      <p class="small" style="margin:8px 0 0"><a href="${urlAudio}" download="sermon-${s.date}.${ext}">Télécharger l'audio</a> · <button class="lien" id="lSupAudio">Supprimer l'audio seulement</button></p>
    </div>` : `<div class="notice small">Aucun audio pour ce sermon${s.transcription.length ? " (supprimé ; la transcription et les analyses sont conservées)" : ""}.</div>`}
  </details>

  <details class="bloc" open id="b2"><summary><h2 class="bloc-t"><span class="num">2</span> Transcription du sermon</h2><span id="trStatut">${trSt}</span></summary>
    ${enregistrement ? `<p class="small muted">Disponible dès que l'enregistrement est arrêté et sauvegardé.</p>` : `
    ${blob ? `<div id="trBoutons"></div>
      <p class="small muted" style="margin:6px 0 0">Sur ce téléphone, sans envoyer l'audio. La première fois, le modèle (~80 Mo) est téléchargé : préférez le Wi-Fi. Comptez environ 1 à 3 minutes par tranche de 5 minutes ; laissez l'écran allumé. Le texte est enregistré tranche par tranche : en cas d'interruption, on reprend là où on s'était arrêté.</p>` : ""}
    <div id="trEtat" data-id="${esc(id)}" data-audio="${blob ? 1 : ""}" class="small" style="margin-top:8px"></div>
    <div id="trZone"></div>`}
  </details>

  <details class="bloc" open id="b3"><summary><h2 class="bloc-t"><span class="num">3</span> Mes notes</h2><span id="mnStatut">${(s.notesTexte || "").trim() ? statut("ok", "Enregistrées") : statut("", "À écrire")}</span></summary>
    <textarea id="mnTexte" class="notes-texte" maxlength="30000" placeholder="Une note par ligne. Après chaque note, touchez une légende ci-dessous.">${esc(s.notesTexte || "")}</textarea>
    <div class="legendes" id="mnLeg" role="toolbar" aria-label="Légendes">${LEGENDES.map(([l, ic]) => `<button type="button" class="leg" data-leg="${esc(l)}">${ic} ${esc(l)}</button>`).join("")}</div>
    <p class="small muted" id="mnEtat" style="margin:4px 0 0">Une ligne = une note. La légende s'ajoute à la note où se trouve le curseur (ou à la précédente si la ligne est vide) ; touchez-la à nouveau pour l'enlever. Enregistrement automatique.</p>
    <details class="sous" id="mnResume"${(s.notesTexte || "").trim() ? "" : " hidden"}><summary>Mes notes classées par légende</summary><div id="mnGroupes">${groupesNotes(s.notesTexte)}</div></details>
    ${blocIA(s, "approfondir")}
    <div class="row" style="margin-top:14px"><button class="btn gold sm" id="dJournal">${s.journalId ? "Mettre à jour dans mon journal" : "Ajouter à mon journal"}</button></div>
  </details>

  <details class="bloc" open id="b4"><summary><h2 class="bloc-t"><span class="num">4</span> Comprendre le sermon</h2>${s.ia.plan?.texte && s.ia.resume?.texte ? statut("ok", "Plan et résumé") : s.ia.plan?.texte || s.ia.resume?.texte ? statut("cours", "En partie") : statut("", s.transcription.length ? "À générer" : "Après la transcription")}</summary>
    ${blocIA(s, "plan")}${blocIA(s, "resume")}
    ${s.compteRendu ? `<details class="sous"><summary>Ancien compte rendu (version précédente de l'onglet)</summary><div class="rendu">${md(s.compteRendu)}</div></details>` : ""}
  </details>


  <details class="small" style="margin-top:18px"><summary class="muted">Où vont mes données ?</summary>${confidentialite()}</details>
  <p style="margin-top:16px"><button class="btn danger sm" id="dDel">Supprimer ce sermon</button></p>
  <div class="barre-selection" id="selBar" hidden><button class="btn" id="selGo">🔎 Analyser ce passage avec l'IA</button></div></div>`;

  // ---- section 1 : enregistrement ou lecteur
  if (enregistrement) {
    $("#srPause", el).onclick = () => { basculerPause(); page(el, id); };
    $("#srFin", el).onclick = async e => { e.currentTarget.disabled = true; await terminer(); toast("Sermon sauvegardé"); page(el, id); };
    const niv = () => { const n = document.getElementById("srNiv"); if (!n || !R.actif || !R.an) return; const d = new Uint8Array(R.an.fftSize); R.an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); n.style.width = (R.pause ? 0 : Math.min(100, m)) + "%"; rafId = requestAnimationFrame(niv); };
    cancelAnimationFrame(rafId); niv();
    pastille();
  } else if (blob) brancherLecteur(el, s);
  $("#lSupAudio", el)?.addEventListener("click", async e => {
    const b = e.currentTarget; if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer : supprimer l'audio (le texte est gardé)"; return; }
    await sdb.supprimerAudio(id); toast("Audio supprimé"); page(el, id);
  });

  // ---- section 2 : transcription
  if (!enregistrement) {
    majEtatTranscription(id);
    rafraichirTranscription(id, s, true);
  }

  // ---- sélection d'un passage → analyse
  let selection = "";
  const bar = $("#selBar", el);
  const surSelection = () => {
    if (!document.body.contains(bar)) { document.removeEventListener("selectionchange", surSelection); return; }
    const zone = $("#trZone", el); let t = "";
    const ta = $("#trEdit", el);
    if (ta && document.activeElement === ta) t = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    else { const sel = document.getSelection(); if (sel && sel.rangeCount && zone && zone.contains(sel.anchorNode) && zone.contains(sel.focusNode)) t = sel.toString(); }
    t = t.replace(/\[\d+:\d\d(?::\d\d)?\]\s*/g, "").replace(/\s+/g, " ").trim();
    if (t.length >= 12) { selection = t; bar.hidden = false; } else if (!t) setTimeout(() => { if (!document.getSelection()?.toString()) bar.hidden = true; }, 400);
  };
  document.addEventListener("selectionchange", surSelection);
  $("#selGo", el).onclick = async () => {
    if (!selection) return;
    const cur = await sdb.get(id);
    const p = { id: "p" + Date.now().toString(36), passage: selection.slice(0, 3000), reponse: "", date: new Date().toISOString() };
    cur.passages = [...(cur.passages || []), p]; await sdb.save(cur);
    await envoyerVersClaude(demande("passage", cur, p.passage));
    bar.hidden = true; document.getSelection()?.removeAllRanges();
    rafraichirTranscription(id, cur, true);
    setTimeout(() => document.getElementById("pass_" + p.id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 100);
  };

  // ---- sections 3 et 4 : demandes à Claude et réponses collées
  brancherIA(el, id);

  // ---- section 3 : notes avec légendes (sauvegarde automatique)
  const ta = $("#mnTexte", el);
  let minuterie = 0;
  const enregistrerNotes = async () => {
    const cur = enregistrement && R.s ? R.s : await sdb.get(id);
    migrerNotes(cur); cur.notesTexte = ta.value; cur.notesModifiees = new Date().toISOString();
    try {
      await sdb.save(cur);
      const e = document.getElementById("mnEtat"); if (e) e.textContent = "✓ Enregistré à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const g = document.getElementById("mnGroupes"); if (g) { g.innerHTML = groupesNotes(ta.value); document.getElementById("mnResume").hidden = !ta.value.trim(); }
      const st = document.getElementById("mnStatut"); if (st) st.innerHTML = ta.value.trim() ? statut("ok", "Enregistrées") : statut("", "À écrire");
    } catch { const e = document.getElementById("mnEtat"); if (e) e.textContent = "⚠ Enregistrement impossible (stockage plein ?)"; }
  };
  const plusTard = () => { clearTimeout(minuterie); $("#mnEtat", el).textContent = "Modification…"; minuterie = setTimeout(enregistrerNotes, 600); };
  ta.addEventListener("input", plusTard);
  // le clavier ne doit pas se fermer quand on touche une légende
  $("#mnLeg", el).addEventListener("pointerdown", e => { if (e.target.closest("[data-leg]")) e.preventDefault(); });
  $("#mnLeg", el).addEventListener("click", e => {
    const b = e.target.closest("[data-leg]"); if (!b) return;
    const v = ta.value, pos = ta.selectionEnd ?? v.length, lignes = v.split("\n");
    let i = v.slice(0, pos).split("\n").length - 1;
    if (!lignes[i]?.replace(RE_LEG, "").trim()) { let k = i - 1; while (k >= 0 && !lignes[k].replace(RE_LEG, "").trim()) k--; if (k < 0) { toast("Écrivez d'abord une note"); ta.focus(); return; } i = k; }
    const tag = `[${b.dataset.leg}]`, ligne = lignes[i];
    lignes[i] = ligne.includes(tag) ? ligne.replace(" " + tag, "").replace(tag, "") : ligne.replace(/\s+$/, "") + " " + tag;
    const avant = lignes.slice(0, i + 1).join("\n").length;
    let curseur = avant;
    if (!ligne.includes(tag) && i === lignes.length - 1) { lignes.push(""); curseur = avant + 1; }        // nouvelle ligne prête pour la note suivante
    else if (!ligne.includes(tag) && !lignes[i + 1]?.trim()) curseur = avant + 1;
    ta.value = lignes.join("\n"); ta.focus(); ta.setSelectionRange(curseur, curseur);
    b.classList.add("vu"); setTimeout(() => b.classList.remove("vu"), 400);
    plusTard();
  });

  // ---- horodatages cliquables (transcription, analyses) → position dans l'audio
  $("#pgSermon", el).addEventListener("click", e => {
    const b = e.target.closest(".ts[data-t]"); if (!b) return;
    const a = $("#aud", el); if (!a) return;
    a.currentTime = secondes(b.dataset.t); a.play().catch(() => {});
    $("#b1", el).open = true; $("#lecteur", el)?.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  $("#dJournal", el).onclick = async () => {
    const cur = await sdb.get(id); if (!cur) return;
    const mc = store.prefs.get("messeEnCours", null);
    const jid = cur.journalId || (mc && mc.date === cur.date && store.get("journal", mc.id) ? mc.id : store.newId());
    const e = store.get("journal", jid) || { id: jid, date: cur.date, categorie: "Messe", eglise: cur.eglise, egliseId: "", notes: "", passages: "", reflexions: "", intentions: "" };
    const notesTxt = [cur.ia?.resume?.texte && "Résumé du sermon :\n" + cur.ia.resume.texte, cur.ia?.plan?.texte && "Plan détaillé :\n" + cur.ia.plan.texte].filter(Boolean).join("\n\n") || cur.compteRendu || e.notes || "";
    const refl = [mesNotesTexte(cur) !== "(aucune note)" && mesNotesTexte(cur), cur.ia?.approfondir?.texte && "Approfondissement :\n" + cur.ia.approfondir.texte].filter(Boolean).join("\n\n");
    try {
      await store.put("journal", jid, { ...e, notes: notesTxt.slice(0, 20000), reflexions: (refl || e.reflexions || "").slice(0, 20000) });
      cur.journalId = jid; await sdb.save(cur); toast("Journal mis à jour");
    } catch { toast("Enregistrement impossible"); }
  };
  $("#dDel", el).onclick = async e => {
    const b = e.currentTarget; if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer la suppression (audio, transcription, analyses, notes)"; return; }
    if (R.actif && R.id === id) await terminer();
    await sdb.remove(id); if (urlAudio) URL.revokeObjectURL(urlAudio); urlAudio = ""; toast("Sermon supprimé"); location.hash = "#/sermon";
  };
}

// Notes regroupées par légende (affichage immédiat, sans IA)
function groupesNotes(texte) {
  const notes = lireNotes(texte); if (!notes.length) return "";
  const bloc = (titre, liste) => liste.length ? `<p class="small" style="margin:10px 0 2px"><strong>${titre}</strong> <span class="muted">(${liste.length})</span></p><ul class="small" style="margin:0;padding-left:20px">${liste.map(n => `<li>${esc(n.texte)}</li>`).join("")}</ul>` : "";
  return LEGENDES.map(([l, ic]) => bloc(`${ic} ${esc(l)}`, notes.filter(n => n.legendes.includes(l)))).join("") + bloc("Sans légende", notes.filter(n => !n.legendes.length));
}

function brancherLecteur(el, s) {
  const a = $("#aud", el), pos = $("#lPos", el), tps = $("#lTemps", el), play = $("#lPlay", el);
  let total = s.duree || 0, glisse = false;
  a.playbackRate = store.prefs.get("sermonVitesse", 1);
  const maj = () => { if (!glisse) pos.value = a.currentTime; tps.textContent = `${hms(a.currentTime)} / ${hms(total)}`; };
  a.addEventListener("loadedmetadata", () => {
    if (a.duration === Infinity || isNaN(a.duration)) {          // WebM du navigateur : durée inconnue, on la force
      a.currentTime = 1e101;
      a.addEventListener("timeupdate", function f() { a.removeEventListener("timeupdate", f); if (isFinite(a.duration)) { total = a.duration; pos.max = total; } a.currentTime = 0; maj(); });
    } else { total = a.duration; pos.max = total; maj(); }
  }, { once: true });
  a.addEventListener("timeupdate", maj);
  a.addEventListener("play", () => { play.textContent = "❚❚"; play.setAttribute("aria-label", "Pause"); });
  a.addEventListener("pause", () => { play.textContent = "▶"; play.setAttribute("aria-label", "Lecture"); });
  a.addEventListener("ended", () => { play.textContent = "▶"; });
  play.onclick = () => (a.paused ? a.play().catch(() => toast("Lecture impossible")) : a.pause());
  pos.addEventListener("input", () => { glisse = true; tps.textContent = `${hms(pos.value)} / ${hms(total)}`; });
  pos.addEventListener("change", () => { a.currentTime = +pos.value; glisse = false; });
  $("#lMoins", el).onclick = () => { a.currentTime = Math.max(0, a.currentTime - 15); };
  $("#lPlus", el).onclick = () => { a.currentTime = Math.min(total || a.currentTime + 15, a.currentTime + 15); };
  $("#lVit", el).onclick = e => {
    const v = +e.target.closest("button")?.dataset.v; if (!v) return;
    a.playbackRate = v; store.prefs.setQuiet("sermonVitesse", v);
    $$("#lVit button", el).forEach(b => b.setAttribute("aria-pressed", +b.dataset.v === v));
  };
}

// Zone de la transcription : lecture (horodatages cliquables), correction, copie, analyses de passages
function rafraichirTranscription(id, s, complet) {
  const z = document.getElementById("trZone"); if (!z || !s || document.getElementById("trEtat")?.dataset.id !== id) return;
  if (!complet && document.getElementById("trEdit")) return;            // ne pas déranger une correction en cours
  const st = document.getElementById("trStatut");
  const j = JOBS.get(id);
  if (st) st.innerHTML = j?.etat === "cours" ? statut("cours", "Transcription en cours") : j?.etat === "erreur" || (s.trEtat && !s.trEtat.termine && s.transcription.length) ? statut("err", "Interrompue") : s.transcription.length ? statut("ok", "Terminée") : statut("", "À faire");
  const bt = document.getElementById("trBoutons");
  if (bt) {
    const cours = j?.etat === "cours";
    bt.innerHTML = `<div class="row" style="gap:8px">${s.trEtat && !s.trEtat.termine && s.transcription.length && !cours ? `<button class="btn" id="trGo">↻ Reprendre la transcription (${hms(s.trEtat.fait)} / ${hms(s.trEtat.total)})</button>` : ""}
      <button class="btn${s.transcription.length ? " ghost" : ""}" id="trNouv"${cours ? " disabled" : ""}>${s.transcription.length ? "Refaire la transcription" : "📝 Transcrire le sermon"}</button></div>`;
    const go = reprendre => { transcrireSermon(id, { reprendre }); rafraichirTranscription(id, s, true); };
    const bN = document.getElementById("trNouv");
    bN.onclick = () => { if (s.transcription.length && !bN.dataset.ok) { bN.dataset.ok = 1; bN.textContent = "Confirmer (remplace la transcription actuelle)"; return; } go(false); };
    document.getElementById("trGo")?.addEventListener("click", () => go(true));
  }
  if (!s.transcription.length) { z.innerHTML = ""; return; }
  z.innerHTML = `<div class="row" style="gap:6px;margin-top:10px"><button class="btn ghost sm" id="trCopie">⧉ Copier le texte</button><button class="btn ghost sm" id="trCorr">✎ Corriger</button></div>
    <div class="tr-texte" id="trTexte" tabindex="0" aria-label="Transcription">${s.transcription.map(x => `<p><button class="ts" data-t="${hms(x.t)}">${hms(x.t)}</button> ${esc(x.texte)}</p>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0">Sélectionnez une phrase ou un passage : le bouton « Analyser ce passage avec l'IA » apparaît en bas de l'écran. Touchez un horodatage pour réécouter ce moment.</p>
    ${(s.passages || []).length ? `<h3 class="serif" style="margin:16px 0 6px">Passages analysés</h3>${s.passages.map(p => `<details class="sous" id="pass_${esc(p.id)}"${p.reponse ? "" : " open"}><summary>« ${esc(p.passage.slice(0, 90))}${p.passage.length > 90 ? "…" : ""} » ${p.reponse ? statut("ok", "Expliqué") : statut("cours", "En attente de la réponse")}</summary>
      <blockquote class="small">${esc(p.passage)}</blockquote>
      ${p.reponse ? `<div class="rendu">${md(p.reponse)}</div>` : ""}
      <label for="pr_${esc(p.id)}" class="small">${p.reponse ? "Modifier l'explication" : "Collez ici la réponse de Claude"}</label><textarea id="pr_${esc(p.id)}" data-passage="${esc(p.id)}" style="min-height:${p.reponse ? 60 : 110}px">${esc(p.reponse)}</textarea>
      <div class="row" style="margin-top:6px;gap:6px"><button class="btn sm" data-psave="${esc(p.id)}">Enregistrer</button><button class="btn ghost sm" data-pagain="${esc(p.id)}">Redemander à Claude</button>${p.reponse ? `<button class="btn ghost sm" data-pcopie="${esc(p.id)}">⧉ Copier</button>` : ""}<button class="btn ghost sm" data-psup="${esc(p.id)}">✕</button></div></details>`).join("")}` : ""}`;
  $("#trCopie", z).onclick = async () => { try { await navigator.clipboard.writeText(s.transcription.map(x => x.texte).join("\n")); toast("Transcription copiée"); } catch { toast("Copie impossible : sélectionnez le texte"); } };
  $("#trCorr", z).onclick = () => {
    const texte = $("#trTexte", z);
    texte.outerHTML = `<textarea id="trEdit" class="tr-texte" style="min-height:300px">${esc(s.transcription.map(x => `[${hms(x.t)}] ${x.texte}`).join("\n"))}</textarea>`;
    $("#trCorr", z).outerHTML = `<button class="btn sm" id="trFini">✓ Terminer la correction</button>`;
    const ta = $("#trEdit", z), etat = document.createElement("p"); etat.className = "small muted"; etat.style.margin = "4px 0 0"; etat.textContent = "Corrigez le texte ; gardez les repères [m:ss] en début de ligne. Enregistrement automatique."; ta.after(etat);
    let m = 0;
    const lire = () => ta.value.split("\n").map(l => { const r = l.match(/^\[(\d+(?::\d+){1,2})\]\s*(.*)$/); if (!r) return l.trim() ? { t: null, texte: l.trim() } : null; return { t: secondes(r[1]), texte: r[2] }; }).filter(Boolean)
      .reduce((acc, x) => { if (x.t == null) { if (acc.length) acc[acc.length - 1].texte += " " + x.texte; else acc.push({ t: 0, texte: x.texte }); } else acc.push(x); return acc; }, []);
    const sauver = async () => { const cur = await sdb.get(id); cur.transcription = lire(); cur.trCorrigee = new Date().toISOString(); await sdb.save(cur); s.transcription = cur.transcription; etat.textContent = "✓ Corrections enregistrées à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
    ta.addEventListener("input", () => { clearTimeout(m); etat.textContent = "Modification…"; m = setTimeout(sauver, 800); });
    $("#trFini", z).onclick = async () => { clearTimeout(m); await sauver(); rafraichirTranscription(id, await sdb.get(id), true); };
    ta.focus();
  };
  const passage = async (pid, fn) => { const cur = await sdb.get(id); const p = cur.passages.find(x => x.id === pid); if (p) { await fn(cur, p); await sdb.save(cur); } return cur; };
  $$("[data-psave]", z).forEach(b => b.onclick = async () => { const cur = await passage(b.dataset.psave, (c, p) => { p.reponse = $(`[data-passage="${b.dataset.psave}"]`, z).value.trim(); }); toast("Explication enregistrée"); rafraichirTranscription(id, cur, true); });
  $$("[data-pagain]", z).forEach(b => b.onclick = async () => { const cur = await sdb.get(id); const p = cur.passages.find(x => x.id === b.dataset.pagain); if (p) envoyerVersClaude(demande("passage", cur, p.passage)); });
  $$("[data-pcopie]", z).forEach(b => b.onclick = async () => { const cur = await sdb.get(id); const p = cur.passages.find(x => x.id === b.dataset.pcopie); try { await navigator.clipboard.writeText(p.reponse); toast("Explication copiée"); } catch { toast("Copie impossible"); } });
  $$("[data-psup]", z).forEach(b => b.onclick = async () => { if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Supprimer ?"; return; } const cur = await sdb.get(id); cur.passages = cur.passages.filter(x => x.id !== b.dataset.psup); await sdb.save(cur); rafraichirTranscription(id, cur, true); });
}

// Bloc d'analyse (plan, résumé, approfondissement) : demander à Claude, coller la réponse, la relire et la copier
function blocIA(s, type) {
  const r = (s.ia || {})[type] || {}, def = IA[type], possible = type === "approfondir" ? !!(s.notesTexte || "").trim() || (s.transcription || []).length > 0 : (s.transcription || []).length > 0;
  const etat = r.texte ? statut("ok", "Terminé · " + new Date(r.date).toLocaleDateString("fr-FR")) : r.demandeLe ? statut("cours", "En attente de la réponse") : statut("", "À générer");
  const manque = type === "approfondir" && !(s.notesTexte || "").trim();
  return `<div class="ia" id="ia_${type}">
    <div class="row between"><h3 class="serif" style="margin:0">${def.titre}</h3>${etat}</div>
    ${r.texte ? `<details class="sous" open><summary>Lire</summary><div class="rendu">${md(r.texte)}</div></details>` : ""}
    <div class="row" style="gap:6px;margin-top:8px"><button class="btn${r.texte ? " ghost" : ""} sm" data-ia="${type}"${possible ? "" : " disabled"}>${r.texte ? "↻ Refaire" : "✦ " + def.bouton}</button>${r.texte ? `<button class="btn ghost sm" data-iacopie="${type}">⧉ Copier</button>` : ""}</div>
    ${!possible ? `<p class="small muted" style="margin:6px 0 0">${type === "approfondir" ? "Écrivez d'abord quelques notes ci-dessus." : "Disponible après la transcription."}</p>` : manque ? `<p class="small muted" style="margin:6px 0 0">Écrivez d'abord quelques notes ci-dessus.</p>` : type === "approfondir" ? `<p class="small muted" style="margin:6px 0 0">Résumé du sermon à partir de vos notes et de leurs légendes${(s.transcription || []).length ? ", vérifié avec la transcription" : " (la transcription, si vous la faites, sera aussi utilisée)"}.</p>` : ""}
    ${possible && (r.demandeLe || !r.texte) ? `<details class="sous"${r.demandeLe && !r.texte ? " open" : ""}><summary>${r.texte ? "Remplacer par une nouvelle réponse" : "Coller la réponse de Claude"}</summary>
      <textarea data-iarep="${type}" style="min-height:120px" placeholder="Collez ici la réponse de Claude"></textarea>
      <button class="btn sm" data-iasave="${type}" style="margin-top:6px">Enregistrer la réponse</button></details>` : ""}
  </div>`;
}
function brancherIA(el, id) {
  $$("[data-ia]", el).forEach(b => b.onclick = async () => {
    const cur = await sdb.get(id); const type = b.dataset.ia;
    cur.ia = cur.ia || {}; cur.ia[type] = { ...(cur.ia[type] || {}), demandeLe: new Date().toISOString() }; await sdb.save(cur);
    await envoyerVersClaude(demande(type, cur));
    const box = document.getElementById("ia_" + type); if (box) { box.outerHTML = blocIA(cur, type); brancherIA(el, id); document.querySelector(`[data-iarep="${type}"]`)?.closest("details")?.setAttribute("open", ""); }
  });
  $$("[data-iasave]", el).forEach(b => b.onclick = async () => {
    const type = b.dataset.iasave, t = $(`[data-iarep="${type}"]`, el).value.trim();
    if (!t) { toast("Collez d'abord la réponse de Claude"); return; }
    const cur = await sdb.get(id); cur.ia = cur.ia || {}; cur.ia[type] = { texte: t, date: new Date().toISOString() }; await sdb.save(cur);
    toast(IA[type].titre + " enregistré"); const box = document.getElementById("ia_" + type); if (box) { box.outerHTML = blocIA(cur, type); brancherIA(el, id); }
  });
  $$("[data-iacopie]", el).forEach(b => b.onclick = async () => {
    const cur = await sdb.get(id); try { await navigator.clipboard.writeText(cur.ia[b.dataset.iacopie].texte); toast("Copié"); } catch { toast("Copie impossible"); }
  });
}
