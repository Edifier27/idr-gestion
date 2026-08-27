import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { calcularFacturacion } from "@/lib/facturacion";
import { sesionRequerida, puedeVerCaso, puedeVerFacturacion, ocultarFacturacion } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [row] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, row.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const siniestro = puedeVerFacturacion(session) ? row : ocultarFacturacion(row);
  return NextResponse.json({ siniestro });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [actual] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!actual) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, actual.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const body = await req.json();
  const verFacturacion = puedeVerFacturacion(session);

  const patch: Record<string, unknown> = { actualizadoEn: new Date() };
  const campos = verFacturacion
    ? ["estado","resultado","numero_fc","gasto_fijo","operador","km_total","fecha_limite","estado_cobro","informe","informe_final","descargo","relato_denuncia"]
    : ["estado","resultado","operador","fecha_limite","informe","descargo","relato_denuncia"];
  const colMap: Record<string,string> = {
    estado:"estado", resultado:"resultado", numero_fc:"numeroFc",
    gasto_fijo:"gastoFijo", operador:"operador", km_total:"kmTotal",
    fecha_limite:"fechaLimite", estado_cobro:"estadoCobro", informe:"informe",
    informe_final:"informeFinal", descargo:"descargo", relato_denuncia:"relatoDenuncia"
  };
  for (const k of campos) { if (k in body) patch[colMap[k]] = body[k]; }
  if (verFacturacion && "km_total" in body) patch.facturar = calcularFacturacion(body.km_total);
  const [row] = await db.update(siniestros).set(patch).where(eq(siniestros.id, params.id)).returning();
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  const siniestro = verFacturacion ? row : ocultarFacturacion(row);
  return NextResponse.json({ siniestro });
}
