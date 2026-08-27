import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { construirExpedientePDF } from "@/lib/expediente";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/expediente-pdf?id=... -> carátula + informe + fotos + documental en un solo PDF
export async function GET(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, id));
  if (!s) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const resultado = await construirExpedientePDF(id);
  if (!resultado) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  return new NextResponse(Buffer.from(resultado.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="expediente-${s.nroSiniestro ?? s.id}.pdf"`,
    },
  });
}
