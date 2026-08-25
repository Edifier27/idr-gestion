import { NextRequest, NextResponse } from "next/server";
import { extraerCaratula } from "@/lib/extraction";
import { sesionRequerida } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/extract
// Body: { pdfBase64: string }  ->  devuelve los campos de la carátula.
// Le pasás el PDF de carátula adjunto en base64 y te devuelve el JSON listo
// para crear el siniestro. Admin-only, mismo criterio que el alta de casos.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json(
        { error: "Falta pdfBase64 (el PDF de carátula en base64)." },
        { status: 400 }
      );
    }
    const datos = await extraerCaratula(pdfBase64);
    return NextResponse.json({ datos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al extraer la carátula.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 501 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
