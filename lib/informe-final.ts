import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, datoExtra, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { etiquetaCategoriaEvidencia, ramoDeTipo } from "@/lib/categorias-evidencia";
import type { LecturaDenuncia } from "@/lib/leer-denuncia";
import { INFORMES_MODELO } from "@/lib/informe-modelo";

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
- Coherencia en la secuencia temporal, validación del uso declarado y puntos provisorios acreditados.
- Mirá TODAS las pruebas, pero en el informe nombrá solo las que acreditan o contradicen algo del relato, en
  una línea cada una ("Archivo N": qué acredita o qué contradice). No describas foto por foto ni las que no aportan.

4. PUNTOS DE AUDITORÍA Y ESTADO DE COBERTURA (PUNTOS CRÍTICOS)
- Oportunidad en la denuncia (Art. 46 Ley 17.418), consistencia del cuadro probatorio, indicadores de fraude
  (presentes o inexistentes, con su fundamento).

5. CONCLUSIÓN Y SUGERENCIA DE PROCESAMIENTO
Párrafo de conclusión y la sugerencia al Área de Liquidaciones en MAYÚSCULAS (continuidad del trámite,
rechazo, ampliación de investigación, etc.).

LARGO: como el ejemplo de abajo. Entre 450 y 750 palabras en total, sin contar el encabezado. Frases cortas, sin
repetir lo mismo en varias secciones. Si hay mucho para decir, priorizá lo que cambia la decisión.

Reglas: español rioplatense formal y técnico, como el de un informe pericial. No inventes datos: lo que no
surja de lo que te paso no va, o se indica "no surge de la documentación". Si hay contradicciones, decilas sin
rodeos y con la prueba que las muestra. No agregues nada antes ni después del informe.

EJEMPLO DE UN INFORME REAL DEL ESTUDIO (así se envía: copiá el formato, el tono y el largo, no los datos):

${INFORMES_MODELO.join("\n\n— OTRO EJEMPLO —\n\n")}`;

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_ARCHIVOS = 20;
const MAX_BYTES = 18 * 1024 * 1024; // margen bajo el límite de 32 MB por pedido (base64 suma ~33%)

export async function generarInformeFinal(
  s: SiniestroRow, notas: string[], lectura: LecturaDenuncia | null,
  // Avisa en qué paso está (para mostrarlo mientras trabaja); forzar = cambio de etapa.
  paso: (texto: string, forzar?: boolean) => void = () => {},
): Promise<string> {
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
  let bajadas = 0;
  for (const f of filas) {
    paso(`Bajando las pruebas (${++bajadas} de ${filas.length})`);
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
    const vistas = bloques.filter(b => b.type === "image" || b.type === "document").length;
    paso(vistas ? `La IA está analizando las ${vistas} pruebas` : "La IA está analizando el caso", true);
    let palabras = 0;
    const mensajes: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: bloques as Anthropic.Beta.BetaContentBlockParam[] }];
    const partes: string[] = [];
    // Si se queda sin espacio (stop_reason "max_tokens", stro 160924 salió
    // cortado), se le pide que siga desde donde quedó, hasta 2 veces.
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const stream = client.beta.messages.stream({
        model: "claude-sonnet-5-5",
        max_tokens: 64000,
        output_config: { effort: "high" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SISTEMA,
        messages: mensajes,
      });
      stream.on("text", (delta) => {
        palabras += delta.split(/\s+/).filter(Boolean).length;
        paso(`Redactando el informe · ${palabras} palabras${vuelta ? " (continuando)" : ""}`);
      });
      const msg = await stream.finalMessage();
      const texto = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("");
      if (msg.stop_reason === "refusal" || (!texto.trim() && !partes.length)) {
        console.error("informe-final sin texto", { siniestro: s.nroSiniestro, stop_reason: msg.stop_reason, stop_details: msg.stop_details, usage: msg.usage });
        return partes.length ? partes.join("").trim() : null;
      }
      partes.push(texto);
      if (msg.stop_reason !== "max_tokens") return partes.join("").trim();
      console.error("informe-final cortado por max_tokens, continúa", { siniestro: s.nroSiniestro, vuelta, usage: msg.usage });
      paso("El informe es largo: la IA sigue desde donde quedó", true);
      mensajes.push({ role: "assistant", content: msg.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
      mensajes.push({ role: "user", content: "Te quedaste sin espacio. Seguí el informe exactamente desde la última palabra que escribiste, sin repetir nada ni agregar introducción." });
    }
    return `${partes.join("").trim()}\n\n[El informe quedó incompleto: regeneralo o completalo a mano.]`;
  }

  const conTodo = [...contenido, { type: "text" as const, text: pedido }];
  const sinImagenes = [...contenido.filter(b => b.type !== "image"), { type: "text" as const, text: `${pedido}\n\n(Las fotos no se pudieron analizar en esta pasada: no hagas el peritaje de imágenes, indicá que quedan para revisión manual.)` }];
  const soloTexto = [{ type: "text" as const, text: `${pedido}\n\n(Los archivos de prueba no se pudieron analizar en esta pasada: indicá que el peritaje de las pruebas queda para revisión manual.)` }];

  let texto = await pedir(conTodo);
  if (!texto && contenido.some(b => b.type === "image")) { paso("Reintentando sin las fotos", true); texto = await pedir(sinImagenes); }
  if (!texto) { paso("Reintentando solo con el texto del caso", true); texto = await pedir(soloTexto); }
  paso("Guardando el informe", true);
  if (!texto) throw new Error("La IA no pudo redactar el informe de este caso. Avisanos y lo revisamos.");
  return texto;
}

// Informe resumido: lo que el administrador necesita para decidir en 20
// segundos, con los mismos puntos críticos del informe modelo (stro 571673,
// secciones 4 y 5), sacado SOLO del informe completo (no agrega datos).
export type ResumenInforme = {
  veredicto: "verosimil" | "dudoso" | "no_verosimil";
  confianza: "alta" | "media" | "baja";
  conclusion: string;
  criticos: { oportunidad: string; consistencia: string; fraude: string };
  a_favor: string[];
  en_contra: string[];
  faltan: string[];
  sugerencia: "continuidad" | "rechazo" | "ampliar";
  sugerencia_texto: string;
};

const SISTEMA_RESUMEN = `Sos perito liquidador de siniestros. Te paso un informe de investigación completo. Resumilo para el
administrador del estudio, que tiene que decidir rápido si el siniestro es verídico. Devolvé SOLO un JSON válido:
{
  "veredicto": "verosimil" | "dudoso" | "no_verosimil"  (¿el siniestro, como fue denunciado, es creíble según las pruebas?),
  "confianza": "alta" | "media" | "baja"  (qué tan sólido es ese veredicto con lo que hay),
  "conclusion": "una sola frase, directa",
  "criticos": {
    "oportunidad": "oportunidad de la denuncia (Art. 46 Ley 17.418): en término o tardía, en una frase",
    "consistencia": "consistencia del cuadro probatorio: qué coincide y qué no, en una frase",
    "fraude": "indicadores de fraude: presentes (cuáles) o no surgen, en una frase"
  },
  "a_favor": ["hasta 5 puntos que respaldan el relato, cada uno con la prueba que lo muestra (ej. 'Archivo 3')"],
  "en_contra": ["hasta 5 inconsistencias o indicios de fraude, cada uno con la prueba que lo muestra"],
  "faltan": ["hasta 4 pruebas o datos que faltan para cerrar"],
  "sugerencia": "continuidad" | "rechazo" | "ampliar"  (la sugerencia al Área de Liquidaciones del informe),
  "sugerencia_texto": "la sugerencia en una frase, con su condición si la tiene"
}
Cada punto en menos de 20 palabras. No agregues nada que no diga el informe. Español rioplatense.`;

export async function resumirInforme(informe: string): Promise<ResumenInforme> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const msg = await new Anthropic({ apiKey }).beta.messages.stream({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA_RESUMEN,
    messages: [{ role: "user", content: informe }],
  }).finalMessage();
  const t = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("");
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as Partial<ResumenInforme>;
  const lista = (x: unknown, n: number) => (Array.isArray(x) ? x.slice(0, n).map(String) : []);
  return {
    veredicto: j.veredicto && ["verosimil", "dudoso", "no_verosimil"].includes(j.veredicto) ? j.veredicto : "dudoso",
    confianza: j.confianza && ["alta", "media", "baja"].includes(j.confianza) ? j.confianza : "media",
    conclusion: String(j.conclusion ?? ""),
    criticos: { oportunidad: String(j.criticos?.oportunidad ?? ""), consistencia: String(j.criticos?.consistencia ?? ""), fraude: String(j.criticos?.fraude ?? "") },
    a_favor: lista(j.a_favor, 5),
    en_contra: lista(j.en_contra, 5),
    faltan: lista(j.faltan, 4),
    sugerencia: j.sugerencia && ["continuidad", "rechazo", "ampliar"].includes(j.sugerencia) ? j.sugerencia : "ampliar",
    sugerencia_texto: String(j.sugerencia_texto ?? ""),
  };
}
