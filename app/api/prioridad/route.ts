import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { sesionRequerida } from "@/lib/acceso";
import { getDb, dbConfigurada } from "@/lib/db";
import { asegurarTablaPrioridad } from "@/lib/db/asegurar-prioridad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/prioridad { ids: [...] } — solo admin. Guarda el orden en que el
// operador tiene que trabajar esos casos (el primero de la lista = 1).
export async function PUT(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin ordena los casos." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 300) : [];
  await asegurarTablaPrioridad();
  const db = getDb();
  for (let i = 0; i < ids.length; i++) {
    await db.execute(sql`
      INSERT INTO prioridad_caso (siniestro_id, orden, actualizado_en) VALUES (${ids[i]}, ${i + 1}, now())
      ON CONFLICT (siniestro_id) DO UPDATE SET orden = EXCLUDED.orden, actualizado_en = now()
    `);
  }
  return NextResponse.json({ ok: true });
}
