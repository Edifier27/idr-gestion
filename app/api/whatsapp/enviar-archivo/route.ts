import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { sesionRequerida } from "@/lib/acceso";
import { getDb } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { enviarMedia } from "@/lib/whatsapp/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/whatsapp/enviar-archivo (multipart: conversacionId, archivo, texto)
// — el admin le manda una foto, video, audio o documento al operador, dentro
// de la ventana de 24 h.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const conversacionId = String(form?.get("conversacionId") ?? "");
  const archivo = form?.get("archivo");
  const texto = String(form?.get("texto") ?? "").trim() || null;
  if (!conversacionId || !(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (archivo.size > 16 * 1024 * 1024) return NextResponse.json({ error: "El archivo pasa los 16 MB que permite WhatsApp." }, { status: 400 });
  await asegurarTablasWhatsapp();
  const db = getDb();
  const res = await db.execute(sql`SELECT telefono, ventana_hasta FROM wa_conversacion WHERE id = ${conversacionId}`);
  const c = (res.rows as { telefono: string; ventana_hasta: string | null }[])[0];
  if (!c) return NextResponse.json({ error: "No existe la conversación." }, { status: 404 });
  if (!c.ventana_hasta || new Date(c.ventana_hasta).getTime() < Date.now()) {
    return NextResponse.json({ error: "Pasaron más de 24 h desde el último mensaje del operador: WhatsApp no deja escribirle hasta que vuelva a escribir." }, { status: 400 });
  }
  const mime = archivo.type || "application/octet-stream";
  const tipo = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document";
  try {
    const blob = await put(`whatsapp/enviados/${archivo.name}`, Buffer.from(await archivo.arrayBuffer()), { access: "public", addRandomSuffix: true, contentType: mime });
    const r = await enviarMedia(c.telefono, tipo, blob.url, texto, archivo.name);
    await db.execute(sql`
      INSERT INTO wa_mensaje (conversacion_id, wa_id, direccion, tipo, texto, media_url, media_mime, media_nombre, estado, autor)
      VALUES (${conversacionId}, ${r.id}, 'saliente', ${tipo}, ${texto}, ${blob.url}, ${mime}, ${archivo.name}, 'enviado', ${session.user.name ?? session.user.username ?? "Admin"})`);
    await db.execute(sql`UPDATE wa_conversacion SET ultimo_en = now(), ultimo_texto = ${texto ?? `📎 ${archivo.name}`} WHERE id = ${conversacionId}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo enviar." }, { status: 500 });
  }
}
