import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora } from "@/lib/db/schema";
import { generarInforme } from "@/lib/informe";
import { sesionRequerida, puedeVerCaso, puedeVerInformeFinal } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/informe-final  { siniestroId } -> genera la resolución final con IA
// (solo admin: es la versión privada, el operador no la ve — ver puedeVerInformeFinal).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!puedeVerInformeFinal(session)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  try {
    const { siniestroId } = await req.json();
    const db = getDb();
    const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
    if (!s) return NextResponse.json({ error: "Siniestro no encontrado." }, { status: 404 });
    if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

    const notas = await db.select().from(bitacora).where(eq(bitacora.siniestroId, siniestroId));
    const textoNotas = notas.map((n) => `[${n.tipo}] ${n.nota}`);

    const informeTexto = await generarInforme(s, textoNotas);
    const [updated] = await db.update(siniestros)
      .set({ informeFinal: informeTexto, actualizadoEn: new Date() })
      .where(eq(siniestros.id, siniestroId))
      .returning();

    return NextResponse.json({ informeFinal: informeTexto, siniestro: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar la resolución final.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
