import { esc, $, toast, fetchJson } from "../ui.js";
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
    <button class="btn danger" id="del">${u ? "Supprimer mon compte et mes données" : "Effacer les données de cet appareil"}</button></div>
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
  on("del", async e => {
    const b = e.target;
    if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer : suppression définitive"; setTimeout(() => { if (b.isConnected) profil(el); }, 6000); return; }
    b.disabled = true;
    try { if (u) await store.deleteAccount(); else store.eraseLocal(); toast("Données supprimées"); }
    catch (err) { console.error(err); toast("Suppression interrompue : " + (err.code || err.message)); }
    profil(el);
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
