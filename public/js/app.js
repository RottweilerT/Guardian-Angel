// Guardian Angel — point d'entrée : routeur, session, consentement.
import { cloud, initCloud, signOutUser } from "./cloud.js";
import * as store from "./store.js";
import { $, $$, esc, modal, toast } from "./ui.js";
import accueil from "./views/accueil.js";
import carte, { eglise } from "./views/carte.js";
import missel from "./views/missel.js";
import journal from "./views/journal.js";
import missions from "./views/missions.js";
import passeport, { parcours } from "./views/passeport.js";
import profil, { sources } from "./views/profil.js";
import notifications from "./views/notifications.js";
import bible from "./views/bible.js";
import { refreshOnStartup } from "./push.js";

const ROUTES = {
  accueil: { v: accueil, nav: "accueil" }, carte: { v: carte, nav: "carte" }, eglise: { v: eglise, nav: "carte" },
  missel: { v: missel, nav: "missel", theme: "bleu" }, journal: { v: journal, nav: "journal", theme: "bleu" },
  missions: { v: missions, nav: "accueil", theme: "rouge" }, passeport: { v: passeport, nav: "accueil" },
  parcours: { v: parcours, nav: "accueil", theme: "rouge" }, profil: { v: profil, nav: "profil" }, sources: { v: sources, nav: "profil" },
  notifications: { v: notifications, nav: "profil" }, bible: { v: bible, nav: "journal", theme: "bleu" }
};
let current = null;

function render(keepScroll) {
  const [name = "accueil", ...params] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const route = ROUTES[name] || ROUTES.accueil;
  const main = $("#main");
  if (route.theme) main.dataset.theme = route.theme; else delete main.dataset.theme;
  $$(".nav a").forEach(a => { if (a.dataset.nav === route.nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const y = window.scrollY;
  current = { name, params };
  try { route.v(main, params); } catch (e) { console.error(e); main.innerHTML = `<div class="notice err">Une erreur est survenue à l'affichage de cette page.</div>`; }
  if (keepScroll) window.scrollTo(0, y); else { window.scrollTo(0, 0); }
  $("#topAccount").textContent = cloud.user ? "Mon compte" : "Profil";
}
window.addEventListener("hashchange", () => render(false));
// Les données ont changé : on redessine, sauf si l'utilisateur est en train de saisir.
// État des notifications ou de la session modifié : on redessine la page Notifications si elle est affichée.
["ga:push", "ga:auth"].forEach(ev => window.addEventListener(ev, () => { if (current?.name === "notifications" && !$("#dlg").open) render(true); }));
// Notification reçue alors que l'application est au premier plan : le service worker la transmet ici.
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type === "ga-open" && typeof d.url === "string" && d.url.startsWith("/")) { location.href = d.url; return; }
  if (d.type !== "ga-push") return;
  const t = $("#toast"); t.innerHTML = `<strong>${esc(d.title)}</strong> — ${esc(d.body)}`; t.classList.add("on");
  t.style.pointerEvents = "auto"; t.style.cursor = d.url ? "pointer" : "default";
  t.onclick = () => { if (d.url) location.href = d.url; t.classList.remove("on"); };
  setTimeout(() => { t.classList.remove("on"); t.style.pointerEvents = "none"; t.onclick = null; }, 8000);
});
window.addEventListener("ga:data", () => {
  const a = document.activeElement;
  if (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName)) return;
  if ($("#dlg").open) return;
  render(true);
});

// Consentement explicite avant tout enregistrement de données spirituelles dans le compte (RGPD art. 9).
async function askConsent() {
  const r = await modal(`
    <h2>Enregistrer mon journal dans mon compte ?</h2>
    <p class="small" style="margin-top:10px">Votre journal spirituel (messes, notes, intentions, églises visitées) peut révéler vos <strong>convictions religieuses</strong>. Ces données sont dites « sensibles » : nous avons besoin de votre accord explicite pour les conserver sur nos serveurs (Google Firebase, Union européenne).</p>
    <ul class="small"><li>Elles restent privées : vous seul y accédez.</li><li>Elles ne servent à aucune publicité ni profilage.</li><li>Vous pouvez les exporter ou tout supprimer à tout moment depuis « Profil ».</li></ul>
    <label class="field-inline"><input type="checkbox" id="cOk"> J'accepte que mes données de journal spirituel soient enregistrées dans mon compte.</label>
    <div class="row" style="margin-top:16px;justify-content:flex-end">
      <button class="btn ghost" data-close="non">Non, rester sur cet appareil</button>
      <button class="btn" id="cYes" disabled>Accepter</button>
    </div>
    <p class="small muted" style="margin-top:10px"><a href="/confidentialite.html">Politique de confidentialité</a></p>`,
    (d, done) => { $("#cOk", d).onchange = e => { $("#cYes", d).disabled = !e.target.checked; }; $("#cYes", d).onclick = () => done("oui"); });
  if (r === "oui") { try { await store.giveConsent(); toast("Journal synchronisé avec votre compte"); } catch (e) { console.error(e); toast("Enregistrement impossible"); } }
  else { await signOutUser(); toast("Vous restez en mode local (sans compte)"); }
}

render(false);
initCloud(async user => {
  const mode = await store.onUserChange(user);
  render(true);
  if (mode === "consent-needed") askConsent();
}).then(ok => { if (ok) { render(true); setTimeout(refreshOnStartup, 3000); } });

if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) navigator.serviceWorker.register("/sw.js").catch(() => {});
