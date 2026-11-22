// Transcription du sermon dans un worker (la page reste fluide). L'audio ne quitte pas l'appareil.
// Le worker reste ouvert : il reçoit les tranches du sermon les unes après les autres.
import { transcrire } from "./transcrire.js";
self.postMessage({ type: "demarre" });
self.onmessage = async ({ data }) => {
  if (data.type !== "transcrire") return;
  try { self.postMessage({ type: "fini", n: data.n, morceaux: await transcrire(data.audio, m => self.postMessage({ ...m, n: data.n })) }); }
  catch (e) { self.postMessage({ type: "erreur", n: data.n, message: String(e && e.message || e) }); }
};
