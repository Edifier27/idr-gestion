import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { guardarEnCaso } from "@/lib/whatsapp/asignar";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/whatsapp/asignar { mensajeId, siniestroId, categoria } — admin:
// ubica a mano una prueba (sin asignar, en pregunta o para moverla de caso).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.mensajeId !== "string" || typeof body?.siniestroId !== "string") return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  try {
    await asegurarTablasWhatsapp();
    await guardarEnCaso(body.mensajeId, body.siniestroId, typeof body.categoria === "string" && body.categoria ? body.categoria : null, session.user.username ?? "admin");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo asignar." }, { status: 500 });
  }
}
