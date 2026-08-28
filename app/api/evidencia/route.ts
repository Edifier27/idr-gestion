import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { clasificarEvidencia } from "@/lib/clasificar-evidencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/evidencia — registra en la DB un archivo que el cliente ya subió
// directo a Vercel Blob (ver /api/evidencia/upload).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const siniestroId = typeof body?.siniestroId === "string" ? body.siniestroId : "";
  const nombre = typeof body?.nombre === "string" ? body.nombre : "";
  const url = typeof body?.url === "string" ? body.url : "";
  const tipo = typeof body?.tipo === "string" ? body.tipo : "application/octet-stream";
  const tamano = typeof body?.tamano === "number" ? body.tamano : null;
  let categoria = typeof body?.categoria === "string" && body.categoria ? body.categoria : null;
  if (!siniestroId || !nombre || !url) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  await asegurarTablaEvidencia();
  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!caso || !puedeVerCaso(session, caso.operador)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // Si no eligió categoría a mano, la IA la infiere mirando el archivo — así
  // el expediente igual se arma en el orden correcto (lib/pdf.ts agrupa por
  // categoría). Si falla por lo que sea, queda sin categoría como antes.
  if (!categoria) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        categoria = await clasificarEvidencia(bytes, tipo);
      }
    } catch {
      categoria = null;
    }
  }

  const [row] = await db.insert(evidencia)
    .values({ siniestroId, nombre, url, tipo, tamano, categoria, subidoPor: session.user.username })
    .returning();
  return NextResponse.json({ archivo: row }, { status: 201 });
}
