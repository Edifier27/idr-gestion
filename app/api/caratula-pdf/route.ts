import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { caratulaPDF } from "@/lib/pdf";

export const runtime = "nodejs";

// GET /api/caratula-pdf?id=... -> descarga la carátula en PDF
export async function GET(req: NextRequest) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, id));
  if (!s) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const bytes = await caratulaPDF(s);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="caratula-${s.nroSiniestro ?? s.id}.pdf"`,
    },
  });
}
