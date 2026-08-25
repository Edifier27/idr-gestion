import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { bitacora, siniestros } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bitacora/:siniestroId -> lista entradas
export async function GET(_req: NextRequest, { params }: { params: { siniestroId: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ entradas: [] });
  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, params.siniestroId));
  if (!caso) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, caso.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const rows = await db.select().from(bitacora)
    .where(eq(bitacora.siniestroId, params.siniestroId))
    .orderBy(desc(bitacora.fecha));
  return NextResponse.json({ entradas: rows });
}

// POST /api/bitacora/:siniestroId  { tipo, nota } -> agrega entrada
export async function POST(req: NextRequest, { params }: { params: { siniestroId: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, params.siniestroId));
  if (!caso) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, caso.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { tipo = "nota", nota } = await req.json();
  if (!nota?.trim()) return NextResponse.json({ error: "La nota no puede estar vacía." }, { status: 400 });
  const [row] = await db.insert(bitacora)
    .values({ siniestroId: params.siniestroId, tipo, nota: nota.trim() })
    .returning();
  return NextResponse.json({ entrada: row }, { status: 201 });
}
