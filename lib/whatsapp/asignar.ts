import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { CATEGORIAS_EVIDENCIA, etiquetaCategoriaEvidencia, ramoDeTipo } from "@/lib/categorias-evidencia";
import { enviarTexto, enviarBotones } from "@/lib/whatsapp/meta";

// ¿De qué caso es esta prueba? La IA mira solo los casos abiertos del
// operador que la mandó (2 o 3 por día) y las pistas: nombre, DNI, patente o
// N° de siniestro en el texto o dentro de la imagen, dirección y de qué caso
// se venía hablando. Nunca adivina en silencio:
// - segura → se guarda en la Evidencia del caso y se le confirma al operador;
// - duda → se le pregunta con botones en el mismo WhatsApp;
// - no sabe → queda "Sin asignar" para que lo ubique el admin.

export type MensajeMedia = {
  id: string; conversacionId: string; telefono: string; operador: string | null;
  texto: string | null; mediaUrl: string; mediaMime: string; mediaNombre: string;
};

type Caso = { id: string; nro: string | null; asegurado: string | null; dni: string | null; tipo: string | null; domicilio: string | null; lugar: string | null; etapa: string | null };

const VALORES = CATEGORIAS_EVIDENCIA.map(c => c.value as string);

function etiquetaCorta(c: Caso) {
  const apellido = (c.asegurado ?? "Caso").trim().split(/\s+/)[0];
  return `${apellido} #${c.nro ?? "s/n"}`.slice(0, 20);
}

async function casosAbiertos(operador: string | null): Promise<Caso[]> {
  if (!operador) return [];
  const res = await getDb().execute(sql`
    SELECT id, nro_siniestro AS nro, COALESCE(asegurado, denunciante) AS asegurado, dni, tipo, domicilio,
           lugar_siniestro->>'calle1' AS lugar, etapa_contacto AS etapa
    FROM siniestros WHERE operador = ${operador} AND estado <> 'cerrado'
    ORDER BY creado_en DESC LIMIT 15`);
  return res.rows as Caso[];
}

async function contextoReciente(conversacionId: string): Promise<string[]> {
  const res = await getDb().execute(sql`
    SELECT m.creado_en, m.texto, s.nro_siniestro AS nro, COALESCE(s.asegurado, s.denunciante) AS asegurado
    FROM wa_mensaje m LEFT JOIN siniestros s ON s.id = m.siniestro_id
    WHERE m.conversacion_id = ${conversacionId} AND m.direccion = 'entrante'
    ORDER BY m.creado_en DESC LIMIT 12`);
  return (res.rows as { creado_en: string; texto: string | null; nro: string | null; asegurado: string | null }[])
    .reverse()
    .map(r => `${new Date(r.creado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}: ${r.texto ?? "(archivo sin texto)"}${r.nro ? ` [quedó en el caso #${r.nro} ${r.asegurado ?? ""}]` : ""}`);
}

type Decision = { caso: number | null; confianza: "alta" | "media" | "baja"; candidatos: number[]; categoria: string | null; motivo: string };

async function decidir(m: MensajeMedia, casos: Caso[], bytes: Buffer): Promise<Decision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { caso: null, confianza: "baja", candidatos: [], categoria: null, motivo: "Sin IA configurada" };
  const lista = casos.map((c, i) => `${i + 1}) #${c.nro ?? "s/n"} · ${c.asegurado ?? "—"} · DNI ${c.dni ?? "—"} · ${c.tipo ?? "—"} · domicilio: ${c.domicilio ?? "—"} · lugar del hecho: ${c.lugar ?? "—"}`).join("\n");
  const contexto = await contextoReciente(m.conversacionId);
  const contenido: Anthropic.Messages.ContentBlockParam[] = [];
  const data = bytes.toString("base64");
  if (m.mediaMime === "application/pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
  else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(m.mediaMime)) contenido.push({ type: "image", source: { type: "base64", media_type: m.mediaMime as "image/jpeg", data } });
  contenido.push({
    type: "text",
    text: `Un operador de un estudio de investigación de siniestros mandó este archivo por WhatsApp ("${m.mediaNombre}")${m.texto ? ` con el texto: "${m.texto}"` : " sin texto"}.

Sus casos abiertos:
${lista}

Lo último que escribió en el chat:
${contexto.join("\n") || "(nada)"}

Decidí a qué caso corresponde el archivo y qué tipo de prueba es. Pistas: nombre, DNI, patente o N° de siniestro en el texto o dentro de la imagen/documento; direcciones; de qué caso se venía hablando en los últimos mensajes (si el operador viene mandando pruebas de un caso, lo siguiente suele ser del mismo, salvo que algo indique otro).
Categorías posibles: ${VALORES.join(", ")}.

Respondé SOLO un JSON: {"caso": número de la lista o null, "confianza": "alta" | "media" | "baja", "candidatos": [hasta 3 números de la lista, del más probable al menos], "categoria": una de las categorías o null, "motivo": "frase corta"}.
"alta" solo si hay una pista clara; "media" si dudás entre pocos; "baja" si no hay forma de saber.`,
  });
  try {
    const msg = await new Anthropic({ apiKey }).messages.create({ model: "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content: contenido }] });
    const t = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
    const d = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as Decision;
    const valido = (n: unknown) => typeof n === "number" && n >= 1 && n <= casos.length;
    return {
      caso: valido(d.caso) ? d.caso : null,
      confianza: ["alta", "media", "baja"].includes(d.confianza) ? d.confianza : "baja",
      candidatos: Array.isArray(d.candidatos) ? d.candidatos.filter(valido).slice(0, 3) : [],
      categoria: d.categoria && VALORES.includes(d.categoria) ? d.categoria : null,
      motivo: String(d.motivo ?? "").slice(0, 300),
    };
  } catch {
    return { caso: null, confianza: "baja", candidatos: [], categoria: null, motivo: "La IA no pudo leer el archivo" };
  }
}

// Guarda el archivo en la Evidencia del caso y marca el mensaje como asignado.
export async function guardarEnCaso(mensajeId: string, siniestroId: string, categoria: string | null, autor: string) {
  const db = getDb();
  const res = await db.execute(sql`SELECT media_url, media_mime, media_nombre, evidencia_id FROM wa_mensaje WHERE id = ${mensajeId}`);
  const m = (res.rows as { media_url: string | null; media_mime: string | null; media_nombre: string | null; evidencia_id: string | null }[])[0];
  if (!m?.media_url) throw new Error("El mensaje no tiene archivo.");
  await asegurarTablaEvidencia();
  if (m.evidencia_id) {
    // Ya estaba en un caso: se mueve (misma evidencia, otro caso o categoría).
    await db.execute(sql`UPDATE evidencia SET siniestro_id = ${siniestroId}, categoria = ${categoria} WHERE id = ${m.evidencia_id}`);
  } else {
    const [ev] = await db.insert(evidencia).values({
      siniestroId, nombre: m.media_nombre ?? "archivo", url: m.media_url, tipo: m.media_mime ?? "application/octet-stream",
      categoria, subidoPor: autor,
    }).returning({ id: evidencia.id });
    await db.execute(sql`UPDATE wa_mensaje SET evidencia_id = ${ev.id} WHERE id = ${mensajeId}`);
  }
  await db.execute(sql`UPDATE wa_mensaje SET siniestro_id = ${siniestroId}, categoria = ${categoria}, asignacion = 'asignado' WHERE id = ${mensajeId}`);
}

async function registrarSaliente(conversacionId: string, waId: string, texto: string, autor: string) {
  await getDb().execute(sql`
    INSERT INTO wa_mensaje (conversacion_id, wa_id, direccion, tipo, texto, estado, autor)
    VALUES (${conversacionId}, ${waId}, 'saliente', 'texto', ${texto}, 'enviado', ${autor})
    ON CONFLICT (wa_id) DO NOTHING`);
}

export async function responder(conversacionId: string, telefono: string, texto: string, autor = "Asistente IDR") {
  const r = await enviarTexto(telefono, texto);
  await registrarSaliente(conversacionId, r.id, texto, autor);
}

export async function asignarMedia(m: MensajeMedia, bytes: Buffer) {
  const db = getDb();
  const casos = await casosAbiertos(m.operador);
  if (!m.operador) {
    await db.execute(sql`UPDATE wa_mensaje SET asignacion = 'sin_asignar', asignacion_nota = 'Número no vinculado a ningún operador' WHERE id = ${m.id}`);
    return;
  }
  if (casos.length === 0) {
    await db.execute(sql`UPDATE wa_mensaje SET asignacion = 'sin_asignar', asignacion_nota = 'El operador no tiene casos abiertos' WHERE id = ${m.id}`);
    await responder(m.conversacionId, m.telefono, "Recibido. No tenés casos abiertos, así que lo ubica el administrador.");
    return;
  }
  const d = await decidir(m, casos, bytes);
  const ramoDe = (c: Caso) => ramoDeTipo(c.tipo);
  // Con un solo caso abierto no hay nada que preguntar.
  const elegido = casos.length === 1 ? casos[0] : d.caso && d.confianza === "alta" ? casos[d.caso - 1] : null;
  if (elegido) {
    await guardarEnCaso(m.id, elegido.id, d.categoria, `WhatsApp · ${m.operador}`);
    await db.execute(sql`UPDATE wa_mensaje SET asignacion_nota = ${d.motivo} WHERE id = ${m.id}`);
    await responder(m.conversacionId, m.telefono, `✓ Guardado en ${elegido.asegurado ?? "el caso"} #${elegido.nro ?? "s/n"}${d.categoria ? ` → ${etiquetaCategoriaEvidencia(d.categoria, ramoDe(elegido))}` : ""}`);
    return;
  }
  const candidatos = (d.candidatos.length ? d.candidatos : d.caso ? [d.caso] : []).map(i => casos[i - 1]);
  if (d.confianza === "media" && candidatos.length > 0) {
    await db.execute(sql`UPDATE wa_mensaje SET asignacion = 'pregunta', categoria = ${d.categoria}, asignacion_nota = ${d.motivo} WHERE id = ${m.id}`);
    const r = await enviarBotones(m.telefono, `¿De qué caso es "${m.mediaNombre}"?`, candidatos.map(c => ({ id: `asig:${m.id}:${c.id}`, titulo: etiquetaCorta(c) })));
    await registrarSaliente(m.conversacionId, r.id, `¿De qué caso es "${m.mediaNombre}"? (${candidatos.map(etiquetaCorta).join(" / ")})`, "Asistente IDR");
    return;
  }
  await db.execute(sql`UPDATE wa_mensaje SET asignacion = 'sin_asignar', categoria = ${d.categoria}, asignacion_nota = ${d.motivo} WHERE id = ${m.id}`);
  await responder(m.conversacionId, m.telefono, `Recibido "${m.mediaNombre}". No pude identificar de qué caso es: decime el apellido o el N° de siniestro, o lo ubica el administrador.`);
}
