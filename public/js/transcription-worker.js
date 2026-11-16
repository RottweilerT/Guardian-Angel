// Transcription du sermon dans un worker (la page reste fluide). L'audio ne quitte pas l'appareil.
import { transcrire } from "./transcrire.js";
self.postMessage({ type: "demarre" });
self.onmessage = async ({ data }) => {
  if (data.type !== "transcrire") return;
  try { self.postMessage({ type: "fini", morceaux: await transcrire(data.audio, m => self.postMessage(m)) }); }
  catch (e) { self.postMessage({ type: "erreur", message: String(e && e.message || e) }); }
};
