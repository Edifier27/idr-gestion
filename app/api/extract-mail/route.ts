import { NextRequest, NextResponse } from "next/server";
import { extraerDeMail } from "@/lib/extraction";
import { sesionRequerida } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/extract-mail  { texto } -> campos de un mail de derivación,
// listos para crear el siniestro. Solo admin (mismo criterio que el alta
// manual de casos en /api/siniestros).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string" || !texto.trim()) {
      return NextResponse.json({ error: "Falta el texto del mail." }, { status: 400 });
    }
    const datos = await extraerDeMail(texto);
    return NextResponse.json({ datos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer el mail.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 501 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
