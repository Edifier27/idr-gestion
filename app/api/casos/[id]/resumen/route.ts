import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { generarResumenCaso } from "@/lib/resumen-caso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/casos/:id/resumen — admin: genera (o actualiza) el resumen con IA
// del caso, con su segmentación, lo que falta y las preguntas al operador.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  try {
    const resumen = await generarResumenCaso(params.id);
    return NextResponse.json({ resumen });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo generar el resumen." }, { status: 500 });
  }
}
