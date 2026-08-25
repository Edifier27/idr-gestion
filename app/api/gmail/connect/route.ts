import { NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { urlAutorizacion } from "@/lib/gmail";

export const runtime = "nodejs";

// GET /api/gmail/connect — solo admin. Redirige a Google para autorizar el
// acceso de envío sobre la casilla corporativa.
export async function GET() {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    return NextResponse.redirect(urlAutorizacion());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al iniciar la conexión con Gmail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
