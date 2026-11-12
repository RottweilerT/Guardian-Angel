import { esc, $, $$, toast, frDate } from "../ui.js";
import { cloud } from "../cloud.js";
import * as push from "../push.js";

const BELL = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/></svg>`;
const ETATS = {
  on: ["Activées", "Vous recevrez les notifications des catégories cochées sur cet appareil.", "ok"],
  paused: ["En pause", "Votre abonnement est conservé mais aucune notification n'est envoyée à cet appareil.", ""],
  off: ["Désactivées", "Aucune notification n'est envoyée à cet appareil.", ""],
  denied: ["Refusées par le navigateur", "Vous avez bloqué les notifications pour ce site. Pour les autoriser : réglages du navigateur → Confidentialité → Notifications → autoriser ce site, puis revenez ici.", "err"],
  unsupported: ["Non compatibles", "Ce navigateur ne prend pas en charge les notifications web. Elles fonctionnent avec Chrome, Edge, Firefox (Android, Windows, macOS, Linux), Safari 16 et plus sur macOS, et Safari sur iPhone/iPad (iOS 16.4 et plus) une fois l'application ajoutée à l'écran d'accueil.", "err"],
  "ios-install": ["Installation nécessaire", "Sur iPhone et iPad, les notifications ne fonctionnent que depuis l'application ajoutée à l'écran d'accueil (iOS 16.4 ou plus récent).", ""],
  "not-configured": ["Pas encore configurées", "Le service de notifications n'a pas encore été activé par l'équipe.", ""]
};
let busy = false;

export default function notifications(el) {
  const st = push.status(), s = st.local;
  const [label, txt, kind] = ETATS[st.state];
  const chosen = s?.categories || push.CAT_IDS.filter(c => c !== "nouveautes");
  const can = ["off", "on", "paused"].includes(st.state);
  el.innerHTML = `
  <section class="hero"><div class="kicker" style="display:flex;justify-content:center">${BELL}</div><h1>Notifications</h1>
    <p>Recevez une alerte sur votre téléphone ou votre ordinateur, même lorsque l'application est fermée.</p><span class="orn"></span></section>
  <div class="card" aria-live="polite">
    <div class="row between"><h3>État sur cet appareil</h3><span class="chip"><span class="dot" style="background:${st.state === "on" ? "var(--ok)" : kind === "err" ? "var(--danger)" : "#bbb"}"></span>${esc(label)}</span></div>
    <p class="small ${kind === "err" ? "" : "muted"}" style="margin-top:8px">${esc(txt)}</p>
    ${st.state === "ios-install" ? `<ol class="small" style="margin:0;padding-left:20px"><li>Ouvrez ce site dans <strong>Safari</strong>.</li><li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li><li>Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.</li><li>Ouvrez Guardian Angel depuis son icône et revenez sur cette page.</li></ol>` : ""}
  </div>
  ${can ? `
  <h2 class="sec">Ce que je veux recevoir</h2>
  <fieldset class="card" style="margin:0" id="cats"><legend class="sr">Catégories</legend>
    ${push.CATEGORIES.map(c => `<label class="field-inline" style="margin:8px 0"><input type="checkbox" value="${c.id}"${chosen.includes(c.id) ? " checked" : ""}><span><strong>${esc(c.label)}</strong><br><span class="small muted">${esc(c.desc)}</span></span></label>`).join("")}
  </fieldset>
  <div class="row" style="margin-top:14px">
    ${st.state === "off" ? `<button class="btn" id="pOn">${BELL} Activer les notifications</button>`
      : `<button class="btn" id="pSave">Enregistrer mes choix</button>
         <button class="btn ghost" id="pPause">${st.state === "paused" ? "Reprendre" : "Mettre en pause"}</button>
         <button class="btn danger" id="pOff">Se désabonner</button>`}
  </div>` : ""}
  <div class="notice small" style="margin-top:20px">Aucun compte n'est nécessaire. Nous enregistrons uniquement un identifiant technique de cet appareil (fourni par Firebase Cloud Messaging) et vos catégories, pour vous envoyer les alertes demandées. Rien d'autre, aucune publicité. Le désabonnement efface ces données. <a href="/confidentialite.html">En savoir plus</a></div>
  <div id="admin"></div>`;

  const cats = () => $$("#cats input:checked", el).map(i => i.value);
  const act = async (fn, ok) => {
    if (busy) return; busy = true; $$("button", el).forEach(b => { b.disabled = true; });
    try { await fn(); if (ok) toast(ok); }
    catch (e) {
      console.warn(e);
      toast({ "ga/denied": "Autorisation refusée par le navigateur", "ga/no-category": "Cochez au moins une catégorie", "ga/unsupported": "Navigateur non compatible", "auth/admin-restricted-operation": "Service d'abonnement pas encore ouvert", "auth/operation-not-allowed": "Service d'abonnement pas encore ouvert", "ga/offline": "Hors ligne : réessayez plus tard" }[e.code] || "Opération impossible pour le moment");
    }
    busy = false; notifications(el);
  };
  const on = (id, fn) => { const b = $("#" + id, el); if (b) b.onclick = fn; };
  on("pOn", () => act(() => push.enable(cats()), "Notifications activées"));
  on("pSave", () => act(() => push.setCategories(cats()), cats().length ? "Préférences enregistrées" : "Désabonné"));
  on("pPause", () => act(() => push.setActive(st.state === "paused"), st.state === "paused" ? "Notifications reprises" : "Notifications en pause"));
  on("pOff", () => act(() => push.unsubscribe(), "Désabonnement effectué"));
  if (cloud.admin) admin($("#admin", el));
}

// --- Espace administrateur : rédaction, aperçu, envoi, historique. Les droits sont vérifiés par les règles Firestore. ---
const STATUTS = { pending: "En attente d'envoi", sending: "Envoi en cours", sent: "Envoyée", failed: "Échec", cancelled: "Annulée", refused: "Refusée (quota)" };
const LIENS = [["/", "Accueil"], ["/#/missions", "Missions"], ["/#/missel", "Missel du jour"], ["/#/carte", "Carte"], ["/#/journal", "Journal"], ["/#/passeport", "Passeport"]];

async function admin(box) {
  box.innerHTML = `<h2 class="sec">Administration</h2>
  <form class="card" id="nf" novalidate>
    <label for="nt">Titre</label><input id="nt" maxlength="65" required>
    <label for="nb">Message</label><textarea id="nb" maxlength="180" required style="min-height:70px"></textarea>
    <div class="row"><div style="flex:1;min-width:160px"><label for="nc">Catégorie</label><select id="nc">${push.CATEGORIES.map(c => `<option value="${c.id}"${c.id === "annonces" ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
      <div style="flex:1;min-width:160px"><label for="nu">Lien de destination</label><input id="nu" list="nl" value="/" pattern="^/(#/.*)?$"><datalist id="nl">${LIENS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</datalist></div></div>
    <p class="small muted" style="margin:10px 0 4px">Aperçu</p>
    <div class="card soft" style="display:flex;gap:12px;align-items:flex-start;margin:0" aria-label="Aperçu de la notification">
      <img src="/icons/icon-192-v2.png" alt="" width="40" height="40" style="border-radius:8px">
      <div style="min-width:0"><strong id="pvT">Titre</strong><div class="small" id="pvB" style="white-space:pre-wrap">Message</div><div class="small muted">guardian-angel · <span id="pvU">/</span></div></div>
    </div>
    <p class="small muted" id="nerr" role="alert"></p>
    <button class="btn" id="nsend">Envoyer aux abonnés de cette catégorie</button>
    <p class="small muted" style="margin-top:8px">L'envoi est effectué par le serveur dans les 10 minutes environ (planificateur, parfois retardé). Les nouvelles missions publiées et les solennités sont notifiées automatiquement.</p>
  </form>
  <h3 style="margin-top:20px">Historique des envois</h3><div id="nh"><div class="skeleton"></div></div>`;
  const val = () => ({ title: $("#nt", box).value.trim(), body: $("#nb", box).value.trim(), category: $("#nc", box).value, url: $("#nu", box).value.trim() || "/" });
  const pv = () => { const v = val(); $("#pvT", box).textContent = v.title || "Titre"; $("#pvB", box).textContent = v.body || "Message"; $("#pvU", box).textContent = v.url; };
  ["nt", "nb", "nu"].forEach(id => { $("#" + id, box).oninput = pv; });
  const { fs, db, user } = cloud;
  $("#nf", box).onsubmit = async e => {
    e.preventDefault();
    const v = val(), errs = push.validNotification(v);
    $("#nerr", box).textContent = errs.join(" ");
    if (errs.length) return;
    const b = $("#nsend", box);
    if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer l'envoi"; return; }
    b.disabled = true;
    try {
      await fs.addDoc(fs.collection(db, "notifications"), { ...v, source: "manuel", status: "pending", createdBy: user.uid, createdAt: fs.serverTimestamp() });
      toast("Notification programmée"); admin(box);
    } catch (err) { console.error(err); toast("Envoi refusé"); b.disabled = false; }
  };
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, "notifications"), fs.orderBy("createdAt", "desc"), fs.limit(25)));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    $("#nh", box).innerHTML = rows.length ? `<ul class="list">${rows.map(n => `<li>
      <div class="row between"><strong>${esc(n.title)}</strong><span class="chip">${esc(STATUTS[n.status] || n.status)}</span></div>
      <div class="small">${esc(n.body)}</div>
      <div class="small muted">${esc(push.CATEGORIES.find(c => c.id === n.category)?.label || n.category)} · ${esc(n.source)} · ${n.createdAt?.toDate ? esc(n.createdAt.toDate().toLocaleString("fr-FR")) : ""}
      ${n.stats ? ` · ${n.stats.success || 0} reçue(s) sur ${n.stats.targets || 0}${n.stats.removed ? `, ${n.stats.removed} abonnement(s) invalide(s) supprimé(s)` : ""}` : ""}${n.error ? ` · ${esc(n.error)}` : ""}</div>
      ${n.status === "pending" ? `<button class="btn ghost sm" data-cancel="${esc(n.id)}" style="margin-top:6px">Annuler</button>` : ""}</li>`).join("")}</ul>` : `<div class="empty">Aucun envoi pour le moment.</div>`;
    $("#nh", box).onclick = async e => {
      const id = e.target.dataset.cancel; if (!id) return;
      try { await fs.updateDoc(fs.doc(db, "notifications", id), { status: "cancelled" }); admin(box); } catch { toast("Annulation impossible (envoi peut-être déjà commencé)"); }
    };
  } catch (e) { console.warn(e); $("#nh", box).innerHTML = `<div class="notice err">Historique indisponible.</div>`; }
}
