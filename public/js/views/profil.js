import { esc, $, toast, fetchJson, modal } from "../ui.js";
import * as store from "../store.js";
import { cloud, signIn, signOutUser } from "../cloud.js";

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function profil(el) {
  const u = cloud.user, cal = store.prefs.get("calendrier", "romain"), langue = store.prefs.get("langue", "bi");
  el.innerHTML = `
  <section class="hero"><h1>Profil</h1><p>${u ? "Connecté : " + esc(u.email || u.displayName || "") : "Vous utilisez l'application sans compte."}</p><span class="orn"></span></section>
  <h2 class="sec">Compte</h2>
  <div class="card">
    ${u ? `<p>${store.state.consent ? "Votre journal et vos visites sont enregistrés dans votre compte (consentement donné)." : "Consentement non donné : vos données restent sur cet appareil."}</p>
          <button class="btn ghost" id="out">Se déconnecter</button>`
      : cloud.ready ? `<p>Un compte est facultatif. Il sert uniquement à retrouver votre journal et votre passeport sur plusieurs appareils, et à proposer votre aide aux paroisses.</p><button class="btn" id="in">Se connecter avec Google</button>
          <p class="small muted" style="margin-top:8px">Connexion par e-mail et mot de passe : à venir.</p>`
      : `<p class="muted">Connexion indisponible (hors ligne ou service non configuré).</p>`}
  </div>
  <h2 class="sec">Préférences liturgiques</h2>
  <div class="card">
    <label for="pc">Calendrier par défaut</label><select id="pc"><option value="romain"${cal === "romain" ? " selected" : ""}>Missel romain actuel</option><option value="m1962"${cal === "m1962" ? " selected" : ""}>Missel de 1962</option></select>
    <label for="pl">Affichage du missel</label><select id="pl"><option value="la"${langue === "la" ? " selected" : ""}>Latin</option><option value="bi"${langue === "bi" ? " selected" : ""}>Bilingue</option><option value="fr"${langue === "fr" ? " selected" : ""}>Français</option></select>
    <p class="small muted" style="margin-top:8px">Ces préférences restent sur cet appareil.</p>
  </div>
  <h2 class="sec">Mes données</h2>
  <div class="card">
    <p class="small">Journal : ${store.list("journal").length} entrée(s) · Visites : ${store.list("visits").length} · Stockage : ${store.isCloud() ? "compte (Union européenne)" : "cet appareil"}.</p>
    <div class="row"><button class="btn ghost" id="exp">Exporter mes données (JSON)</button>
    </div>
  </div>
  <h2 class="sec">Supprimer toutes mes données</h2>
  <div class="card">
    <p class="small" style="margin-top:0">Efface définitivement et sans retour possible :</p>
    <ul class="small" style="margin:0 0 10px 18px;padding:0">
      ${u ? "<li>votre compte (" + esc(u.email || "") + ") et tout ce qui y est enregistré : journal, visites, candidatures aux missions, signalements, abonnements aux notifications ;</li>" : ""}
      <li>sur ce téléphone : journal et visites, sermons enregistrés (audio, notes, transcriptions), favoris, préférences, chapitres de la Bible et modèle de transcription gardés en cache.</li>
    </ul>
    <p class="small muted">Pensez à exporter vos données avant, si vous voulez les garder.${u ? " Les données copiées par vous dans d'autres services (par exemple un compte rendu collé dans Claude) ne sont pas concernées." : ""}</p>
    <button class="btn danger" id="del">Supprimer définitivement toutes mes données</button>
  </div>
  <h2 class="sec">Notifications</h2>
  <div class="card"><p class="small">Alertes pour les nouvelles missions, les grandes fêtes et les annonces importantes.</p><a class="btn ghost" href="#/notifications">Gérer les notifications</a></div>
  <h2 class="sec">Informations</h2>
  <ul class="list">
    <li><a href="#/sources">Sources, licences et droits d'auteur</a></li>
    <li><a href="/confidentialite.html">Politique de confidentialité</a></li>
    <li><a href="/cgu.html">Conditions générales d'utilisation</a></li>
    <li><a href="/mentions-legales.html">Mentions légales</a></li>
  </ul>
  <p class="small muted">Aucun cookie publicitaire, aucun outil de mesure d'audience. Version de démonstration : non encore validée juridiquement ni liturgiquement.</p>`;

  const on = (id, fn) => { const b = $("#" + id, el); if (b) b.onclick = fn; };
  on("in", () => signIn().catch(e => toast("Connexion impossible : " + (e.code || e.message))));
  on("out", async () => { await signOutUser(); toast("Déconnecté"); });
  $("#pc", el).onchange = e => store.prefs.set("calendrier", e.target.value);
  $("#pl", el).onchange = e => store.prefs.set("langue", e.target.value);
  on("exp", async () => {
    let candidatures = [];
    if (u) { try { const { fs, db } = cloud; candidatures = (await fs.getDocs(fs.query(fs.collection(db, "applications"), fs.where("uid", "==", u.uid)))).docs.map(d => d.data()); } catch { /* aucune */ } }
    download("guardian-angel-mes-donnees.json", JSON.stringify(store.exportAll({ compte: u ? { email: u.email, nom: u.displayName } : null, candidatures }), null, 2));
  });
  on("del", async () => {
    const r = await modal(`<h2>Tout supprimer ?</h2>
      <p class="small">Cette action est <strong>définitive</strong> : rien ne pourra être récupéré${u ? ", ni sur ce téléphone ni sur votre compte" : ""}.</p>
      <label for="dConf">Pour confirmer, écrivez <strong>SUPPRIMER</strong></label><input id="dConf" autocomplete="off" autocapitalize="characters">
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-close="x">Annuler</button><button class="btn danger" id="dOk" disabled>Supprimer</button></div>`,
      (d, done) => { const i = $("#dConf", d), ok = $("#dOk", d); i.oninput = () => { ok.disabled = i.value.trim().toUpperCase() !== "SUPPRIMER"; }; ok.onclick = () => done("go"); });
    if (r !== "go") return;
    el.innerHTML = `<section class="hero"><h1>Suppression en cours…</h1><p>Ne fermez pas l'application.</p></section><ul class="list" id="etapes"></ul>`;
    const etapes = {}, ul = $("#etapes", el);
    const etape = (lib, st) => { if (!etapes[lib]) { etapes[lib] = document.createElement("li"); ul.appendChild(etapes[lib]); } etapes[lib].innerHTML = `${st === "ok" ? "✓" : st === "erreur" ? "⚠" : "…"} ${esc(lib)}`; };
    const { toutEffacer } = await import("../effacement.js");
    const erreurs = await toutEffacer(etape);
    el.innerHTML = erreurs.length
      ? `<section class="hero"><h1>Suppression incomplète</h1></section><div class="notice err small">Certaines données n'ont pas pu être supprimées :<br>${erreurs.map(esc).join("<br>")}<br><br>Si le message parle de « connexion récente », reconnectez-vous puis recommencez. Sinon, réessayez avec une bonne connexion.</div><p class="center"><a class="btn" href="#/profil" onclick="location.reload()">Retour</a></p>`
      : `<section class="hero"><h1>Toutes vos données ont été supprimées</h1><p>L'application est revenue à son état de départ.</p><span class="orn"></span></section><p class="center"><button class="btn" id="fin">Terminer</button></p>`;
    const f = $("#fin", el); if (f) f.onclick = () => { location.hash = "#/accueil"; location.reload(); };
  });
}

const STATUTS = { PUBLIC_DOMAIN: "Domaine public", OPEN_LICENSE_VERIFIED: "Licence ouverte vérifiée", PERMISSION_GRANTED: "Autorisation obtenue", PERMISSION_REQUIRED: "Autorisation à demander", LEGAL_REVIEW_REQUIRED: "Revue juridique requise", PROHIBITED: "Interdit" };
export async function sources(el) {
  el.innerHTML = `<section class="hero"><div class="kicker">Transparence</div><h1>Sources et droits</h1><p>Chaque ressource extérieure est inscrite dans un registre avec sa licence et son statut.</p><span class="orn"></span></section><div id="sr"><div class="skeleton"></div></div>`;
  const j = await fetchJson("/data/content-rights.json");
  const box = $("#sr", el); if (!box) return;
  if (!j) { box.innerHTML = `<div class="empty">Registre indisponible.</div>`; return; }
  const row = r => `<div class="card"><div class="row between"><h3>${esc(r.nom)}</h3><span class="chip">${esc(STATUTS[r.statut] || r.statut)}</span></div>
    <dl class="kv" style="margin-top:8px"><dt>Type</dt><dd>${esc(r.type)}</dd><dt>Titulaire</dt><dd>${esc(r.titulaire || "—")}</dd><dt>Licence</dt><dd>${esc(r.licence || "—")}</dd>
    <dt>Attribution</dt><dd>${esc(r.attribution || "—")}</dd><dt>Usage</dt><dd>${r.utilise ? "Utilisée dans l'application" : "<strong>Non intégrée</strong>"}</dd>
    ${r.demander_a ? `<dt>À demander à</dt><dd>${esc(r.demander_a)}</dd>` : ""}<dt>Vérifié le</dt><dd>${esc(r.verifie_le)}</dd></dl>
    ${r.conditions ? `<p class="small muted" style="margin:8px 0 0">${esc(r.conditions)}</p>` : ""}</div>`;
  box.innerHTML = `<h2 class="sec">Ressources utilisées</h2>${j.ressources.filter(r => r.utilise).map(row).join("")}
    <h2 class="sec">Autorisations à demander avant intégration</h2>${j.ressources.filter(r => !r.utilise).map(row).join("")}
    <p class="small muted">Ce registre est un outil de suivi ; il ne constitue pas un avis juridique.</p>`;
}
