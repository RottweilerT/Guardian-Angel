// Accès Firestore (Admin SDK) pour l'envoi des notifications. Voir notify-core.mjs pour la logique.
import { FieldValue, Timestamp } from "firebase-admin/firestore";
const ts = ms => Timestamp.fromMillis(ms);

export function firestoreStore(db) {
  const notifs = db.collection("notifications"), subs = db.collection("pushSubscriptions");
  return {
    async listNewMissions(sinceMs) {
      const s = await db.collection("missions").where("status", "==", "published").get();
      return s.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !m.notifiedAt && m.createdAt?.toMillis && m.createdAt.toMillis() >= sinceMs);
    },
    // Crée la notification si elle n'existe pas encore et marque la mission, dans une même transaction.
    async enqueueOnce(n, missionId, now) {
      return db.runTransaction(async t => {
        const ref = notifs.doc(n.id), mref = db.collection("missions").doc(missionId);
        const [cur, m] = await Promise.all([t.get(ref), t.get(mref)]);
        if (!m.exists || m.get("status") !== "published" || m.get("notifiedAt")) return false;
        t.update(mref, { notifiedAt: ts(now) });
        if (cur.exists) return false;
        const { id, ...data } = n;
        t.create(ref, { ...data, status: "queued", createdAt: ts(now) });
        return true;
      });
    },
    async failStale(beforeMs, error) {
      const s = await notifs.where("status", "==", "sending").get();
      for (const d of s.docs) if ((d.get("claimedAt")?.toMillis?.() || 0) < beforeMs) await d.ref.update({ status: "failed", error, finishedAt: FieldValue.serverTimestamp() });
    },
    async countSince(sinceMs) { return (await notifs.where("finishedAt", ">=", ts(sinceMs)).count().get()).data().count; },
    async listQueued(limit) {
      const s = await notifs.where("status", "==", "queued").limit(limit).get();
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    // Verrou : un seul passage peut faire passer « queued » à « sending ».
    async claim(id, now) {
      return db.runTransaction(async t => {
        const ref = notifs.doc(id), d = await t.get(ref);
        if (!d.exists || d.get("status") !== "queued") return false;
        t.update(ref, { status: "sending", claimedAt: ts(now) });
        return true;
      });
    },
    async isAdmin(uid) { return !!uid && (await db.collection("admins").doc(String(uid)).get()).exists; },
    async listSubscribers(category) {
      const s = await subs.where("categories", "array-contains", category).select("fid", "active").get();
      return s.docs.filter(d => d.get("active") === true).map(d => ({ id: d.id, fid: d.get("fid") }));
    },
    async deactivate(id, now) { await subs.doc(id).delete(); },
    async complete(id, result) {
      const { finishedAt, ...r } = result;
      await notifs.doc(id).update({ ...r, finishedAt: ts(finishedAt) });
    }
  };
}
