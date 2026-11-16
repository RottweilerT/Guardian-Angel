// Transcription du sermon SUR LE TÉLÉPHONE (Whisper, via Transformers.js).
// L'audio ne quitte pas l'appareil ; seuls la bibliothèque (jsDelivr) et le modèle (Hugging Face) sont téléchargés,
// une seule fois, puis gardés en cache par le navigateur.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels = false;
const MODELE = "onnx-community/whisper-base";
let asr = null, appareil = "";

async function charger(progres) {
  if (asr) return asr;
  let gpu = false;
  try { gpu = !!(self.navigator.gpu && await self.navigator.gpu.requestAdapter()); } catch {}
  const essais = gpu ? [["webgpu", { encoder_model: "fp32", decoder_model_merged: "q4" }], ["wasm", "q8"]] : [["wasm", "q8"]];
  let derniere;
  for (const [device, dtype] of essais) {
    try { asr = await pipeline("automatic-speech-recognition", MODELE, { device, dtype, progress_callback: progres }); appareil = device; return asr; }
    catch (e) { derniere = e; }
  }
  throw derniere;
}

self.onmessage = async ({ data }) => {
  if (data.type !== "transcrire") return;
  try {
    const fichiers = {};
    const t = await charger(p => {
      if (p.status === "progress" && p.file) { fichiers[p.file] = [p.loaded || 0, p.total || 0]; const v = Object.values(fichiers); self.postMessage({ type: "telechargement", loaded: v.reduce((a, x) => a + x[0], 0), total: v.reduce((a, x) => a + x[1], 0) }); }
    });
    self.postMessage({ type: "pret", appareil });
    const duree = data.audio.length / 16000; let fait = 0;
    const out = await t(data.audio, {
      language: "french", task: "transcribe", chunk_length_s: 30, stride_length_s: 5, return_timestamps: true,
      chunk_callback: () => { fait += 25; self.postMessage({ type: "avance", fait: Math.min(fait, duree), duree }); }
    });
    const morceaux = (out.chunks || []).map(c => ({ t: Math.round((c.timestamp && c.timestamp[0]) || 0), texte: (c.text || "").trim() })).filter(c => c.texte);
    self.postMessage({ type: "fini", morceaux: morceaux.length ? morceaux : [{ t: 0, texte: (out.text || "").trim() }] });
  } catch (e) { self.postMessage({ type: "erreur", message: String(e && e.message || e) }); }
};
