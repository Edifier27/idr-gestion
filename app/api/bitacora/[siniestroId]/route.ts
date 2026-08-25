import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { bitacora } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bitacora/:siniestroId -> lista entradas
export async function GET(_req: NextRequest, { params }: { params: { siniestroId: string } }) {
  if (!dbConfigurada()) return NextResponse.json({ entradas: [] });
  const db = getDb();
  const rows = await db.select().from(bitacora)
    .where(eq(bitacora.siniestroId, params.siniestroId))
    .orderBy(desc(bitacora.fecha));
  return NextResponse.json({ entradas: rows });
}

// POST /api/bitacora/:siniestroId  { tipo, nota } -> agrega entrada
export async function POST(req: NextRequest, { params }: { params: { siniestroId: string } }) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const { tipo = "nota", nota } = await req.json();
  if (!nota?.trim()) return NextResponse.json({ error: "La nota no puede estar vacía." }, { status: 400 });
  const db = getDb();
  const [row] = await db.insert(bitacora)
    .values({ siniestroId: params.siniestroId, tipo, nota: nota.trim() })
    .returning();
  return NextResponse.json({ entrada: row }, { status: 201 });
}
