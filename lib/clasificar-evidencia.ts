import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS_EVIDENCIA } from "./categorias-evidencia";

const VALORES = CATEGORIAS_EVIDENCIA.map(c => c.value);

const PROMPT = `Mirá este archivo, subido como evidencia de un siniestro de seguro, y decime a
cuál de estas categorías corresponde. Respondé SOLO con el valor exacto (una palabra, en
minúsculas, sin explicación ni puntuación):

- dni: DNI o cédula de identidad del asegurado
- registro_conducir: registro/licencia de conducir
- cedula_vehiculo: cédula verde o azul del vehículo
- denuncia: denuncia policial o ciudadana (acta, constancia, exposición)
- ampliacion: declaración manuscrita o firmada del asegurado ampliando el relato del hecho
- desiste: documento de desistimiento del siniestro, firmado
- geolocalizacion: captura de mapa o ubicación GPS
- llamadas: captura de registro/historial de llamadas telefónicas
- mensajes: captura de chats o conversaciones (WhatsApp u otra app de mensajería)
- foto_siniestro: foto del vehículo o bien siniestrado (el objeto asegurado en sí: la moto, el auto, sus daños, su patente)
- foto_lugar: foto del lugar del hecho (la escena, la calle, el domicilio, el punto de encuentro — no el vehículo)
- fotos: cualquier otra foto que no sea del vehículo ni del lugar (capturas de pantalla sueltas, etc.)
- otro: si no encaja claramente en ninguna de las anteriores

Respondé solo con uno de estos valores: ${VALORES.join(", ")}`;

// Clasifica automáticamente un archivo de evidencia (foto o PDF) en una de
// las categorías de CATEGORIAS_EVIDENCIA, usando IA — para cuando el
// operador no elige categoría al subir, y así el expediente igual se arma
// en el orden correcto (lib/pdf.ts agrupa por categoría, no por orden de
// carga). Devuelve null si no se puede clasificar (sin API key, tipo de
// archivo no soportado, o cualquier error) — nunca tira, para no romper la
// subida por esto.
export async function clasificarEvidencia(bytes: Uint8Array, tipo: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let contenido: Anthropic.Messages.ContentBlockParam[];
  const base64 = Buffer.from(bytes).toString("base64");
  if (tipo === "application/pdf") {
    contenido = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: PROMPT },
    ];
  } else if (tipo === "image/jpeg" || tipo === "image/png" || tipo === "image/webp" || tipo === "image/gif") {
    contenido = [
      { type: "image", source: { type: "base64", media_type: tipo, data: base64 } },
      { type: "text", text: PROMPT },
    ];
  } else {
    return null; // tipo no soportado para clasificar por contenido (ej. .docx)
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 20,
      messages: [{ role: "user", content: contenido }],
    });
    const texto = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim()
      .toLowerCase();
    return (VALORES as readonly string[]).includes(texto) ? texto : null;
  } catch {
    return null;
  }
}
