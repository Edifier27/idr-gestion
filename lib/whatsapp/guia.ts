import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bitacora } from "@/lib/db/schema";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente } from "@/lib/categorias-evidencia";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { generarResumenCaso } from "@/lib/resumen-caso";
import { responder } from "@/lib/whatsapp/asignar";
import { etiquetaRubro, rubroDeTipo } from "@/lib/tipos-siniestro";

// Perito IA que guía al operador por WhatsApp (como el asesor IA de
// AsesorCRM). No contesta foto por foto: espera a que el operador termine de
// mandar la tanda (PAUSA sin mensajes nuevos, o un "listo" / "terminé"), y
// recién ahí mira lo que llegó como perito —las fotos y documentos de la
// tanda, más todo lo que ya tiene el caso— y le escribe UN mensaje por caso:
// qué recibió, qué observa, qué falta y qué preguntar. El comentario también
// queda en el chat del caso (bitácora) para el administrador.

export const AUTOR_PERITO = "Perito IA";
const PAUSA_MS = Number(process.env.WA_GUIA_PAUSA_S ?? 75) * 1000;
const FIN_TANDA = /\b(listo|termin[eé]|eso es todo|es todo|ya (te )?mand[eé] todo|nada m[aá]s|fin)\b/i;
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_ARCHIVOS = 10;
const MAX_BYTES = 14 * 1024 * 1024;

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

type Entrante = {
  id: string; creado_en: string; texto: string | null; transcripcion: string | null; media_url: string | null;
  media_mime: string | null; media_nombre: string | null; siniestro_id: string | null; categoria: string | null; asignacion: string | null;
};

async function ultimoEntrante(conversacionId: string) {
  const r = await getDb().execute(sql`
    SELECT id, creado_en, COALESCE(texto, transcripcion) AS texto FROM wa_mensaje
    WHERE conversacion_id = ${conversacionId} AND direccion = 'entrante' ORDER BY creado_en DESC LIMIT 1`);
  return (r.rows as { id: string; creado_en: string; texto: string | null }[])[0] ?? null;
}

/** Se llama después de procesar lo que mandó el operador. Si en la pausa llega
 *  algo más, se corta (lo retoma la ejecución del mensaje más nuevo). */
export async function guiarTrasPausa(conversacionId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  await asegurarTablasWhatsapp();
  const visto = await ultimoEntrante(conversacionId);
  if (!visto) return;
  await esperar(visto.texto && FIN_TANDA.test(visto.texto) ? 3000 : PAUSA_MS);
  const ahora = await ultimoEntrante(conversacionId);
  if (!ahora || ahora.id !== visto.id) return; // siguió mandando cosas
  // Si alguna prueba de la tanda todavía se está ubicando, se espera un poco.
  for (let i = 0; i < 6; i++) {
    const p = await getDb().execute(sql`SELECT 1 FROM wa_mensaje WHERE conversacion_id = ${conversacionId} AND asignacion = 'pendiente' LIMIT 1`);
    if (!p.rows.length) break;
    await esperar(5000);
  }
  await guiarTanda(conversacionId);
}

export async function guiarTanda(conversacionId: string) {
  const db = getDb();
  // Se toma la tanda de forma atómica: dos ejecuciones a la vez no guían dos veces.
  const tomada = await db.execute(sql`
    WITH previa AS (SELECT guia_en FROM wa_conversacion WHERE id = ${conversacionId})
    UPDATE wa_conversacion SET guia_en = now()
    WHERE id = ${conversacionId}
      AND (guia_en IS NULL OR guia_en < (SELECT max(creado_en) FROM wa_mensaje WHERE conversacion_id = ${conversacionId} AND direccion = 'entrante'))
    RETURNING telefono, operador, (SELECT guia_en FROM previa) AS desde`);
  const conv = (tomada.rows as { telefono: string; operador: string | null; desde: string | null }[])[0];
  if (!conv || !conv.operador) return;
  const desde = conv.desde ? new Date(conv.desde) : new Date(Date.now() - 6 * 3600_000);

  const tanda = (await db.execute(sql`
    SELECT id, creado_en, texto, transcripcion, media_url, media_mime, media_nombre, siniestro_id, categoria, asignacion
    FROM wa_mensaje WHERE conversacion_id = ${conversacionId} AND direccion = 'entrante' AND creado_en > ${desde.toISOString()}
    ORDER BY creado_en LIMIT 80`)).rows as Entrante[];
  if (!tanda.some(m => m.media_url)) return; // solo charla: no hay nada que peritar

  const porCaso = new Map<string, Entrante[]>();
  for (const m of tanda) if (m.siniestro_id) porCaso.set(m.siniestro_id, [...(porCaso.get(m.siniestro_id) ?? []), m]);
  // Los textos/audios sueltos de la tanda (sin caso) también le sirven de contexto a cada caso.
  const sueltos = tanda.filter(m => !m.siniestro_id && !m.media_url).map(m => m.transcripcion ? `(audio) ${m.transcripcion}` : m.texto ?? "").filter(Boolean);
  const sinUbicar = tanda.filter(m => m.media_url && (m.asignacion === "sin_asignar" || m.asignacion === "pregunta")).length;

  const partes: string[] = [];
  for (const [siniestroId, mensajes] of Array.from(porCaso.entries()).slice(0, 3)) {
    try {
      const r = await peritarCaso(siniestroId, mensajes, sueltos);
      if (!r) continue;
      partes.push(r.mensaje_operador);
      await db.insert(bitacora).values({
        siniestroId, tipo: "nota", autor: AUTOR_PERITO, autorEsAdmin: true, leida: false,
        nota: `🤖 Perito IA (tanda de WhatsApp de ${conv.operador}):\n${r.comentario_admin}${r.faltan.length ? `\n\nFalta: ${r.faltan.join("; ")}` : ""}`,
      });
      // La ficha del caso (resumen y segmento) queda al día con lo nuevo.
      generarResumenCaso(siniestroId).catch(() => {});
    } catch { /* un caso que falla no frena a los demás */ }
  }
  if (sinUbicar) partes.push(`📎 Quedan ${sinUbicar} archivo${sinUbicar > 1 ? "s" : ""} sin ubicar: decime de qué caso ${sinUbicar > 1 ? "son" : "es"} (apellido o N° de siniestro).`);
  if (!partes.length) return;
  await responder(conversacionId, conv.telefono, partes.join("\n\n———\n\n"), AUTOR_PERITO);
}

type Peritaje = { mensaje_operador: string; comentario_admin: string; faltan: string[]; completo: boolean };

const SISTEMA = `Sos perito liquidador de siniestros en Argentina y guiás por WhatsApp a un operador que investiga en la calle.
El operador terminó de mandarte una tanda de pruebas de un caso. Miralas UNA POR UNA como perito: qué muestran,
si sirven, si están bien sacadas (legibles, completas, con fecha/patente/numeración visible), si coinciden con lo
denunciado y con el lugar, y si hay señales de alteración, daño viejo o inconsistencias.
Lo que se pide adjuntar depende del RUBRO del caso (pruebasDelRamoQueFaltan): pedí eso, no pruebas de otro rubro.
Después decile qué falta para cerrar la investigación, en orden de importancia, y qué preguntar en la entrevista.

Devolvé SOLO un JSON:
{
  "mensaje_operador": "mensaje de WhatsApp para el operador: arranca con '🗂️ <apellido> #<siniestro>', una línea de lo recibido, luego 'Observaciones:' con viñetas cortas (máx. 4), 'Falta:' con viñetas (máx. 6) y, si corresponde, 'Preguntale:' (máx. 3). Tono de compañero, claro, sin rodeos. Máximo 900 caracteres. Si el caso ya está completo, felicitalo y decile que suba el descargo/informe.",
  "comentario_admin": "3 a 6 líneas para el administrador: lo que acreditan las pruebas nuevas, lo que llama la atención y el estado del caso",
  "faltan": ["lista corta de lo que falta"],
  "completo": true | false
}
Usá formato de WhatsApp (*negrita* para los títulos, '• ' para viñetas). No inventes datos.`;

async function peritarCaso(siniestroId: string, mensajes: Entrante[], sueltos: string[]): Promise<Peritaje | null> {
  const db = getDb();
  const r = await db.execute(sql`SELECT * FROM siniestros WHERE id = ${siniestroId}`);
  const s = (r.rows as Record<string, unknown>[])[0];
  if (!s) return null;
  const tipo = (s.tipo as string | null) ?? null;
  const ramo = ramoDeTipo(tipo);
  const ev = (await db.execute(sql`SELECT nombre, categoria FROM evidencia WHERE siniestro_id = ${siniestroId}`)).rows as { nombre: string; categoria: string | null }[];
  const tiene = new Set(ev.map(e => e.categoria).filter(Boolean) as string[]);
  const pedidas = seccionesExpediente(ramo).filter(x => x.id !== "otros" && x.id !== "lugar").flatMap(x => x.categorias);
  const lectura = await leerLecturaDenuncia(siniestroId).catch(() => null);
  const lugar = (s.lugar_siniestro ?? {}) as Record<string, string>;

  const contenido: Anthropic.Messages.ContentBlockParam[] = [];
  let bytes = 0, n = 0;
  const noVistos: string[] = [];
  for (const m of mensajes) {
    if (!m.media_url) continue;
    const legible = m.media_mime && (TIPOS_IMAGEN.includes(m.media_mime) || m.media_mime === "application/pdf");
    if (!legible || n >= MAX_ARCHIVOS) { noVistos.push(m.media_nombre ?? "archivo"); continue; }
    try {
      const f = await fetch(m.media_url);
      if (!f.ok) { noVistos.push(m.media_nombre ?? "archivo"); continue; }
      const buf = Buffer.from(await f.arrayBuffer());
      if (bytes + buf.length > MAX_BYTES) { noVistos.push(m.media_nombre ?? "archivo"); continue; }
      bytes += buf.length; n++;
      contenido.push({ type: "text", text: `Prueba ${n} — "${m.media_nombre}" — ${etiquetaCategoriaEvidencia(m.categoria, ramo)}${m.texto ? ` — el operador escribió: "${m.texto}"` : ""}` });
      const data = buf.toString("base64");
      if (m.media_mime === "application/pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else contenido.push({ type: "image", source: { type: "base64", media_type: m.media_mime as "image/jpeg", data } });
    } catch { noVistos.push(m.media_nombre ?? "archivo"); }
  }
  const datos = {
    siniestro: s.nro_siniestro, tipo, rubro: etiquetaRubro(rubroDeTipo(tipo)), asegurado: s.asegurado ?? s.denunciante, dni: s.dni, domicilio: s.domicilio,
    lugarHecho: [lugar.calle1, lugar.altura1, lugar.localidad].filter(Boolean).join(" "),
    fechaOcurrencia: s.fecha_ocurrencia, horaOcurrencia: s.hora_ocurrencia, vencimiento: s.fecha_limite,
    relatoDenuncia: s.relato_denuncia, denunciaVsSiniestro: lectura ? { cotejo: lectura.cotejo, alertas: lectura.alertas } : null,
    descargoOperador: s.descargo,
    pruebasQueYaTieneElCaso: ev.map(e => `${etiquetaCategoriaEvidencia(e.categoria, ramo)}: ${e.nombre}`),
    pruebasDelRamoQueFaltan: pedidas.filter(c => !tiene.has(c)).map(c => etiquetaCategoriaEvidencia(c, ramo)),
    loQueEscribioOHabloElOperador: [
      ...mensajes.filter(m => !m.media_url).map(m => m.transcripcion ? `(audio) ${m.transcripcion}` : m.texto ?? ""),
      ...mensajes.filter(m => m.transcripcion && m.media_url).map(m => `(audio) ${m.transcripcion}`),
      ...sueltos,
    ].filter(Boolean),
    archivosQueNoPudisteVer: noVistos,
  };
  contenido.push({ type: "text", text: `Datos del caso:\n${JSON.stringify(datos, null, 1)}\n\nPeritá la tanda y armá la guía.` });

  const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
    model: "claude-sonnet-5-5", max_tokens: 1800, system: SISTEMA, messages: [{ role: "user", content: contenido }],
  });
  const t = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
  try {
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as Peritaje;
    if (!j.mensaje_operador) return null;
    return {
      mensaje_operador: String(j.mensaje_operador).slice(0, 1500),
      comentario_admin: String(j.comentario_admin ?? ""),
      faltan: Array.isArray(j.faltan) ? j.faltan.slice(0, 10).map(String) : [],
      completo: !!j.completo,
    };
  } catch { return null; }
}
