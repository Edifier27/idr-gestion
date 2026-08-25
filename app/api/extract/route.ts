import { NextRequest, NextResponse } from "next/server";
import { extraerCaratula } from "@/lib/extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/extract
// Body: { pdfBase64: string }  ->  devuelve los campos de la carátula.
// Este endpoint es el que dispara el "botón" desde el mail: le pasás el PDF
// adjunto en base64 y te devuelve el JSON listo para crear el siniestro.
export async function POST(req: NextRequest) {
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
