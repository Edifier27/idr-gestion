import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { calcularFacturacion } from "@/lib/facturacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [row] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  return NextResponse.json({ siniestro: row });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const body = await req.json();
  const patch: Record<string, unknown> = { actualizadoEn: new Date() };
  const campos = ["estado","resultado","numero_fc","gasto_fijo","operador","km_total","fecha_limite","estado_cobro","informe"];
  const colMap: Record<string,string> = {
    estado:"estado", resultado:"resultado", numero_fc:"numeroFc",
    gasto_fijo:"gastoFijo", operador:"operador", km_total:"kmTotal",
    fecha_limite:"fechaLimite", estado_cobro:"estadoCobro", informe:"informe"
  };
  for (const k of campos) { if (k in body) patch[colMap[k]] = body[k]; }
  if ("km_total" in body) patch.facturar = calcularFacturacion(body.km_total);
  const db = getDb();
  const [row] = await db.update(siniestros).set(patch).where(eq(siniestros.id, params.id)).returning();
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  return NextResponse.json({ siniestro: row });
}
