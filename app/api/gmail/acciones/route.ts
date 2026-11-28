import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { modificarMensajes, type AccionMail } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

const ACCIONES: AccionMail[] = ["leido", "no_leido", "archivar", "a_recibidos", "destacar", "quitar_destacado"];

// POST /api/gmail/acciones { ids: string[], accion } — marcar leído/no leído,
// archivar (o volver a Recibidos) y destacar, en la casilla de Gmail.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string" && /^[a-zA-Z0-9]+$/.test(x)) : [];
  const accion = body?.accion as AccionMail;
  if (!ids.length || !ACCIONES.includes(accion)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    await modificarMensajes(ids, accion, conexion.conexionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo hacer el cambio.";
    if (message === "PERMISO_MODIFICAR") {
      return NextResponse.json({ error: "Para marcar leído y archivar hay que reconectar la casilla una vez (Mail → Reconectar casilla).", reconectar: true }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
