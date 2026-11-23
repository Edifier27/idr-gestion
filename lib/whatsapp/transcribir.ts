// Transcripción de audios (notas de voz de los operadores) con OpenAI. Claude
// no escucha audio: OpenAI lo pasa a texto y después Claude usa ese texto
// para ubicar la prueba, el resumen del caso y el informe.
export async function transcribir(buffer: Buffer, mime: string, nombre: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), nombre.includes(".") ? nombre : `${nombre}.ogg`);
    fd.append("model", "whisper-1");
    fd.append("language", "es");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (!r.ok) return null;
    const data = await r.json() as { text?: string };
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}
