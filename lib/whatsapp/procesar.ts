import { put } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { claveTelefono, descargarMedia } from "@/lib/whatsapp/meta";
import { asignarMedia, guardarEnCaso, responder } from "@/lib/whatsapp/asignar";
import { CACHE_NOMBRES } from "@/lib/whatsapp/tipos";
import { transcribir } from "@/lib/whatsapp/transcribir";

// Procesa lo que llega del webhook de Meta (o del simulador): guarda cada
// mensaje una sola vez (por su id de WhatsApp), baja los archivos al
// almacenamiento del CRM y manda las pruebas a asignar.

type EntranteBase = {
  waId: string; telefono: string; nombre: string | null; tipo: string; texto: string | null;
  archivo?: { buffer: Buffer; mime: string; nombre: string } | null;
  botonId?: string | null;
};

async function operadorDe(telefono: string): Promise<string | null> {
  const res = await getDb().execute(sql`SELECT operador, telefono FROM usuarios WHERE rol = 'vendedor' AND activo = true AND telefono IS NOT NULL`);
  const clave = claveTelefono(telefono);
  const hit = (res.rows as { operador: string | null; telefono: string }[]).find(u => claveTelefono(u.telefono) === clave);
  return hit?.operador ?? null;
}

async function conversacionDe(telefono: string, nombre: string | null, resumen: string): Promise<{ id: string; operador: string | null }> {
  const operador = await operadorDe(telefono);
  const res = await getDb().execute(sql`
    INSERT INTO wa_conversacion (telefono, nombre, operador, ultimo_en, ultimo_texto, no_leidos, ventana_hasta)
    VALUES (${telefono}, ${nombre}, ${operador}, now(), ${resumen}, 1, now() + interval '24 hours')
    ON CONFLICT (telefono) DO UPDATE SET
      nombre = COALESCE(EXCLUDED.nombre, wa_conversacion.nombre),
      operador = COALESCE(EXCLUDED.operador, wa_conversacion.operador),
      ultimo_en = now(), ultimo_texto = EXCLUDED.ultimo_texto,
      no_leidos = wa_conversacion.no_leidos + 1, ventana_hasta = now() + interval '24 hours'
    RETURNING id, operador`);
  return (res.rows as { id: string; operador: string | null }[])[0];
}

export async function procesarEntrante(e: EntranteBase) {
  await asegurarTablasWhatsapp();
  const db = getDb();
  const ya = await db.execute(sql`SELECT 1 FROM wa_mensaje WHERE wa_id = ${e.waId}`);
  if (ya.rows.length) return; // Meta reintenta: cada mensaje se procesa una sola vez

  const resumen = e.texto?.slice(0, 120) || (e.archivo ? `📎 ${e.archivo.nombre}` : `(${e.tipo})`);
  const conv = await conversacionDe(e.telefono, e.nombre, resumen);

  let mediaUrl: string | null = null;
  if (e.archivo) {
    const blob = await put(`whatsapp/${e.archivo.nombre}`, e.archivo.buffer, { access: "public", addRandomSuffix: true, contentType: e.archivo.mime });
    mediaUrl = blob.url;
  }
  // Notas de voz: se transcriben antes de ubicarlas (el texto es la pista).
  const transcripcion = e.archivo?.mime.startsWith("audio/") ? await transcribir(e.archivo.buffer, e.archivo.mime, e.archivo.nombre) : null;
  const ins = await db.execute(sql`
    INSERT INTO wa_mensaje (conversacion_id, wa_id, direccion, tipo, texto, media_url, media_mime, media_nombre, estado, asignacion, transcripcion)
    VALUES (${conv.id}, ${e.waId}, 'entrante', ${e.tipo}, ${e.texto}, ${mediaUrl}, ${e.archivo?.mime ?? null}, ${e.archivo?.nombre ?? null}, 'recibido',
            ${e.archivo ? "pendiente" : null}, ${transcripcion})
    ON CONFLICT (wa_id) DO NOTHING RETURNING id`);
  if (transcripcion) await db.execute(sql`UPDATE wa_conversacion SET ultimo_texto = ${`🎤 ${transcripcion.slice(0, 110)}`} WHERE id = ${conv.id}`);
  const mensajeId = (ins.rows as { id: string }[])[0]?.id;
  if (!mensajeId) return;

  // Respuesta a un botón "¿De qué caso es?": asig:<mensaje>:<caso>
  if (e.botonId?.startsWith("asig:")) {
    const [, mensajeOrigen, siniestroId] = e.botonId.split(":");
    const cat = await db.execute(sql`SELECT categoria FROM wa_mensaje WHERE id = ${mensajeOrigen}`);
    const categoria = (cat.rows as { categoria: string | null }[])[0]?.categoria ?? null;
    await guardarEnCaso(mensajeOrigen, siniestroId, categoria, `WhatsApp · ${conv.operador ?? e.telefono}`);
    await responder(conv.id, e.telefono, "✓ Listo, guardado.");
    return;
  }

  if (e.archivo && mediaUrl) {
    await asignarMedia({
      id: mensajeId, conversacionId: conv.id, telefono: e.telefono, operador: conv.operador,
      texto: e.texto, mediaUrl, mediaMime: e.archivo.mime, mediaNombre: e.archivo.nombre, transcripcion,
    }, e.archivo.buffer);
  } else if (!conv.operador) {
    await responder(conv.id, e.telefono, "Hola. Este número todavía no está vinculado a un operador de IDR: avisale al administrador.");
  }
}

type MensajeMeta = {
  id: string; from: string; type: string; timestamp?: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; caption?: string; filename?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
  button?: { text: string; payload?: string };
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "audio/ogg": "ogg", "video/mp4": "mp4" };

export async function procesarEvento(body: unknown) {
  const entradas = (body as { entry?: { changes?: { value?: { messages?: MensajeMeta[]; contacts?: { wa_id: string; profile?: { name?: string } }[]; statuses?: { id: string; status: string }[] } }[] }[] }).entry ?? [];
  for (const entrada of entradas) {
    for (const cambio of entrada.changes ?? []) {
      const v = cambio.value ?? {};
      for (const st of v.statuses ?? []) {
        await asegurarTablasWhatsapp();
        await getDb().execute(sql`UPDATE wa_mensaje SET estado = ${st.status} WHERE wa_id = ${st.id}`);
      }
      for (const m of v.messages ?? []) {
        const nombre = v.contacts?.find(c => c.wa_id === m.from)?.profile?.name ?? null;
        const media = m.image ?? m.document ?? m.video ?? m.audio ?? null;
        let archivo: EntranteBase["archivo"] = null;
        if (media?.id) {
          const bajado = await descargarMedia(media.id);
          if (bajado) {
            const mime = (bajado.mime || media.mime_type || "application/octet-stream").split(";")[0];
            const nombreArchivo = m.document?.filename ?? `${CACHE_NOMBRES[m.type] ?? "archivo"}-${m.id.slice(-6)}.${EXT[mime] ?? "bin"}`;
            archivo = { buffer: bajado.buffer, mime, nombre: nombreArchivo };
          }
        }
        await procesarEntrante({
          waId: m.id, telefono: m.from, nombre, tipo: m.type,
          texto: m.text?.body ?? m.image?.caption ?? m.document?.caption ?? m.video?.caption ?? m.interactive?.button_reply?.title ?? m.button?.text ?? null,
          archivo,
          botonId: m.interactive?.button_reply?.id ?? m.button?.payload ?? null,
        });
      }
    }
  }
}
