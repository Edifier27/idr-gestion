import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { sesionRequerida } from "@/lib/acceso";
import { getDb } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { responder } from "@/lib/whatsapp/asignar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/whatsapp/enviar { conversacionId, texto } — admin responde en el
// chat. Solo dentro de las 24 h desde el último mensaje del operador (regla
// de WhatsApp: fuera de esa ventana solo salen plantillas aprobadas).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (typeof body?.conversacionId !== "string" || !texto) return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });
  await asegurarTablasWhatsapp();
  const res = await getDb().execute(sql`SELECT telefono, ventana_hasta FROM wa_conversacion WHERE id = ${body.conversacionId}`);
  const c = (res.rows as { telefono: string; ventana_hasta: string | null }[])[0];
  if (!c) return NextResponse.json({ error: "No existe la conversación." }, { status: 404 });
  if (!c.ventana_hasta || new Date(c.ventana_hasta).getTime() < Date.now()) {
    return NextResponse.json({ error: "Pasaron más de 24 h desde el último mensaje del operador: WhatsApp no deja escribirle hasta que vuelva a escribir." }, { status: 400 });
  }
  try {
    await responder(body.conversacionId, c.telefono, texto, session.user.name ?? session.user.username ?? "Admin");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo enviar." }, { status: 500 });
  }
}
