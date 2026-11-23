import Anthropic from "@anthropic-ai/sdk";
import { eq, or, sql } from "drizzle-orm";
import { put } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { bitacora, evidencia, siniestros, usuarios } from "@/lib/db/schema";
import { listarConexiones, listarIdsDesde, obtenerMensaje, obtenerAdjunto } from "@/lib/gmail";
import { extraerCaratula, extraerDeMail } from "@/lib/extraction";
import { esPdf } from "@/lib/adjuntos";
import { crearSiniestro } from "@/lib/siniestros";
import { avisarAsignacion } from "@/lib/aviso-asignacion";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarColumnaGmailMensajeId } from "@/lib/db/asegurar-gmail-mensaje-id";
import { asegurarTablasGmail } from "@/lib/db/asegurar-gmail";

// Lectura automática del mail (cron cada 2 minutos): cada mail nuevo de las
// casillas conectadas se revisa UNA vez. Si es un caso (trae la carátula en
// PDF o los datos del siniestro en el cuerpo), se sube como legajo con todos
// sus adjuntos y se le asigna al operador (el dueño de la casilla, o por zona
// con IA). Lo que no es un caso queda anotado como "no es un caso" y no se
// vuelve a mirar. Solo se leen los mails que llegaron desde que se activó
// (los viejos se siguen cargando a mano desde Mail).

export type ResultadoMail = "importado" | "duplicado" | "ignorado" | "error";
const POR_CORRIDA = 6;
const PISTAS_CASO = /siniestro|gesti[oó]n|denuncia|car[aá]tula|inspecci[oó]n|investigaci[oó]n|asegurad[oa]|p[oó]liza/i;

let asegurada = false;
export async function asegurarTablasMailAuto() {
  if (asegurada) return;
  await asegurarTablasGmail();
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mail_auto (
      mensaje_id text PRIMARY KEY,
      conexion_id uuid,
      resultado text NOT NULL,
      siniestro_id uuid,
      asunto text,
      detalle text,
      procesado_en timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mail_auto_casilla (
      conexion_id uuid PRIMARY KEY,
      desde timestamptz NOT NULL DEFAULT now(),
      ultima_lectura timestamptz,
      ultimo_error text
    )`);
  asegurada = true;
}

async function operadorDeCasilla(conexionId: string): Promise<string | null> {
  const [u] = await getDb().select({ operador: usuarios.operador }).from(usuarios)
    .where(sql`${usuarios.gmailConexionId} = ${conexionId} AND ${usuarios.rol} = 'vendedor' AND ${usuarios.activo} = true`);
  return u?.operador ?? null;
}

// Elige el operador por la zona del domicilio / lugar del hecho. Si no está
// claro, null: el caso queda sin operador para que lo asigne el admin.
async function operadorPorZona(domicilio: string | null, lugar: string | null): Promise<{ operador: string | null; motivo: string }> {
  const ops = (await getDb().execute(sql`SELECT operador, nombre, zona FROM usuarios WHERE rol = 'vendedor' AND activo = true AND operador IS NOT NULL AND zona IS NOT NULL`)).rows as { operador: string; nombre: string; zona: string }[];
  if (!ops.length || !process.env.ANTHROPIC_API_KEY || (!domicilio && !lugar)) return { operador: null, motivo: "sin datos de zona" };
  try {
    const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: "claude-haiku-5-5", max_tokens: 200,
      messages: [{ role: "user", content: `Operadores de un estudio de investigación de siniestros (AMBA) y sus zonas:
${ops.map(o => `- ${o.operador} (${o.nombre}): ${o.zona}`).join("\n")}

Caso nuevo. Domicilio del asegurado: ${domicilio ?? "—"}. Lugar del hecho: ${lugar ?? "—"}.
¿A qué operador le corresponde por zona (la entrevista suele ser en el domicilio)? Respondé SOLO un JSON {"operador": "CÓDIGO" o null, "motivo": "frase corta"}. null si la dirección no alcanza para saberlo o cae fuera de todas las zonas.` }],
    });
    const t = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as { operador: string | null; motivo?: string };
    const op = ops.find(o => o.operador === j.operador)?.operador ?? null;
    return { operador: op, motivo: String(j.motivo ?? "") };
  } catch {
    return { operador: null, motivo: "la IA no pudo decidir la zona" };
  }
}

function fechaHora(d = new Date()) {
  const f = d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
  const h = d.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
  return { f, h };
}

async function anotar(mensajeId: string, conexionId: string, resultado: ResultadoMail, asunto: string | null, detalle: string, siniestroId: string | null = null) {
  await getDb().execute(sql`
    INSERT INTO mail_auto (mensaje_id, conexion_id, resultado, siniestro_id, asunto, detalle)
    VALUES (${mensajeId}, ${conexionId}, ${resultado}, ${siniestroId}, ${asunto}, ${detalle})
    ON CONFLICT (mensaje_id) DO NOTHING`);
}

async function procesarMail(mensajeId: string, conexionId: string): Promise<ResultadoMail> {
  const db = getDb();
  const mensaje = await obtenerMensaje(mensajeId, conexionId);
  const pdf = mensaje.adjuntos.find(esPdf);
  const texto = [mensaje.asunto, mensaje.cuerpo].filter(Boolean).join("\n\n").trim();
  if (!pdf && !PISTAS_CASO.test(texto)) {
    await anotar(mensajeId, conexionId, "ignorado", mensaje.asunto, "No parece un caso (sin carátula ni datos de siniestro).");
    return "ignorado";
  }
  let pdfBytes: Buffer | null = null;
  let datos;
  if (pdf) {
    pdfBytes = await obtenerAdjunto(mensajeId, pdf.attachmentId, conexionId);
    datos = await extraerCaratula(pdfBytes.toString("base64"));
  } else {
    datos = await extraerDeMail(texto);
  }
  if (!datos.nro_siniestro && !datos.numero_gestion) {
    await anotar(mensajeId, conexionId, "ignorado", mensaje.asunto, "La IA lo leyó y no encontró N° de siniestro ni de gestión.");
    return "ignorado";
  }
  const condiciones = [];
  if (datos.nro_siniestro) condiciones.push(eq(siniestros.nroSiniestro, datos.nro_siniestro));
  if (datos.numero_gestion) condiciones.push(eq(siniestros.numeroGestion, datos.numero_gestion));
  const [existente] = await db.select({ id: siniestros.id }).from(siniestros).where(or(...condiciones));
  if (existente) {
    await anotar(mensajeId, conexionId, "duplicado", mensaje.asunto, "Ya existía un caso con ese número.", existente.id);
    return "duplicado";
  }

  const lugar = datos.lugar_siniestro ? [datos.lugar_siniestro.calle1, datos.lugar_siniestro.altura1, datos.lugar_siniestro.localidad].filter(Boolean).join(" ") : null;
  const propio = await operadorDeCasilla(conexionId);
  const zona = propio ? { operador: propio, motivo: "es de su casilla" } : await operadorPorZona(datos.domicilio ?? null, lugar);
  const siniestro = await crearSiniestro(datos, zona.operador, mensajeId);

  await asegurarTablaEvidencia();
  let archivos = 0;
  for (const a of mensaje.adjuntos) {
    try {
      const bytes = pdfBytes && a.attachmentId === pdf?.attachmentId ? pdfBytes : await obtenerAdjunto(mensajeId, a.attachmentId, conexionId);
      const tipo = esPdf(a) ? "application/pdf" : a.tipo;
      const blob = await put(a.nombre, bytes, { access: "public", addRandomSuffix: true, contentType: tipo });
      await db.insert(evidencia).values({ siniestroId: siniestro.id, nombre: a.nombre, url: blob.url, tipo, tamano: a.tamano || bytes.length, subidoPor: "Lectura automática del mail" });
      archivos++;
    } catch { /* el caso ya está creado; un adjunto que falla no lo frena */ }
  }
  const { f, h } = fechaHora();
  const legajo = siniestro.numeroGestion ?? siniestro.nroSiniestro ?? "sin número";
  await db.insert(bitacora).values({
    siniestroId: siniestro.id, tipo: "mail", autor: "Lectura automática del mail", autorEsAdmin: true, leida: false,
    nota: `📥 Caso subido automáticamente al legajo ${legajo} el ${f} a las ${h}, desde el mail «${mensaje.asunto}» (${mensaje.de}). ${archivos} adjunto${archivos === 1 ? "" : "s"} guardado${archivos === 1 ? "" : "s"} como evidencia. ${zona.operador ? `Asignado a ${zona.operador} (${zona.motivo}).` : `Sin operador: asignalo a mano (${zona.motivo}).`}`,
  });
  await anotar(mensajeId, conexionId, "importado", mensaje.asunto, zona.operador ? `Asignado a ${zona.operador} (${zona.motivo})` : `Sin operador (${zona.motivo})`, siniestro.id);
  if (zona.operador && process.env.AVISAR_AUTO_IMPORT !== "no") await avisarAsignacion(siniestro, zona.operador, conexionId);
  return "importado";
}

export async function leerMailsNuevos() {
  await asegurarTablasMailAuto();
  await asegurarColumnaGmailMensajeId();
  const db = getDb();
  const resumen: Record<string, number> = { importado: 0, duplicado: 0, ignorado: 0, error: 0 };
  let cupo = POR_CORRIDA;
  for (const c of await listarConexiones()) {
    // La primera vez se marca el punto de partida: solo lo que llegue desde ahora.
    const est = (await db.execute(sql`
      INSERT INTO mail_auto_casilla (conexion_id) VALUES (${c.id}) ON CONFLICT (conexion_id) DO UPDATE SET conexion_id = EXCLUDED.conexion_id
      RETURNING desde`)).rows as { desde: string }[];
    const desde = new Date(est[0].desde);
    try {
      const ids = (await listarIdsDesde(desde, c.id)).filter(m => m.fecha >= desde.getTime());
      if (ids.length) {
        const vistos = new Set(((await db.execute(sql`
          SELECT mensaje_id FROM mail_auto WHERE mensaje_id = ANY(${ids.map(i => i.id)}::text[])
          UNION SELECT gmail_mensaje_id FROM siniestros WHERE gmail_mensaje_id = ANY(${ids.map(i => i.id)}::text[])`)).rows as { mensaje_id: string }[]).map(r => r.mensaje_id));
        for (const m of ids.filter(i => !vistos.has(i.id)).reverse()) {
          if (cupo-- <= 0) break;
          try { resumen[await procesarMail(m.id, c.id)]++; }
          catch (e) {
            resumen.error++;
            await anotar(m.id, c.id, "error", null, e instanceof Error ? e.message : String(e)).catch(() => {});
          }
        }
      }
      await db.execute(sql`UPDATE mail_auto_casilla SET ultima_lectura = now(), ultimo_error = null WHERE conexion_id = ${c.id}`);
    } catch (e) {
      await db.execute(sql`UPDATE mail_auto_casilla SET ultima_lectura = now(), ultimo_error = ${e instanceof Error ? e.message : String(e)} WHERE conexion_id = ${c.id}`);
    }
  }
  return resumen;
}
