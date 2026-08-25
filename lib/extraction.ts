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
