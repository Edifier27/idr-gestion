import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, datoExtra, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { etiquetaCategoriaEvidencia, ramoDeTipo } from "@/lib/categorias-evidencia";
import type { LecturaDenuncia } from "@/lib/leer-denuncia";

// Informe de investigación final, con la estructura del informe real que
// mandó Dario (Stro 571673, ATM): encabezado con el tipo de cobertura, marco
// legal (Ley 17.418 art. 46), 1) datos del asegurado, 2) circunstancias de
// tiempo, lugar y modo, 3) auditoría técnica e inspección probatoria (acá va
// el peritaje de cada imagen, que la IA mira una por una), 4) puntos de
// auditoría y estado de cobertura, 5) conclusión y sugerencia. Es un
// BORRADOR: lo revisa y lo firma el administrador.

const SISTEMA = `Sos perito liquidador de siniestros de seguros en Argentina con experiencia en detección de fraude.
Redactás el INFORME DE INVESTIGACIÓN DE SINIESTRO que el estudio le manda a la aseguradora, con este formato
exacto (texto plano, títulos en MAYÚSCULAS, viñetas con "- "):

INFORME DE INVESTIGACIÓN DE SINIESTRO
ACTA DE DECLARACIÓN / VERIFICACIÓN DE HECHOS — COBERTURA DE <RIESGO EN MAYÚSCULAS> (<DESCRIPCIÓN CORTA DEL HECHO Y DE LO QUE SE VALIDÓ>)
DATOS DEL SINIESTRO: Siniestro N° <número>
COMPAÑÍA ASEGURADORA: <compañía>
MARCO LEGAL APLICABLE: El presente documento compendia la declaración sumaria, investigación circunstanciada y verificación de riesgo formulada en el marco de la Ley de Seguros N° 17.418 (Art. 46 - Obligación de Suministrar Información), incorporándose al expediente de liquidación para la validación de cobertura y posterior tramitación del reclamo indemnizatorio.

1. DATOS PERSONALES DEL ASEGURADO
- Asegurado, domicilio declarado, ocupación / actividad, destino / uso del rodado (si consta).

2. CIRCUNSTANCIAS DE TIEMPO, LUGAR Y MODO (RELATO DEL ASEGURADO)
Reconstrucción cronológica, por día y con subtítulos cortos, a partir de la ampliación, la denuncia y la
entrevista del operador. Horarios, recorridos, lugares, personas y teléfonos que se mencionen.

3. AUDITORÍA TÉCNICA DE RIESGO E INSPECCIÓN PROBATORIA
- Coherencia de la secuencia temporal, validación del uso declarado, puntos acreditados.
- PERITAJE DE LAS PRUEBAS: una viñeta por imagen o documento que te paso ("Archivo N"), diciendo qué muestra,
  qué acredita o qué contradice del relato, y cualquier señal de alteración, fecha/hora visible, ubicación,
  daño viejo, incoherencia con el lugar o con lo denunciado. Si una imagen no aporta, decilo en pocas palabras.

4. PUNTOS DE AUDITORÍA Y ESTADO DE COBERTURA (PUNTOS CRÍTICOS)
- Oportunidad en la denuncia (Art. 46 Ley 17.418), consistencia del cuadro probatorio, indicadores de fraude
  (presentes o inexistentes, con su fundamento).

5. CONCLUSIÓN Y SUGERENCIA DE PROCESAMIENTO
Párrafo de conclusión y la sugerencia al Área de Liquidaciones en MAYÚSCULAS (continuidad del trámite,
rechazo, ampliación de investigación, etc.).

Reglas: español rioplatense formal y técnico, como el de un informe pericial. No inventes datos: lo que no
surja de lo que te paso no va, o se indica "no surge de la documentación". Si hay contradicciones, decilas sin
rodeos y con la prueba que las muestra. No agregues nada antes ni después del informe.`;

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_ARCHIVOS = 20;
const MAX_BYTES = 18 * 1024 * 1024; // margen bajo el límite de 32 MB por pedido (base64 suma ~33%)

export async function generarInformeFinal(s: SiniestroRow, notas: string[], lectura: LecturaDenuncia | null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const db = getDb();
  await asegurarTablaEvidencia();
  await asegurarTablaDatoExtra();
  const filas = await db.select().from(evidencia).where(eq(evidencia.siniestroId, s.id)).orderBy(asc(evidencia.creadoEn));
  const extras = await db.select().from(datoExtra).where(eq(datoExtra.siniestroId, s.id));
  const ramo = ramoDeTipo(s.tipo);

  // Las pruebas en sí, para que la IA las mire (fotos y PDF), hasta un tope
  // de cantidad y peso; lo que no entra se lista por nombre.
  const contenido: Anthropic.Messages.ContentBlockParam[] = [];
  const noVistos: string[] = [];
  let bytes = 0, n = 0;
  for (const f of filas) {
    const legible = TIPOS_IMAGEN.includes(f.tipo) || f.tipo === "application/pdf";
    if (!legible || n >= MAX_ARCHIVOS || (f.tipo !== "application/pdf" && (f.tamano ?? 0) > 5 * 1024 * 1024)) { noVistos.push(f.nombre); continue; }
    try {
      const r = await fetch(f.url);
      if (!r.ok) { noVistos.push(f.nombre); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (bytes + buf.length > MAX_BYTES) { noVistos.push(f.nombre); continue; }
      bytes += buf.length; n++;
      contenido.push({ type: "text", text: `Archivo ${n} — "${f.nombre}" — categoría: ${etiquetaCategoriaEvidencia(f.categoria, ramo)}` });
      const data = buf.toString("base64");
      if (f.tipo === "application/pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else contenido.push({ type: "image", source: { type: "base64", media_type: f.tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } });
    } catch {
      noVistos.push(f.nombre);
    }
  }

  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
  const datos = {
    siniestro: s.nroSiniestro, gestion: s.numeroGestion, compania: s.compania, rama: s.rama, tipo: s.tipo, poliza: s.poliza,
    asegurado: s.asegurado, dni: s.dni, domicilio: s.domicilio, telefono: s.telContacto ?? s.celContacto,
    fechaOcurrencia: s.fechaOcurrencia, horaOcurrencia: s.horaOcurrencia, fechaDenuncia: s.fechaDenuncia,
    lugarHecho: [lugar.calle1, lugar.altura1, lugar.calle2, lugar.localidad, lugar.provincia].filter(Boolean).join(" "),
    datosAdicionales: Object.fromEntries(extras.map(e => [e.etiqueta, e.valor])),
    relatoDenuncia: s.relatoDenuncia,
    ampliacionAsegurado: lectura?.ampliacion ?? null,
    denunciaPolicial: lectura?.denuncia ?? null,
    denunciaVsSiniestro: lectura ? { cotejo: lectura.cotejo, alertas: lectura.alertas } : null,
    descargoOperador: s.descargo,
    cotejoTecnico: s.informe,
    resultadoCargado: s.resultado,
    bitacora: notas,
    archivosNoVistos: noVistos,
  };

  const pedido = `Datos del caso:\n${JSON.stringify(datos, null, 2)}\n\nRedactá el informe.`;
  const client = new Anthropic({ apiKey });

  // Con muchas pruebas el modelo piensa largo antes de escribir: con poco
  // max_tokens se gastaba todo pensando y el informe salía vacío (stro 160924).
  // Además, si el filtro de seguridad rechaza alguna prueba (stop_reason
  // "refusal"), se pasa a otro modelo ("fallbacks") y, si igual no sale, se
  // reintenta sin las imágenes y, por último, solo con el texto del caso.
  async function pedir(bloques: Anthropic.Messages.ContentBlockParam[]) {
    const msg = await client.beta.messages.stream({
      model: "claude-sonnet-5-5",
      max_tokens: 32000,
      output_config: { effort: "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [{ role: "user", content: bloques as Anthropic.Beta.BetaContentBlockParam[] }],
    }).finalMessage();
    const texto = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("").trim();
    if (!texto || msg.stop_reason === "refusal") {
      console.error("informe-final sin texto", { siniestro: s.nroSiniestro, stop_reason: msg.stop_reason, stop_details: msg.stop_details, usage: msg.usage });
      return null;
    }
    return texto;
  }

  const conTodo = [...contenido, { type: "text" as const, text: pedido }];
  const sinImagenes = [...contenido.filter(b => b.type !== "image"), { type: "text" as const, text: `${pedido}\n\n(Las fotos no se pudieron analizar en esta pasada: no hagas el peritaje de imágenes, indicá que quedan para revisión manual.)` }];
  const soloTexto = [{ type: "text" as const, text: `${pedido}\n\n(Los archivos de prueba no se pudieron analizar en esta pasada: indicá que el peritaje de las pruebas queda para revisión manual.)` }];

  const texto = (await pedir(conTodo))
    ?? (contenido.some(b => b.type === "image") ? await pedir(sinImagenes) : null)
    ?? await pedir(soloTexto);
  if (!texto) throw new Error("La IA no pudo redactar el informe de este caso. Avisanos y lo revisamos.");
  return texto;
}
