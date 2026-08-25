import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { calcularKmRecorrido } from "@/lib/km";
import { calcularFacturacion } from "@/lib/facturacion";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/km  { siniestroId } -> calcula km con Maps y actualiza facturación
export async function POST(req: NextRequest) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  try {
    const { siniestroId } = await req.json();
    const db = getDb();
    const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
    if (!s) return NextResponse.json({ error: "Siniestro no encontrado." }, { status: 404 });

    const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
    const lugarHecho = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(", ");
    if (!s.domicilio || !lugarHecho) {
      return NextResponse.json({ error: "Faltan domicilio o lugar del hecho para calcular km." }, { status: 400 });
    }

    const kmTotal = await calcularKmRecorrido(s.domicilio, lugarHecho);
    const facturar = calcularFacturacion(kmTotal);
    const [updated] = await db.update(siniestros)
      .set({ kmTotal, facturar, actualizadoEn: new Date() })
      .where(eq(siniestros.id, siniestroId))
      .returning();

    return NextResponse.json({ kmTotal, facturar, siniestro: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al calcular km.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
