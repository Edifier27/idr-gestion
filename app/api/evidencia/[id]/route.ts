import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { CATEGORIAS_EVIDENCIA } from "@/lib/categorias-evidencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/evidencia/:id — recategoriza un archivo ya subido (arrastrar y
// soltar una tarjeta de un grupo a otro en el panel de evidencia, sin tener
// que borrarlo y volver a subirlo con la categoría correcta).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const body = await req.json().catch(() => null);
  if (!body || !("categoria" in body)) {
    return NextResponse.json({ error: "Falta la categoría." }, { status: 400 });
  }
  const categoria: string | null = body.categoria ? String(body.categoria) : null;
  if (categoria !== null && !CATEGORIAS_EVIDENCIA.some(c => c.value === categoria)) {
    return NextResponse.json({ error: "Categoría inválida." }, { status: 400 });
  }

  const [actualizado] = await db.update(evidencia).set({ categoria }).where(eq(evidencia.id, params.id)).returning();
  return NextResponse.json({ archivo: actualizado });
}

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
