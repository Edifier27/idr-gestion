import { NextResponse } from "next/server";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { obtenerMensaje } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/gmail/mensajes/:id — cuerpo completo de un mail, de la casilla
// asignada al que pide.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });
  try {
    const mensaje = await obtenerMensaje(params.id, conexion.conexionId);
    return NextResponse.json({ mensaje });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer el mensaje.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
