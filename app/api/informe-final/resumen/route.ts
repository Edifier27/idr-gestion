import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { resumirInforme } from "@/lib/informe-final";
import { sesionRequerida, puedeVerCaso, puedeVerInformeFinal } from "@/lib/acceso";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/informe-final/resumen { siniestroId } -> arma el informe resumido
// de un informe completo que ya existe (los que se hicieron antes del resumen).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || !puedeVerInformeFinal(session)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const { siniestroId } = await req.json().catch(() => ({}));
  const [s] = await getDb().select().from(siniestros).where(eq(siniestros.id, String(siniestroId ?? "")));
  if (!s) return NextResponse.json({ error: "Siniestro no encontrado." }, { status: 404 });
  if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!s.informeFinal) return NextResponse.json({ error: "Todavía no hay informe para resumir." }, { status: 400 });
  try {
    await asegurarEstadoInformeFinal();
    const resumen = await resumirInforme(s.informeFinal);
    await getDb().execute(sql`UPDATE siniestros SET informe_final_resumen = ${JSON.stringify(resumen)}::jsonb WHERE id = ${s.id}`);
    return NextResponse.json({ resumen });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo armar el resumen." }, { status: 500 });
  }
}
