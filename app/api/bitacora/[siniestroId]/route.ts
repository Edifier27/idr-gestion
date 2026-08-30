import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { bitacora, siniestros } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso, esAdmin } from "@/lib/acceso";

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
  // "devolucion" (pedido de corrección) solo la escribe el admin; "pedido_ayuda"
  // solo el operador — no tiene sentido al revés, y evita que alguien la use
  // para spamear al otro lado con el tipo equivocado.
  if (tipo === "devolucion" && !esAdmin(session)) return NextResponse.json({ error: "Solo el admin puede pedir una corrección." }, { status: 403 });
  if (tipo === "pedido_ayuda" && esAdmin(session)) return NextResponse.json({ error: "El pedido de ayuda es para el operador." }, { status: 403 });
  const [row] = await db.insert(bitacora)
    .values({
      siniestroId: params.siniestroId, tipo, nota: nota.trim(),
      autor: session.user.name ?? session.user.username,
      autorEsAdmin: esAdmin(session),
      leida: false,
    })
    .returning();
  return NextResponse.json({ entrada: row }, { status: 201 });
}
