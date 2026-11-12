// Notifications push — logique pure (sans dépendance), partagée par l'envoi et les tests.
export const CATEGORIES = {
  missions: "Missions paroissiales",
  liturgie: "Temps forts liturgiques",
  infos: "Informations importantes",
  app: "Nouveautés de l'application"
};
export const LINK_RE = /^\/(#\/[A-Za-z0-9/_-]{0,120})?$/;          // lien interne uniquement : "/" ou "/#/route"
export const safeLink = l => (typeof l === "string" && LINK_RE.test(l) ? l : "/");
export const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const txt = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function validateNotification(n) {
  const e = [];
  if (!txt(n.title, 81) || txt(n.title, 81).length > 80) e.push("titre absent ou trop long (80 caractères)");
  if (!txt(n.body, 241) || txt(n.body, 241).length > 240) e.push("message absent ou trop long (240 caractères)");
  if (!Object.hasOwn(CATEGORIES, n.category)) e.push("catégorie inconnue");
  if (n.link != null && !LINK_RE.test(n.link)) e.push("lien de destination non autorisé");
  return e;
}

// Message « données seules » : c'est le service worker du site qui affiche la notification, une seule fois (tag = identifiant).
export function buildMessage(n, fids) {
  return {
    fids,
    data: { title: txt(n.title, 80), body: txt(n.body, 240), link: safeLink(n.link), tag: String(n.id), category: n.category },
    webpush: { headers: { TTL: "86400", Urgency: "normal" } }
  };
}

const DEAD = ["messaging/installation-id-not-registered", "messaging/registration-token-not-registered", "messaging/invalid-installation-id", "messaging/invalid-registration-token"];
export const isDead = code => DEAD.includes(code);

export function missionNotification(m) {
  return { id: "mission_" + m.id, source: "auto", category: "missions", link: "/#/missions",
    title: txt("Nouvelle mission : " + (m.titre || "bénévolat"), 80),
    body: txt([m.paroisse, m.domaine].filter(Boolean).join(" — ") || "Une paroisse recherche des bénévoles.", 240) };
}

export const LIMITS = { perRun: 20, perDay: 30, batch: 500, missionWindowMs: 48 * 3600e3, staleMs: 30 * 60e3 };

// Un passage complet. `store` isole la base (Firestore en production, mémoire dans les tests).
export async function runSender({ store, messaging, now = Date.now(), log = () => {} }) {
  const out = { enqueued: 0, sent: 0, failed: 0, skipped: 0, recipients: 0, removed: 0 };

  // 1. Nouvelles publications : missions publiées récemment et jamais notifiées (ni brouillon, ni simple modification).
  for (const m of await store.listNewMissions(now - LIMITS.missionWindowMs)) {
    if (await store.enqueueOnce(missionNotification(m), m.id, now)) { out.enqueued++; log("file d'attente : mission " + m.id); }
  }
  // 2. Envois interrompus : jamais relancés automatiquement (un renvoi produirait des doublons).
  await store.failStale(now - LIMITS.staleMs, "Envoi interrompu ; non relancé pour éviter un doublon.");

  // 3. File d'attente.
  let today = await store.countSince(now - 24 * 3600e3);
  for (const q of await store.listQueued(LIMITS.perRun)) {
    if (!(await store.claim(q.id, now))) { out.skipped++; continue; }           // déjà pris par un autre passage
    const fail = async msg => { out.failed++; log(`échec ${q.id} : ${msg}`); await store.complete(q.id, { status: "failed", error: msg, finishedAt: now }); };
    const errs = validateNotification(q);
    if (errs.length) { await fail(errs.join(" ; ")); continue; }
    if (q.source !== "auto" && !(await store.isAdmin(q.createdBy))) { await fail("auteur non administrateur"); continue; }
    if (today >= LIMITS.perDay) { await fail("plafond quotidien d'envois atteint"); continue; }
    today++;

    const subs = [...new Map((await store.listSubscribers(q.category)).filter(s => s.fid).map(s => [s.fid, s])).values()];
    let success = 0, failure = 0, removed = 0;
    for (const part of chunk(subs, LIMITS.batch)) {
      try {
        const res = await messaging.sendEachForMulticast(buildMessage(q, part.map(s => s.fid)));
        for (let i = 0; i < res.responses.length; i++) {
          const r = res.responses[i];
          if (r.success) { success++; continue; }
          failure++;
          if (isDead(r.error?.code)) { await store.deactivate(part[i].id, now); removed++; }
        }
      } catch (e) { failure += part.length; log(`lot en échec ${q.id} : ${e.code || e.message}`); }
    }
    await store.complete(q.id, { status: "sent", recipients: subs.length, success, failure, removed, finishedAt: now });
    out.sent++; out.recipients += success; out.removed += removed;
    log(`envoyé ${q.id} : ${success}/${subs.length} (retirés : ${removed})`);
  }
  return out;
}
