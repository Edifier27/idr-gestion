import { NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { obtenerMensaje } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/gmail/mensajes/:id — cuerpo completo de un mail.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    const mensaje = await obtenerMensaje(params.id);
    return NextResponse.json({ mensaje });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer el mensaje.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
