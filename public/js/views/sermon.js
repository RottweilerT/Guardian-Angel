// Sermon : enregistrement audio, transcription en direct, notes personnelles horodatées,
// puis préparation d'une demande de compte rendu à coller dans Claude.
// L'audio reste sur l'appareil (IndexedDB) ; rien n'est envoyé à un serveur de l'application.
import { esc, $, toast, today, frDate, modal } from "../ui.js";
import * as store from "../store.js";
import * as sdb from "../sermon-db.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const TYPES = { ok: ["✓", "Compris"], q: ["?", "Pas compris"], imp: ["★", "Important"], note: ["✎", "Note"] };
const hms = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(x).padStart(2, "0"); };
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";

// État d'enregistrement global : il continue si l'on change de page dans l'application
const R = { actif: false };
let rafId = 0;

function pastille() {
  let p = document.getElementById("pastilleSermon");
  if (R.actif && !p) {
    p = document.createElement("a"); p.id = "pastilleSermon"; p.href = "#/sermon";
    p.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(74px + env(safe-area-inset-bottom,0px));z-index:900;background:#B3261E;color:#fff;border-radius:999px;padding:7px 14px;font-size:14px;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.25)";
    document.body.appendChild(p);
  }
  if (!R.actif && p) p.remove();
  if (p) p.textContent = `● ${R.pause ? "En pause" : "Enregistrement"} ${hms(duree())}`;
}
const duree = () => !R.actif ? 0 : (R.cumul + (R.pause ? 0 : (Date.now() - R.depart) / 1000));
setInterval(() => { if (R.actif) { pastille(); const t = document.getElementById("srTemps"); if (t) t.textContent = hms(duree()); } }, 1000);

async function demarrer(opts) {
  const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const id = "s" + Date.now().toString(36);
  const s = { id, date: today(), debut: new Date().toISOString(), eglise: opts.eglise || "", predicateur: opts.predicateur || "", accord: true, mime: MIME, duree: 0, transcription: [], notes: [], compteRendu: "" };
  await sdb.save(s);
  const rec = new MediaRecorder(flux, MIME ? { mimeType: MIME, audioBitsPerSecond: 32000 } : undefined);
  rec.ondataavailable = e => { if (e.data && e.data.size) sdb.addChunk(id, e.data).catch(() => {}); };
  rec.start(5000);                                    // un morceau toutes les 5 s : rien n'est perdu si l'appli se ferme
  Object.assign(R, { actif: true, pause: false, id, s, flux, rec, depart: Date.now(), cumul: 0, interim: "" });
  try { R.lock = await navigator.wakeLock?.request("screen"); } catch {}
  document.addEventListener("visibilitychange", reverrouiller);
  // Niveau sonore, pour voir que le micro capte bien
  try { const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(flux).connect(an); R.ac = ac; R.an = an; } catch {}
  if (opts.direct && SR) transcrire();
  pastille();
}
async function reverrouiller() { if (R.actif && document.visibilityState === "visible") try { R.lock = await navigator.wakeLock?.request("screen"); } catch {} }

function transcrire() {
  const r = new SR(); r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
  r.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const x = e.results[i];
      if (x.isFinal) { const t = x[0].transcript.trim(); if (t) { R.s.transcription.push({ t: Math.round(duree()), texte: t }); sdb.save(R.s).catch(() => {}); } }
      else interim += x[0].transcript;
    }
    R.interim = interim; majTranscription();
  };
  r.onerror = e => { R.srErreur = e.error; if (e.error === "not-allowed" || e.error === "service-not-allowed") R.srStop = true; majTranscription(); };
  r.onend = () => { if (R.actif && !R.pause && !R.srStop) setTimeout(() => { try { r.start(); } catch {} }, 250); };   // la reconnaissance s'arrête d'elle-même : on la relance
  R.sr = r; R.srStop = false;
  try { r.start(); } catch {}
}
function majTranscription() {
  const b = document.getElementById("srTexte"); if (!b) return;
  const fin = R.s.transcription.slice(-6);
  b.innerHTML = (fin.length || R.interim ? fin.map(x => `<span class="muted small">${hms(x.t)}</span> ${esc(x.texte)}`).join("<br>") + (R.interim ? `<br><em class="muted">${esc(R.interim)}</em>` : "")
    : `<span class="muted small">${R.srErreur ? "Transcription en direct interrompue (" + esc(R.srErreur) + "). L'audio continue d'être enregistré." : "La transcription apparaîtra ici…"}</span>`);
  b.scrollTop = b.scrollHeight;
}
function basculerPause() {
  if (!R.actif) return;
  if (R.pause) { R.rec.resume(); R.depart = Date.now(); R.pause = false; if (R.sr && !R.srStop) try { R.sr.start(); } catch {} }
  else { R.rec.pause(); R.cumul += (Date.now() - R.depart) / 1000; R.pause = true; try { R.sr?.stop(); } catch {} }
  pastille();
}
async function terminer() {
  const s = R.s; s.duree = Math.round(duree());
  R.srStop = true; try { R.sr?.stop(); } catch {}
  await new Promise(res => { R.rec.onstop = res; try { R.rec.stop(); } catch { res(); } });
  R.flux.getTracks().forEach(t => t.stop()); try { R.ac?.close(); } catch {} try { R.lock?.release(); } catch {}
  document.removeEventListener("visibilitychange", reverrouiller);
  cancelAnimationFrame(rafId);
  Object.assign(R, { actif: false, sr: null, rec: null, flux: null });
  await sdb.save(s); pastille();
  return s.id;
}
function ajouterNote(type, texte) {
  const ctx = R.s.transcription.slice(-1)[0]?.texte || "";
  R.s.notes.push({ t: Math.round(duree()), type, texte: texte || "", contexte: texte ? "" : ctx.slice(0, 300) });
  sdb.save(R.s).catch(() => {});
}

// Texte préparé pour Claude
function demande(s) {
  const n = s.notes.map(x => `- [${hms(x.t)}] ${TYPES[x.type]?.[1] || "Note"} : ${x.texte || "(sans texte)"}${x.contexte ? ` — au moment où le prédicateur disait : « ${x.contexte} »` : ""}`).join("\n") || "(aucune note)";
  const tr = s.transcription.map(x => `[${hms(x.t)}] ${x.texte}`).join("\n") || "(pas de transcription : je n'ai que mes notes)";
  return `Je t'envoie la transcription automatique d'un sermon (homélie) catholique et mes notes personnelles prises pendant l'écoute.
${s.eglise ? `Église : ${s.eglise}. ` : ""}Date : ${frDate(s.date)}.${s.predicateur ? ` Prédicateur : ${s.predicateur}.` : ""} Durée : ${hms(s.duree)}.

La transcription a été faite automatiquement : elle peut contenir des erreurs de mots, surtout pour les noms propres et les citations.

Merci de me rédiger, en français :
1. Un résumé en 5 lignes maximum.
2. Un compte rendu détaillé et organisé : le thème principal, le plan du sermon en parties avec titres, les idées clés, les passages de la Bible et les références citées (avec leur référence exacte si tu peux l'identifier), les appels concrets à la vie chrétienne.
3. Une partie « Ce que je n'avais pas compris » : pour chacune de mes notes « Pas compris », explique simplement le point, en t'appuyant sur ce que disait le prédicateur à ce moment-là et sur l'enseignement de l'Église catholique.
4. Une partie « Ce que j'ai retenu » à partir de mes notes « Compris » et « Important ».
5. Deux ou trois questions pour prolonger la méditation, et une courte prière en lien avec le sermon.
Signale clairement ce qui vient du sermon et ce que tu ajoutes toi-même.

MES NOTES
${n}

TRANSCRIPTION
${tr}`;
}

export default async function sermon(el, [id]) {
  if (id) return detail(el, id);
  if (R.actif) return ecranEnregistrement(el);
  const mc = store.prefs.get("messeEnCours", null), egliseJour = mc && mc.date === today() ? mc.eglise : "";
  const tous = (await sdb.list().catch(() => [])).sort((a, b) => (b.debut || "").localeCompare(a.debut || ""));
  const ok = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  el.innerHTML = `<section class="hero"><div class="kicker">Homélie</div><h1>Enregistrer le sermon</h1><p>Audio, transcription et notes restent sur ce téléphone.</p><span class="orn"></span></section>
  ${ok ? `<div class="card">
    <label for="se">Église</label><input id="se" maxlength="200" value="${esc(egliseJour)}">
    <label for="sp">Prédicateur (facultatif)</label><input id="sp" maxlength="120">
    <label class="field-inline" style="margin-top:12px"><input type="checkbox" id="sd"${SR ? "" : " disabled"}> Transcription en direct pendant l'enregistrement${SR ? " (souvent impossible sur Android : le micro ne peut pas servir deux fois)" : " (non disponible sur ce navigateur)"}</label>
    <p class="small muted" style="margin:4px 0 0">Sinon, la transcription se fait après le sermon, sur le téléphone, depuis la page du sermon.</p>
    <label class="field-inline"><input type="checkbox" id="sa"> Le prédicateur a donné son accord pour l'enregistrement, réservé à mon usage personnel</label>
    <p class="center" style="margin:14px 0 0"><button class="btn" id="sgo" disabled>● Commencer l'enregistrement</button></p>
  </div>
  <div class="notice small">Pendant l'enregistrement, l'écran reste allumé. Sur certains téléphones, changer d'application ou verrouiller l'écran peut interrompre l'enregistrement ; ce qui a déjà été enregistré est conservé.
  ${SR ? " La transcription en direct, si vous la cochez, utilise la reconnaissance vocale du navigateur (avec Chrome, le son est analysé par les serveurs de Google)." : ""}</div>`
    : `<div class="notice">L'enregistrement audio n'est pas possible sur ce navigateur.</div>`}
  <h2 class="sec">Mes sermons</h2>
  ${tous.length ? `<ul class="list">${tous.map(s => `<li><a href="#/sermon/${s.id}" style="text-decoration:none;color:inherit;display:block"><strong class="serif">${esc(s.eglise || "Sermon")}</strong> <span class="small muted">— ${esc(frDate(s.date))} · ${hms(s.duree)}</span><br>
    <span class="small muted">${s.transcription.length} passage${s.transcription.length > 1 ? "s" : ""} transcrit${s.transcription.length > 1 ? "s" : ""} · ${s.notes.length} note${s.notes.length > 1 ? "s" : ""}${s.compteRendu ? " · compte rendu ✓" : ""}</span></a></li>`).join("")}</ul>`
    : `<div class="empty">Aucun sermon enregistré.</div>`}`;
  if (!ok) return;
  $("#sa", el).onchange = e => { $("#sgo", el).disabled = !e.target.checked; };
  $("#sgo", el).onclick = async () => {
    try { await demarrer({ eglise: $("#se", el).value.trim(), predicateur: $("#sp", el).value.trim(), direct: $("#sd", el).checked }); ecranEnregistrement(el); }
    catch (e) { aideMicro(el, e); }
  };
}

// Micro refusé : on explique la cause probable et quoi faire
async function aideMicro(el, e) {
  let etat = "";
  try { etat = (await navigator.permissions.query({ name: "microphone" })).state; } catch {}
  const politique = document.featurePolicy && !document.featurePolicy.allowsFeature("microphone");
  let msg;
  if (politique) msg = `L'application ouverte sur ce téléphone est encore l'ancienne version, qui bloquait le micro. <strong>Fermez complètement l'application</strong> (glissez-la hors de la liste des applications récentes), rouvrez-la, puis réessayez.`;
  else if (etat === "denied") msg = `Le micro a été refusé pour ce site. Dans Chrome : <strong>⋮ → Paramètres → Paramètres des sites → Micro</strong>, retirez « guardian-angel-62a43.web.app » de la liste « Bloqué » (ou autorisez-le), puis réessayez. Si l'appli est installée sur l'écran d'accueil : appui long sur son icône → <strong>Infos sur l'appli → Autorisations → Micro → Autoriser</strong>.`;
  else if (e && e.name === "NotFoundError") msg = "Aucun micro n'a été trouvé sur cet appareil.";
  else if (e && e.name === "NotReadableError") msg = "Le micro est déjà utilisé par une autre application (appel, dictaphone…). Fermez-la puis réessayez.";
  else if (e && e.name === "NotAllowedError") msg = `Le micro n'a pas été autorisé. Réessayez et choisissez <strong>« Autoriser »</strong> quand le téléphone le demande. Si rien ne s'affiche, fermez complètement l'application et rouvrez-la.`;
  else msg = "Impossible de démarrer l'enregistrement (" + esc(e?.name || String(e)) + ").";
  let box = document.getElementById("aideMicro");
  if (!box) { box = document.createElement("div"); box.id = "aideMicro"; box.className = "notice err small"; $("#sgo", el)?.closest(".card")?.after(box); }
  box.innerHTML = "🎙 " + msg; box.scrollIntoView({ block: "center", behavior: "smooth" });
}

function ecranEnregistrement(el) {
  el.innerHTML = `<section class="hero" style="padding-bottom:10px"><div class="kicker">${esc(R.s.eglise || "Sermon")}</div><h1 id="srTemps">${hms(duree())}</h1>
    <div style="height:8px;background:var(--line);border-radius:4px;max-width:240px;margin:8px auto 0;overflow:hidden"><div id="srNiv" style="height:100%;width:0;background:#B3261E;transition:width .1s"></div></div></section>
  <div class="row" style="justify-content:center"><button class="btn ghost" id="srPause">${R.pause ? "▶ Reprendre" : "❚❚ Pause"}</button><button class="btn" id="srFin">■ Terminer</button></div>
  ${R.sr || R.srErreur ? `<h2 class="sec">Transcription en direct</h2><div class="card small" id="srTexte" style="max-height:170px;overflow:auto"></div>` : ""}
  <h2 class="sec">Mes notes</h2>
  <textarea id="srNote" maxlength="2000" placeholder="Ce que je comprends, une question, une idée…" style="min-height:70px"></textarea>
  <div class="row" style="margin-top:8px">${Object.entries(TYPES).map(([k, [ic, l]]) => `<button class="btn ${k === "note" ? "" : "ghost"} sm" data-n="${k}">${ic} ${l}</button>`).join("")}</div>
  <p class="small muted">« Pas compris » sans texte : la phrase que le prédicateur vient de dire est gardée avec la note.</p>
  <ul class="list" id="srNotes"></ul>`;
  const listeNotes = () => { $("#srNotes", el).innerHTML = R.s.notes.slice().reverse().map(n => `<li class="small"><span class="muted">${hms(n.t)}</span> <strong>${TYPES[n.type][0]} ${TYPES[n.type][1]}</strong> ${esc(n.texte || (n.contexte ? "« " + n.contexte + " »" : ""))}</li>`).join(""); };
  listeNotes(); majTranscription();
  el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
    const t = $("#srNote", el).value.trim(); if (b.dataset.n === "note" && !t) { $("#srNote", el).focus(); return; }
    ajouterNote(b.dataset.n, t); $("#srNote", el).value = ""; listeNotes(); toast("Note ajoutée à " + hms(duree()));
  });
  $("#srPause", el).onclick = () => { basculerPause(); ecranEnregistrement(el); };
  $("#srFin", el).onclick = async () => { const id = await terminer(); location.hash = "#/sermon/" + id; };
  const niv = () => { const n = document.getElementById("srNiv"); if (!n || !R.actif || !R.an) return; const d = new Uint8Array(R.an.fftSize); R.an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); n.style.width = Math.min(100, m / 1.0) + "%"; rafId = requestAnimationFrame(niv); };
  cancelAnimationFrame(rafId); niv();
}

async function detail(el, id) {
  const s = await sdb.get(id);
  if (!s) { el.innerHTML = `<div class="empty">Sermon introuvable. <a href="#/sermon">Retour</a></div>`; return; }
  const blob = await sdb.audio(id, s.mime).catch(() => null), url = blob ? URL.createObjectURL(blob) : "";
  const ext = (s.mime || blob?.type || "").includes("mp4") ? "m4a" : (s.mime || "").includes("ogg") ? "ogg" : "webm";
  el.innerHTML = `<section class="hero"><div class="kicker">${esc(frDate(s.date))} · ${hms(s.duree)}</div><h1>${esc(s.eglise || "Sermon")}</h1>${s.predicateur ? `<p>${esc(s.predicateur)}</p>` : ""}<span class="orn"></span></section>
  ${url ? `<audio controls src="${url}" style="width:100%"></audio><p class="small"><a href="${url}" download="sermon-${s.date}.${ext}">Télécharger l'audio</a></p>` : `<div class="notice small">Pas d'audio enregistré.</div>`}
  <h2 class="sec">Compte rendu par Claude</h2>
  <div class="card"><p class="small" style="margin-top:0">1. Copiez la demande préparée (transcription + vos notes). 2. Ouvrez Claude et collez-la. 3. Collez la réponse ci-dessous pour la garder.</p>
    <div class="row"><button class="btn" id="dCopie">Copier la demande</button><a class="btn ghost" href="https://claude.ai/new" target="_blank" rel="noopener">Ouvrir Claude</a></div>
    <label for="dCR" style="margin-top:12px">Compte rendu et résumé</label><textarea id="dCR" maxlength="20000" style="min-height:160px" placeholder="Collez ici la réponse de Claude">${esc(s.compteRendu || "")}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="dSave">Enregistrer</button><button class="btn gold sm" id="dJournal">Ajouter à mon journal</button></div></div>
  <h2 class="sec">Mes notes (${s.notes.length})</h2>
  ${s.notes.length ? `<ul class="list">${s.notes.map(n => `<li class="small"><span class="muted">${hms(n.t)}</span> <strong>${TYPES[n.type]?.[0] || ""} ${TYPES[n.type]?.[1] || ""}</strong> ${esc(n.texte)}${n.contexte ? `<br><span class="muted">« ${esc(n.contexte)} »</span>` : ""}</li>`).join("")}</ul>` : `<div class="empty">Aucune note.</div>`}
  <h2 class="sec">Transcription</h2>
  ${blob ? `<div class="card soft"><p class="small" style="margin-top:0"><strong>Transcrire l'audio sur ce téléphone</strong> — l'audio ne quitte pas l'appareil. La première fois, le modèle de reconnaissance vocale (Whisper, environ 80 Mo) est téléchargé puis gardé ; préférez le Wi-Fi. Comptez quelques minutes, l'écran doit rester allumé.</p>
    <button class="btn sm" id="dTrans">${s.transcription.length ? "Refaire la transcription" : "Transcrire l'audio"}</button>
    <div id="dTrEtat" class="small" style="margin-top:8px"></div></div>` : ""}
  <p class="small muted">Transcription automatique : vous pouvez corriger les erreurs avant de copier la demande.</p>
  <textarea id="dTr" style="min-height:200px">${esc(s.transcription.map(x => `[${hms(x.t)}] ${x.texte}`).join("\n"))}</textarea>
  <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="dTrSave">Enregistrer la transcription</button></div>
  <p style="margin-top:24px"><button class="btn danger sm" id="dDel">Supprimer ce sermon</button> <a class="small" href="#/sermon">Tous mes sermons</a></p>`;

  // Les fichiers WebM produits par le navigateur n'indiquent pas leur durée : on force le calcul pour pouvoir avancer dans l'audio
  const lecteur = el.querySelector("audio");
  if (lecteur) lecteur.addEventListener("loadedmetadata", () => {
    if (lecteur.duration === Infinity || isNaN(lecteur.duration)) {
      lecteur.currentTime = 1e101;
      lecteur.addEventListener("timeupdate", function f() { lecteur.removeEventListener("timeupdate", f); lecteur.currentTime = 0; });
    }
  }, { once: true });
  const bt = $("#dTrans", el);
  if (bt) bt.onclick = async () => {
    if (s.transcription.length && !bt.dataset.ok) { bt.dataset.ok = 1; bt.textContent = "Confirmer (remplace la transcription actuelle)"; return; }
    bt.disabled = true; const etat = $("#dTrEtat", el), t0 = Date.now();
    const dire = h => { if (document.body.contains(etat)) etat.innerHTML = h; };
    let lock = null; try { lock = await navigator.wakeLock?.request("screen"); } catch {}
    try {
      dire("Préparation de l'audio…");
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close();
      const audio = buf.getChannelData(0).slice();
      const w = new Worker("/js/transcription-worker.js", { type: "module" });
      const res = await new Promise((ok, ko) => {
        w.onmessage = ({ data: m }) => {
          if (m.type === "telechargement") dire(`Téléchargement du modèle : ${m.total ? Math.round(100 * m.loaded / m.total) + " %" : Math.round(m.loaded / 1e6) + " Mo"} (une seule fois)`);
          else if (m.type === "pret") dire(`Transcription en cours (${m.appareil === "webgpu" ? "processeur graphique" : "processeur"})…`);
          else if (m.type === "avance") dire(`Transcription en cours… ${Math.round(100 * m.fait / m.duree)} % · ${Math.round((Date.now() - t0) / 1000)} s`);
          else if (m.type === "fini") ok(m.morceaux); else if (m.type === "erreur") ko(new Error(m.message));
        };
        w.onerror = e => ko(new Error(e.message || "le module de transcription n'a pas pu démarrer"));
        w.postMessage({ type: "transcrire", audio }, [audio.buffer]);
      });
      w.terminate();
      s.transcription = res; await sdb.save(s); toast("Transcription terminée"); detail(el, id);
    } catch (e) { dire(`Transcription impossible : ${esc(e.message || String(e))}. Vérifiez la connexion pour le premier téléchargement du modèle.`); bt.disabled = false; }
    finally { try { lock?.release(); } catch {} }
  };
  const lireTr = () => $("#dTr", el).value.split("\n").map(l => { const m = l.match(/^\[(\d+(?::\d+){1,2})\]\s*(.*)$/); if (!m) return l.trim() ? { t: 0, texte: l.trim() } : null; const p = m[1].split(":").map(Number); return { t: p.reduce((a, b) => a * 60 + b, 0), texte: m[2] }; }).filter(Boolean);
  $("#dTrSave", el).onclick = async () => { s.transcription = lireTr(); await sdb.save(s); toast("Transcription enregistrée"); };
  $("#dCopie", el).onclick = async () => {
    s.transcription = lireTr(); await sdb.save(s);
    const txt = demande(s);
    try { await navigator.clipboard.writeText(txt); toast("Demande copiée : collez-la dans Claude"); }
    catch { await modal(`<h2>Copier la demande</h2><textarea style="min-height:240px" readonly>${esc(txt)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close="x">Fermer</button></div>`, () => {}); }
  };
  $("#dSave", el).onclick = async () => { s.compteRendu = $("#dCR", el).value; await sdb.save(s); toast("Compte rendu enregistré"); };
  $("#dJournal", el).onclick = async () => {
    s.compteRendu = $("#dCR", el).value; await sdb.save(s);
    const mc = store.prefs.get("messeEnCours", null);
    const jid = s.journalId || (mc && mc.date === s.date && store.get("journal", mc.id) ? mc.id : store.newId());
    const e = store.get("journal", jid) || { id: jid, date: s.date, categorie: "Messe", eglise: s.eglise, egliseId: "", notes: "", passages: "", reflexions: "", intentions: "" };
    const mesNotes = s.notes.map(n => `[${hms(n.t)}] ${TYPES[n.type]?.[1] || "Note"} : ${n.texte || (n.contexte ? "« " + n.contexte + " »" : "")}`).join("\n");
    try {
      await store.put("journal", jid, { ...e, notes: (s.compteRendu || e.notes || "").slice(0, 20000), reflexions: [e.reflexions, mesNotes && "Notes prises pendant le sermon :\n" + mesNotes].filter(Boolean).join("\n\n").slice(0, 20000) });
      s.journalId = jid; await sdb.save(s); toast("Ajouté à votre journal");
    } catch { toast("Enregistrement impossible"); }
  };
  $("#dDel", el).onclick = async e => {
    const b = e.currentTarget; if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer la suppression (audio, notes, transcription)"; return; }
    await sdb.remove(id); if (url) URL.revokeObjectURL(url); toast("Sermon supprimé"); location.hash = "#/sermon";
  };
}
