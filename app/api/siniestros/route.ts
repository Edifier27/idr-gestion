import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { calcularFacturacion } from "@/lib/facturacion";
import { sesionRequerida } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/siniestros — lista los siniestros (más nuevos primero).
// Un vendedor solo ve los suyos; el admin los ve todos.
export async function GET() {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ siniestros: [], dbPendiente: true });
  try {
    const db = getDb();
    const todas = await db.select().from(siniestros).orderBy(desc(siniestros.creadoEn));
    const rows = session.user.rol === "admin" ? todas : todas.filter(s => s.operador === session.user.operador);
    return NextResponse.json({ siniestros: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer los siniestros.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/siniestros — crea un siniestro a partir de los datos de la carátula.
// Calcula facturación si viene km_total. Solo el admin da de alta casos a mano
// (el flujo normal va a ser el conector de mail, más adelante).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin puede cargar casos manualmente." }, { status: 403 });
  if (!dbConfigurada()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  }
  try {
    const body = await req.json();
    const kmTotal = body.km_total ?? null;
    const db = getDb();
    const [row] = await db
      .insert(siniestros)
      .values({
        nroSiniestro: body.nro_siniestro ?? null,
        numeroGestion: body.numero_gestion ?? null,
        compania: body.compania ?? null,
        rama: body.rama ?? null,
        tipo: body.tipo ?? null,
        poliza: body.poliza ?? null,
        asegurado: body.asegurado ?? null,
        denunciante: body.denunciante ?? null,
        dni: body.dni ?? null,
        emailContacto: body.email_contacto ?? null,
        telContacto: body.tel_contacto ?? null,
        celContacto: body.cel_contacto ?? null,
        tel: body.tel ?? null,
        domicilio: body.domicilio ?? null,
        estadoOrigen: body.estado_origen ?? null,
        fechaIngreso: body.fecha_ingreso ?? null,
        fechaOcurrencia: body.fecha_ocurrencia ?? null,
        horaOcurrencia: body.hora_ocurrencia ?? null,
        fechaDenuncia: body.fecha_denuncia ?? null,
        lugarSiniestro: body.lugar_siniestro ?? null,
        operador: body.operador ?? null,
        kmTotal,
        facturar: calcularFacturacion(kmTotal),
      })
      .returning();
    return NextResponse.json({ siniestro: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear el siniestro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
