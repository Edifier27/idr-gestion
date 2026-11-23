import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS_EVIDENCIA } from "./categorias-evidencia";

const VALORES = CATEGORIAS_EVIDENCIA.map(c => c.value);

const PROMPT = `Mirá este archivo, subido como evidencia de un siniestro de seguro, y decime a
cuál de estas categorías corresponde. Respondé SOLO con el valor exacto (una palabra, en
minúsculas, sin explicación ni puntuación):

- denuncia: denuncia policial o administrativa (acta, constancia, exposición, denuncia de choque o incendio)
- ampliacion: declaración manuscrita o firmada del asegurado ampliando el relato del hecho
- foto_lugar: foto del domicilio o del lugar del hecho (la escena, la calle, la fachada — no el vehículo)
- foto_siniestro: inspección del vehículo: fotos del vehículo o bien siniestrado, sus daños, su patente
- dni: DNI del asegurado
- dni_conductor: DNI de otra persona que manejaba (el conductor, si no es el asegurado)
- registro_conducir: registro/licencia de conducir
- cedula_vehiculo: cédula verde o azul del vehículo
- geolocalizacion: captura de mapa, ubicación GPS o historial de ubicaciones
- llamadas: captura de registro/historial de llamadas telefónicas
- mensajes: captura de chats o conversaciones sobre el hecho (WhatsApp u otra app)
- palabras_clave: captura de una búsqueda dentro de WhatsApp (filtro por palabra clave, resultados de búsqueda)
- foto_momento: foto tomada en el momento del hecho (el choque, el incendio, el vidrio roto recién)
- foto_previa: foto del vehículo de antes del hecho (sano, en uso normal)
- llave: foto de las llaves del vehículo
- vtv: oblea, certificado o comprobante de VTV
- recibo_sueldo: recibo de sueldo
- desiste: documento de desistimiento del siniestro, firmado
- fotos: cualquier otra foto que no encaje en las anteriores
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
