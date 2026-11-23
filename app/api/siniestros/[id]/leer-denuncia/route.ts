import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { leerDenuncia } from "@/lib/leer-denuncia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/siniestros/:id/leer-denuncia — la IA lee la denuncia y la
// ampliación cargadas como evidencia, arma el relato y coteja con el caso.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const [s] = await getDb().select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!s) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  try {
    const lectura = await leerDenuncia(s, session.user.name ?? session.user.username ?? null);
    return NextResponse.json({ lectura });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo leer la denuncia." }, { status: 400 });
  }
}
