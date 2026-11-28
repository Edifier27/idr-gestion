import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { construirLegajoWord } from "@/lib/legajo-word";
import { sesionRequerida, puedeVerCaso, puedeVerInformeFinal } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/legajo-word?id=… -> legajo final en Word para la aseguradora:
// informe final + anexo de pruebas (solo admin: lleva el informe final).
export async function GET(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || !puedeVerInformeFinal(session)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const [s] = await getDb().select({ operador: siniestros.operador }).from(siniestros).where(eq(siniestros.id, id));
  if (!s) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  try {
    const r = await construirLegajoWord(id);
    if (!r) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    const nombre = `Stro ${r.siniestro.nroSiniestro ?? r.siniestro.id} ${r.siniestro.asegurado ?? ""} ${r.siniestro.compania ?? ""}`.replace(/\s+/g, " ").trim();
    return new NextResponse(new Uint8Array(r.bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="legajo.docx"; filename*=UTF-8''${encodeURIComponent(nombre)}.docx`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo armar el legajo." }, { status: 500 });
  }
}
