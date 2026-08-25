import Anthropic from "@anthropic-ai/sdk";
import type { CaratulaExtraida } from "./types";

// Prompt de extracción. Como elegimos LLM, esto banca los dos formatos
// de carátula (texto suelto y tabla) sin reglas frágiles.
const PROMPT_EXTRACCION = `Sos un asistente que extrae datos de carátulas de siniestros de seguros argentinas.
Te paso un PDF de carátula (puede venir en formato de texto suelto o en tabla).
Devolvé SOLO un objeto JSON válido con esta forma exacta, sin texto adicional ni backticks.
Si un dato no aparece, poné null. Fechas en formato YYYY-MM-DD, horas en HH:MM.

{
  "nro_siniestro": null,
  "numero_gestion": null,
  "compania": null,
  "rama": null,
  "tipo": null,
  "poliza": null,
  "asegurado": null,
  "denunciante": null,
  "dni": null,
  "email_contacto": null,
  "tel_contacto": null,
  "cel_contacto": null,
  "tel": null,
  "domicilio": null,
  "estado_origen": null,
  "fecha_ingreso": null,
  "fecha_ocurrencia": null,
  "hora_ocurrencia": null,
  "fecha_denuncia": null,
  "lugar_siniestro": {
    "calle1": null, "altura1": null,
    "calle2": null, "altura2": null,
    "localidad": null, "provincia": null,
    "comisaria": null, "acta": null, "sumario": null
  }
}`;

/**
 * Extrae los datos de un PDF de carátula (base64) usando Claude.
 * @param pdfBase64 el PDF en base64 (sin el prefijo data:)
 */
export async function extraerCaratula(pdfBase64: string): Promise<CaratulaExtraida> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada.");
  }

  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: PROMPT_EXTRACCION },
        ],
      },
    ],
  });

  const texto = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  return JSON.parse(texto) as CaratulaExtraida;
}

// Prompt para el mail de derivación (el que manda la aseguradora avisando
// de un caso nuevo). Formato de texto libre con campos tipo "Siniestro:",
// "Reclamante:", etc. — se banca variaciones de redacción por ser LLM.
const PROMPT_MAIL = `Sos un asistente que extrae datos de mails de derivación de siniestros
que mandan las compañías de seguros para pedir una investigación.
Te paso el texto del mail (asunto + cuerpo). Puede traer campos como
Siniestro, Reclamo, Reclamante, Denunciante, Motivo, Código de Inspección,
Aseguradora, Póliza, Domicilio, Fecha del hecho, Lugar del hecho, etc. —
la redacción exacta varía según quién lo mande.

Devolvé SOLO un objeto JSON válido con esta forma exacta, sin texto
adicional ni backticks. Si un dato no aparece, poné null. Fechas en
formato YYYY-MM-DD, horas en HH:MM. Si hay datos del mail que no encajan
en ningún campo de este JSON (por ejemplo el "Motivo" del reclamo),
dejalos fuera — no inventes campos nuevos ni fuerces el dato en otro lugar.

{
  "nro_siniestro": null,
  "numero_gestion": null,
  "compania": null,
  "rama": null,
  "tipo": null,
  "poliza": null,
  "asegurado": null,
  "denunciante": null,
  "dni": null,
  "email_contacto": null,
  "tel_contacto": null,
  "cel_contacto": null,
  "tel": null,
  "domicilio": null,
  "estado_origen": null,
  "fecha_ingreso": null,
  "fecha_ocurrencia": null,
  "hora_ocurrencia": null,
  "fecha_denuncia": null,
  "lugar_siniestro": {
    "calle1": null, "altura1": null,
    "calle2": null, "altura2": null,
    "localidad": null, "provincia": null,
    "comisaria": null, "acta": null, "sumario": null
  }
}`;

/** Extrae los datos de un mail de derivación (texto plano) usando Claude. */
export async function extraerDeMail(texto: string): Promise<CaratulaExtraida> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      { role: "user", content: `${PROMPT_MAIL}\n\n--- MAIL ---\n${texto}` },
    ],
  });

  const salida = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  return JSON.parse(salida) as CaratulaExtraida;
}
