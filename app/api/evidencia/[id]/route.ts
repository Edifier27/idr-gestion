import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/evidencia/:id — borra el archivo de Blob y su puntero en la DB.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  await asegurarTablaEvidencia();
  const db = getDb();
  const [item] = await db.select().from(evidencia).where(eq(evidencia.id, params.id));
  if (!item) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, item.siniestroId));
  if (!caso || !puedeVerCaso(session, caso.operador)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  await del(item.url).catch(() => {}); // si ya no está en Blob, igual limpiamos la DB
  await db.delete(evidencia).where(eq(evidencia.id, params.id));
  return NextResponse.json({ ok: true });
}
