import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, evidencia } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { expedientePDF, type ArchivoConBytes } from "@/lib/pdf";
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

  await asegurarTablaEvidencia();
  const rows = await db.select().from(evidencia).where(eq(evidencia.siniestroId, id));

  const archivos: ArchivoConBytes[] = await Promise.all(rows.map(async row => {
    try {
      const res = await fetch(row.url);
      if (!res.ok) return { row, bytes: null };
      return { row, bytes: new Uint8Array(await res.arrayBuffer()) };
    } catch {
      return { row, bytes: null };
    }
  }));

  const bytes = await expedientePDF(s, archivos);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="expediente-${s.nroSiniestro ?? s.id}.pdf"`,
    },
  });
}
