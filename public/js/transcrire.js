// Transcription Whisper sur l'appareil (Transformers.js). Utilisable dans un worker ou dans la page.
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";
const MODELE = "onnx-community/whisper-base";
let asrP = null, appareil = "";

async function charger(progres) {
  if (asrP) return asrP;
  asrP = (async () => {
    const { pipeline, env } = await import(LIB);
    env.allowLocalModels = false;
    let gpu = false;
    try { gpu = !!(globalThis.navigator?.gpu && await globalThis.navigator.gpu.requestAdapter()); } catch {}
    const essais = gpu ? [["webgpu", { encoder_model: "fp32", decoder_model_merged: "q4" }], ["wasm", "q8"]] : [["wasm", "q8"]];
    let derniere;
    for (const [device, dtype] of essais) {
      try { const p = await pipeline("automatic-speech-recognition", MODELE, { device, dtype, progress_callback: progres }); appareil = device; return p; }
      catch (e) { derniere = e; }
    }
    throw derniere;
  })();
  try { return await asrP; } catch (e) { asrP = null; throw e; }
}

// envoie : fonction appelée avec des messages {type: telechargement|pret|avance|fini}
export async function transcrire(audio, envoie) {
  const fichiers = {};
  const t = await charger(p => {
    if (p.status === "progress" && p.file) { fichiers[p.file] = [p.loaded || 0, p.total || 0]; const v = Object.values(fichiers); envoie({ type: "telechargement", loaded: v.reduce((a, x) => a + x[0], 0), total: v.reduce((a, x) => a + x[1], 0) }); }
  });
  envoie({ type: "pret", appareil });
  const duree = audio.length / 16000; let fait = 0;
  const out = await t(audio, {
    language: "french", task: "transcribe", chunk_length_s: 30, stride_length_s: 5, return_timestamps: true,
    chunk_callback: () => { fait += 25; envoie({ type: "avance", fait: Math.min(fait, duree), duree }); }
  });
  const morceaux = (out.chunks || []).map(c => ({ t: Math.round((c.timestamp && c.timestamp[0]) || 0), texte: (c.text || "").trim() })).filter(c => c.texte);
  return morceaux.length ? morceaux : [{ t: 0, texte: (out.text || "").trim() }];
}
