import { esc, $, toast, modal, frDate } from "../ui.js";
import { cloud } from "../cloud.js";

const DOMAINES = ["Chorale", "Organiste", "Catéchisme", "Maraudes", "Entretien", "Communication", "Informatique", "Événementiel", "Accueil", "Patrimoine", "Autre"];
let dom = "", token = 0;

export default async function missions(el) {
  const my = ++token;
  el.innerHTML = `<section class="hero"><div class="kicker">S'engager</div><h1>Missions paroissiales</h1><p>Des besoins concrets publiés par des paroisses vérifiées.</p><span class="orn"></span></section><div id="mb"><div class="skeleton"></div></div>`;
  const box = $("#mb", el);
  if (!cloud.ready) { box.innerHTML = `<div class="empty">Service indisponible hors connexion.</div>`; return; }
  const { fs, db, user } = cloud;
  let list = [], mine = [];
  try {
    const q = cloud.admin ? fs.collection(db, "missions") : fs.query(fs.collection(db, "missions"), fs.where("status", "==", "published"));
    list = (await fs.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
    if (user) mine = (await fs.getDocs(fs.query(fs.collection(db, "applications"), fs.where("uid", "==", user.uid)))).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn(e); box.innerHTML = `<div class="notice err">Impossible de charger les missions pour le moment.</div>`; return; }
  if (my !== token) return;
  const shown = list.filter(m => !dom || m.domaine === dom);
  box.innerHTML = `
    <div class="row"><select id="md" aria-label="Domaine" style="max-width:240px"><option value="">Tous les domaines</option>${DOMAINES.map(d => `<option${d === dom ? " selected" : ""}>${d}</option>`).join("")}</select>
      ${cloud.admin ? '<button class="btn sm" id="madd">+ Nouvelle mission</button>' : ""}</div>
    ${shown.length ? shown.map(m => { const a = mine.find(x => x.missionId === m.id); return `<div class="card">
        <div class="row between"><span class="chip">${esc(m.domaine || "Autre")}</span>${m.status !== "published" ? '<span class="chip">brouillon</span>' : ""}</div>
        <h3 style="margin:6px 0 2px">${esc(m.titre)}</h3><p class="small muted">${esc(m.paroisse || "")}</p>
        <p style="white-space:pre-wrap">${esc(m.description || "")}</p>
        ${a ? `<p class="small"><strong>Candidature envoyée</strong> — statut : ${esc(a.status || "envoyée")} <button class="btn ghost sm" data-wd="${esc(a.id)}">Retirer</button></p>`
        : `<button class="btn sm" data-apply="${esc(m.id)}">Proposer mon aide</button>`}
        ${cloud.admin ? `${m.status !== "published" ? ` <button class="btn sm" data-pub="${esc(m.id)}">Publier</button>` : ""} <button class="btn ghost sm" data-cands="${esc(m.id)}">Candidatures</button> <button class="btn danger sm" data-del="${esc(m.id)}">Supprimer</button>` : ""}</div>`; }).join("")
    : `<div class="empty">Aucune mission publiée pour le moment.<br><span class="small">Les paroisses pourront publier leurs besoins après vérification de leur compte.</span></div>`}
    <div class="notice rights small">Seuls les comptes vérifiés par l'équipe peuvent publier au nom d'une paroisse. Les dons et collectes en ligne ne sont pas proposés : cadre juridique et prestataire de paiement à valider au préalable.</div>`;
  $("#md", el).onchange = e => { dom = e.target.value; missions(el); };

  box.onclick = async e => {
    const t = e.target, pub = t.dataset.pub, ap = t.dataset.apply, wd = t.dataset.wd, del = t.dataset.del, cands = t.dataset.cands;
    try {
      if (pub) {
        // La publication déclenche la notification automatique (une seule fois, côté serveur).
        await fs.updateDoc(fs.doc(db, "missions", pub), { status: "published", publishedAt: fs.serverTimestamp() });
        toast("Mission publiée — les abonnés seront notifiés"); missions(el);
      } else if (ap) {
        if (!user) { toast("Connectez-vous (Profil) pour proposer votre aide"); return; }
        const r = await modal(`<h2>Proposer mon aide</h2>
          <p class="small muted">Votre message, vos disponibilités et votre adresse e-mail (${esc(user.email || "")}) seront transmis aux responsables de cette mission.</p>
          <label for="am">Message</label><textarea id="am" maxlength="2000"></textarea>
          <label for="ac">Compétences</label><input id="ac" maxlength="300">
          <label for="ad">Disponibilités</label><input id="ad" maxlength="300">
          <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-close="x">Annuler</button><button class="btn" id="aok">Envoyer</button></div>`,
          (d, done) => { $("#aok", d).onclick = () => done(JSON.stringify({ message: $("#am", d).value, competences: $("#ac", d).value, disponibilites: $("#ad", d).value })); });
        if (!r || r === "x") return;
        await fs.setDoc(fs.doc(db, "applications", ap + "_" + user.uid), { ...JSON.parse(r), uid: user.uid, missionId: ap, email: user.email || "", status: "envoyée", createdAt: fs.serverTimestamp() });
        toast("Candidature envoyée"); missions(el);
      } else if (wd) { await fs.deleteDoc(fs.doc(db, "applications", wd)); toast("Candidature retirée"); missions(el); }
      else if (del) { if (!t.dataset.ok) { t.dataset.ok = 1; t.textContent = "Confirmer"; return; } await fs.deleteDoc(fs.doc(db, "missions", del)); missions(el); }
      else if (cands) {
        const c = (await fs.getDocs(fs.query(fs.collection(db, "applications"), fs.where("missionId", "==", cands)))).docs.map(d => d.data());
        await modal(`<h2>Candidatures</h2>${c.length ? c.map(x => `<div class="card soft"><strong>${esc(x.email)}</strong><p class="small" style="white-space:pre-wrap">${esc(x.message)}</p><p class="small muted">${esc(x.competences)} · ${esc(x.disponibilites)}</p></div>`).join("") : '<p class="muted">Aucune candidature.</p>'}<div class="row" style="justify-content:flex-end"><button class="btn" data-close="x">Fermer</button></div>`);
      } else if (t.id === "madd") {
        const r = await modal(`<h2>Publier une mission</h2>
          <label for="xt">Titre</label><input id="xt" maxlength="150"><label for="xp">Paroisse</label><input id="xp" maxlength="150">
          <label for="xd">Domaine</label><select id="xd">${DOMAINES.map(d => `<option>${d}</option>`).join("")}</select>
          <label for="xx">Description</label><textarea id="xx" maxlength="4000"></textarea>
          <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-close="x">Annuler</button><button class="btn ghost" id="xdraft">Enregistrer en brouillon</button><button class="btn" id="xok">Publier</button></div>`,
          (d, done) => {
            const go = status => { if ($("#xt", d).value.trim()) done(JSON.stringify({ titre: $("#xt", d).value.trim(), paroisse: $("#xp", d).value.trim(), domaine: $("#xd", d).value, description: $("#xx", d).value, status })); };
            $("#xok", d).onclick = () => go("published"); $("#xdraft", d).onclick = () => go("draft");
          });
        if (!r || r === "x") return;
        const m = JSON.parse(r);
        await fs.addDoc(fs.collection(db, "missions"), { ...m, createdBy: user.uid, createdAt: fs.serverTimestamp(), ...(m.status === "published" ? { publishedAt: fs.serverTimestamp() } : {}) });
        toast(m.status === "published" ? "Mission publiée — les abonnés seront notifiés" : "Brouillon enregistré"); missions(el);
      }
    } catch (err) { console.error(err); toast("Action impossible"); }
  };
}
