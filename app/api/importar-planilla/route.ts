import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida } from "@/lib/acceso";
import { dbConfigurada } from "@/lib/db";
import { leerPlanilla, clasificarFilas, importarFilas } from "@/lib/importar-planilla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/importar-planilla — solo admin. multipart con "archivo" (xlsx) y
// "modo": "vista" (lee y muestra qué se cargaría, sin tocar la base) o
// "importar" (crea los casos que no existan y actualiza los operadores).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin puede importar planillas." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });

  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo de Excel." }, { status: 400 });

  try {
    const { filas, avisos } = leerPlanilla(await archivo.arrayBuffer());
    if (filas.length === 0) return NextResponse.json({ error: "No encontré casos en la planilla (falta la columna EXPT)." }, { status: 400 });

    if (form?.get("modo") !== "importar") {
      const { nuevas, repetidas } = await clasificarFilas(filas);
      return NextResponse.json({ filas: nuevas, repetidas: repetidas.map(f => f.nroSiniestro), avisos });
    }
    const resultado = await importarFilas(filas);
    return NextResponse.json({ ...resultado, avisos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al importar la planilla.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
