import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

// "Texto según la IA" de una prueba: transcribe lo que dice la imagen o el PDF
// (ampliación manuscrita, denuncia, formularios, capturas) para leerlo cómodo
// al lado del visor. Se guarda: la segunda vez aparece al instante.

let asegurada = false;
export async function asegurarTablaTranscripcion() {
  if (asegurada) return;
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS evidencia_transcripcion (
      evidencia_id uuid PRIMARY KEY,
      texto text NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT now()
    )`);
  asegurada = true;
}

export async function leerTranscripcion(evidenciaId: string): Promise<{ texto: string; creado_en: string } | null> {
  await asegurarTablaTranscripcion();
  const r = await getDb().execute(sql`SELECT texto, creado_en FROM evidencia_transcripcion WHERE evidencia_id = ${evidenciaId}`);
  return (r.rows as { texto: string; creado_en: string }[])[0] ?? null;
}

const SISTEMA = `Transcribís pruebas de un expediente de siniestro de seguros (Argentina) para que el administrador las lea
cómodo. Te paso una imagen o un PDF: una ampliación o declaración manuscrita, una denuncia policial, un formulario,
un documento o una captura de pantalla.
- Transcribí TODO el texto, fiel, en el mismo orden, respetando párrafos y renglones importantes. No resumas ni corrijas
  lo que dice (sí podés arreglar la ortografía evidente de una palabra mal escrita a mano si no cambia el sentido).
- Lo que no se entiende, marcalo [ilegible]; si dudás de una palabra, poné la más probable seguida de (?).
- Formularios: "Campo: valor", un campo por renglón. Tablas: una fila por renglón.
- Firmas, sellos y fotos: indicalo entre corchetes, ej. [firma], [sello de la comisaría], [foto del DNI].
- Capturas de celular: transcribí lo que se lee (mensajes con quién los manda y la hora, ubicaciones, fechas).
- Si no hay texto para leer, describí en una línea qué muestra la imagen.
Devolvé solo la transcripción, sin comentarios antes ni después.`;

export async function transcribirPrueba(bytes: Buffer, tipo: string, nombre: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  const mime = tipo === "application/pdf" || ext === "pdf" ? "application/pdf"
    : ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(tipo) ? tipo
    : ["jpg", "jpeg", "jfif"].includes(ext) ? "image/jpeg" : ext === "png" ? "image/png" : null;
  if (!mime) throw new Error("Este tipo de archivo no se puede leer con IA.");
  const data = bytes.toString("base64");
  const bloque: Anthropic.Beta.BetaContentBlockParam = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mime as "image/jpeg", data } };
  const msg = await new Anthropic({ apiKey }).beta.messages.stream({
    model: "claude-sonnet-5-5",
    max_tokens: 32000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA,
    messages: [{ role: "user", content: [bloque, { type: "text", text: `Archivo: "${nombre}". Transcribilo.` }] }],
  }).finalMessage();
  const texto = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("").trim();
  if (!texto) throw new Error("La IA no pudo leer esta prueba.");
  return texto;
}
