import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, datoExtra, bitacora } from "@/lib/db/schema";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente } from "@/lib/categorias-evidencia";
import { etiquetaEtapaContacto } from "@/lib/etapa-contacto";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { etiquetaRubro, rubroDeTipo } from "@/lib/tipos-siniestro";

// Resumen de cada caso con IA (como la ficha de AsesorCRM): qué pasó, en qué
// está, cómo se segmenta (rubro, alerta, prioridad, etiquetas), qué le falta
// —más allá de la lista fija del ramo— y qué preguntarle al operador.

export type ResumenCaso = {
  situacion: string;
  resumen: string;
  segmento: { alerta: "baja" | "media" | "alta"; prioridad: "alta" | "media" | "baja"; etiquetas: string[]; motivo: string };
  faltan: { que: string; por_que: string }[];
  proximos_pasos: string[];
  preguntas_operador: string[];
  alertas: string[];
};

export async function leerResumenes(ids: string[]): Promise<Map<string, { datos: ResumenCaso; evidencias: number; generado_en: string }>> {
  const mapa = new Map<string, { datos: ResumenCaso; evidencias: number; generado_en: string }>();
  if (!ids.length) return mapa;
  try {
    await asegurarTablasWhatsapp();
    const res = await getDb().execute(sql`SELECT siniestro_id, datos, evidencias, generado_en FROM resumen_caso WHERE siniestro_id = ANY(${ids}::uuid[])`);
    for (const r of res.rows as { siniestro_id: string; datos: ResumenCaso; evidencias: number; generado_en: string }[]) mapa.set(r.siniestro_id, r);
  } catch { /* sin resúmenes */ }
  return mapa;
}

const SISTEMA = `Sos perito liquidador de siniestros en Argentina y coordinás a los operadores que investigan en la calle.
Con todo lo que hay del caso armá una ficha para el administrador. Devolvé SOLO un JSON válido:
{
  "situacion": "una línea: en qué está el caso hoy",
  "resumen": "4 a 6 líneas: qué se denunció, qué relevó el operador, qué pruebas hay y qué llama la atención",
  "segmento": {
    "alerta": "baja" | "media" | "alta"  (indicios de fraude o inconsistencias),
    "prioridad": "alta" | "media" | "baja" (urgencia de gestión: vencimientos, entrevista hecha sin informe, contacto fallido, alerta alta),
    "etiquetas": ["3 a 6 etiquetas cortas que segmenten el caso, ej. 'moto', 'vía pública', 'sin llaves', 'denuncia tardía', 'conductor ≠ asegurado', 'zona sur'"],
    "motivo": "por qué esa alerta y esa prioridad, en una frase"
  },
  "faltan": [ { "que": "prueba o dato que falta", "por_que": "para qué sirve en ESTE caso" } ],
  "proximos_pasos": ["acciones concretas para el operador o el admin, en orden"],
  "preguntas_operador": ["preguntas para mandarle al operador por WhatsApp"],
  "alertas": ["inconsistencias o puntos a verificar"]
}
Los casos se segmentan SOLO por rubro (1 choque RC, 2 incendio, 3 robo total, 4 robo parcial, 5 cristales, 6 destrucción total): las etiquetas son descriptivas, no segmentos nuevos.
En "faltan" incluí las pruebas del ramo que no están (pruebasDelRamoFaltantes) y sumá lo que el caso puntual pida.
No inventes datos: si algo no surge de la información, no lo afirmes. Español rioplatense, claro y concreto.`;

export async function generarResumenCaso(siniestroId: string): Promise<ResumenCaso> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const db = getDb();
  await asegurarTablasWhatsapp();
  await asegurarTablaEvidencia();
  await asegurarTablaDatoExtra();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!s) throw new Error("No existe el caso.");
  const ramo = ramoDeTipo(s.tipo);
  const ev = await db.select({ nombre: evidencia.nombre, categoria: evidencia.categoria, creadoEn: evidencia.creadoEn }).from(evidencia).where(eq(evidencia.siniestroId, s.id));
  const extras = await db.select().from(datoExtra).where(eq(datoExtra.siniestroId, s.id));
  const notas = await db.select({ fecha: bitacora.fecha, tipo: bitacora.tipo, nota: bitacora.nota }).from(bitacora).where(eq(bitacora.siniestroId, s.id));
  const lectura = await leerLecturaDenuncia(s.id);
  const wa = (await db.execute(sql`
    SELECT creado_en, texto, transcripcion, media_nombre, categoria FROM wa_mensaje
    WHERE siniestro_id = ${s.id} ORDER BY creado_en`)).rows as { creado_en: string; texto: string | null; transcripcion: string | null; media_nombre: string | null; categoria: string | null }[];
  const tiene = new Set(ev.map(e => e.categoria).filter(Boolean) as string[]);
  const pedidas = seccionesExpediente(ramo).filter(x => x.id !== "otros" && x.id !== "lugar").flatMap(x => x.categorias);
  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;

  const datos = {
    nro: s.nroSiniestro, compania: s.compania, tipo: s.tipo, rubro: etiquetaRubro(rubroDeTipo(s.tipo)), asegurado: s.asegurado ?? s.denunciante, dni: s.dni,
    domicilio: s.domicilio, lugarHecho: [lugar.calle1, lugar.altura1, lugar.localidad].filter(Boolean).join(" "),
    fechaOcurrencia: s.fechaOcurrencia, ingreso: s.fechaIngreso, operador: s.operador,
    etapa: etiquetaEtapaContacto(s.etapaContacto), entrevista: s.fechaEntrevista, vencimiento: s.fechaLimite,
    motivoContactoFallido: s.motivoContacto, resultadoCargado: s.resultado,
    datosAdicionales: Object.fromEntries(extras.map(e => [e.etiqueta, e.valor])),
    relatoDenuncia: s.relatoDenuncia, denunciaVsSiniestro: lectura ? { cotejo: lectura.cotejo, alertas: lectura.alertas } : null,
    descargoOperador: s.descargo, cotejoTecnico: s.informe,
    pruebasCargadas: ev.map(e => `${etiquetaCategoriaEvidencia(e.categoria, ramo)}: ${e.nombre}`),
    pruebasDelRamoFaltantes: pedidas.filter(c => !tiene.has(c)).map(c => etiquetaCategoriaEvidencia(c, ramo)),
    mensajesDelOperadorPorWhatsapp: wa.map(m => `${new Date(m.creado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}: ${m.transcripcion ? `(audio) ${m.transcripcion}` : m.texto ?? ""}${m.media_nombre ? ` [archivo ${m.media_nombre}${m.categoria ? `, ${etiquetaCategoriaEvidencia(m.categoria, ramo)}` : ""}]` : ""}`),
    chatDelCaso: notas.slice(-20).map(n => `${new Date(n.fecha).toLocaleDateString("es-AR")} ${n.tipo}: ${n.nota}`),
    hoy: new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
  };

  const msg = await new Anthropic({ apiKey }).messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 2000,
    system: SISTEMA,
    messages: [{ role: "user", content: JSON.stringify(datos, null, 1) }],
  });
  const t = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
  let r: ResumenCaso;
  try {
    r = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch {
    throw new Error("La IA no devolvió un resumen válido. Probá de nuevo.");
  }
  const limpio: ResumenCaso = {
    situacion: String(r.situacion ?? ""),
    resumen: String(r.resumen ?? ""),
    segmento: {
      alerta: ["baja", "media", "alta"].includes(r.segmento?.alerta) ? r.segmento.alerta : "media",
      prioridad: ["alta", "media", "baja"].includes(r.segmento?.prioridad) ? r.segmento.prioridad : "media",
      etiquetas: Array.isArray(r.segmento?.etiquetas) ? r.segmento.etiquetas.slice(0, 8).map(String) : [],
      motivo: String(r.segmento?.motivo ?? ""),
    },
    faltan: Array.isArray(r.faltan) ? r.faltan.slice(0, 15).map(f => ({ que: String(f.que ?? ""), por_que: String(f.por_que ?? "") })) : [],
    proximos_pasos: Array.isArray(r.proximos_pasos) ? r.proximos_pasos.slice(0, 8).map(String) : [],
    preguntas_operador: Array.isArray(r.preguntas_operador) ? r.preguntas_operador.slice(0, 8).map(String) : [],
    alertas: Array.isArray(r.alertas) ? r.alertas.slice(0, 8).map(String) : [],
  };
  await db.execute(sql`
    INSERT INTO resumen_caso (siniestro_id, datos, evidencias, generado_en) VALUES (${s.id}, ${JSON.stringify(limpio)}::jsonb, ${ev.length}, now())
    ON CONFLICT (siniestro_id) DO UPDATE SET datos = EXCLUDED.datos, evidencias = EXCLUDED.evidencias, generado_en = now()`);
  return limpio;
}
