import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datoExtra, siniestros } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function casoDelDato(db: ReturnType<typeof getDb>, id: string) {
  const [dato] = await db.select().from(datoExtra).where(eq(datoExtra.id, id));
  if (!dato) return null;
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, dato.siniestroId));
  return caso ? { dato, caso } : null;
}

// PATCH /api/dato-extra/[id] { valor } — corrige el valor de un dato ya
// cargado, sin tener que borrarlo y volver a cargarlo.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getDb();
  const encontrado = await casoDelDato(db, params.id);
  if (!encontrado) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, encontrado.caso.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const valor = typeof body?.valor === "string" ? body.valor.trim() : "";
  if (!valor) return NextResponse.json({ error: "Falta el valor." }, { status: 400 });

  const [row] = await db.update(datoExtra).set({ valor }).where(eq(datoExtra.id, params.id)).returning();
  return NextResponse.json({ dato: row });
}

// DELETE /api/dato-extra/[id] — saca un dato libre agregado por error.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getDb();
  const encontrado = await casoDelDato(db, params.id);
  if (!encontrado) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, encontrado.caso.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  await db.delete(datoExtra).where(eq(datoExtra.id, params.id));
  return NextResponse.json({ ok: true });
}
