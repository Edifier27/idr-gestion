import { NextResponse } from "next/server";
import { dbConfigurada } from "@/lib/db";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarColumnaDescargo } from "@/lib/db/asegurar-descargo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/migrar — aplica los cambios de esquema pendientes (columnas o
// tablas nuevas) contra la DB real. Todo acá es DDL fijo e idempotente
// (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), sin datos de
// usuario ni efectos destructivos, así que es seguro dejarlo sin auth —
// mismo criterio que /api/setup.
export async function GET() {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  await asegurarTablaEvidencia();
  await asegurarColumnaDescargo();
  return NextResponse.json({ ok: true });
}
