import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datoExtra, siniestros } from "@/lib/db/schema";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/dato-extra { siniestroId, etiqueta, valor } — agrega un dato
// libre a un caso (ej. "Chasis: 8A6MVZRT..."), cuando no hay un campo fijo
// para eso en el formulario de "Datos del siniestro".
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const siniestroId = typeof body?.siniestroId === "string" ? body.siniestroId : "";
  const etiqueta = typeof body?.etiqueta === "string" ? body.etiqueta.trim() : "";
  const valor = typeof body?.valor === "string" ? body.valor.trim() : "";
  if (!siniestroId || !etiqueta || !valor) {
    return NextResponse.json({ error: "Falta la etiqueta o el valor." }, { status: 400 });
  }

  await asegurarTablaDatoExtra();
  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!caso || !puedeVerCaso(session, caso.operador)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const [row] = await db.insert(datoExtra).values({ siniestroId, etiqueta, valor }).returning();
  return NextResponse.json({ dato: row }, { status: 201 });
}
