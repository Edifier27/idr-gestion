import { NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { listarMensajes } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/gmail/mensajes — lista los últimos mails de la bandeja conectada.
export async function GET() {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    const mensajes = await listarMensajes(25);
    return NextResponse.json({ mensajes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer la bandeja.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
