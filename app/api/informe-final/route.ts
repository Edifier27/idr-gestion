import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora } from "@/lib/db/schema";
import { generarInformeFinal } from "@/lib/informe-final";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { sesionRequerida, puedeVerCaso, puedeVerInformeFinal } from "@/lib/acceso";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";

export const runtime = "nodejs";
export const maxDuration = 800; // mira todas las pruebas y puede reintentar: sigue en el servidor aunque se cierre la página

// Si quedó "generando" más que esto, la ejecución se cortó: se puede volver a pedir.
const VENCE_MS = 14 * 60_000;

type Estado = { estado: string | null; inicio: string | null; error: string | null; informeFinal: string | null };

async function leerEstado(id: string): Promise<Estado | null> {
  const r = await getDb().execute(sql`
    SELECT informe_final_estado AS estado, informe_final_inicio AS inicio, informe_final_error AS error, informe_final AS "informeFinal"
    FROM siniestros WHERE id = ${id}`);
  const e = (r.rows as Estado[])[0];
  if (!e) return null;
  if (e.estado === "generando" && e.inicio && Date.now() - new Date(e.inicio).getTime() > VENCE_MS) {
    return { ...e, estado: "error", error: "La generación se cortó. Probá de nuevo." };
  }
  return e;
}

async function autorizar(siniestroId: string) {
  const session = await sesionRequerida();
  if (!session) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  if (!puedeVerInformeFinal(session)) return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  if (!dbConfigurada()) return { error: NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 }) };
  const [s] = await getDb().select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!s) return { error: NextResponse.json({ error: "Siniestro no encontrado." }, { status: 404 }) };
  if (!puedeVerCaso(session, s.operador)) return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  return { s };
}

// GET /api/informe-final?id=… -> en qué está la generación (para seguirla
// aunque el admin haya salido y vuelto a la página).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const a = await autorizar(id);
  if ("error" in a) return a.error;
  await asegurarEstadoInformeFinal();
  return NextResponse.json(await leerEstado(id));
}

// POST /api/informe-final { siniestroId } -> arranca la resolución final con IA
// en el servidor (solo admin: el operador no la ve) y contesta enseguida.
export async function POST(req: NextRequest) {
  const { siniestroId } = await req.json().catch(() => ({}));
  const a = await autorizar(String(siniestroId ?? ""));
  if ("error" in a) return a.error;
  const s = a.s;
  await asegurarEstadoInformeFinal();
  const db = getDb();

  // Una sola generación a la vez por caso.
  const tomada = await db.execute(sql`
    UPDATE siniestros SET informe_final_estado = 'generando', informe_final_inicio = now(), informe_final_error = NULL
    WHERE id = ${s.id} AND (informe_final_estado IS DISTINCT FROM 'generando' OR informe_final_inicio < now() - make_interval(secs => ${VENCE_MS / 1000}))
    RETURNING id`);
  if (!tomada.rows.length) return NextResponse.json(await leerEstado(s.id), { status: 202 });

  waitUntil((async () => {
    try {
      const notas = await db.select().from(bitacora).where(eq(bitacora.siniestroId, s.id));
      const lectura = await leerLecturaDenuncia(s.id);
      const informeTexto = await generarInformeFinal(s, notas.map((n) => `[${n.tipo}] ${n.nota}`), lectura);
      await db.execute(sql`
        UPDATE siniestros SET informe_final = ${informeTexto}, informe_final_estado = 'listo', informe_final_error = NULL, actualizado_en = now()
        WHERE id = ${s.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar la resolución final.";
      await db.execute(sql`UPDATE siniestros SET informe_final_estado = 'error', informe_final_error = ${message} WHERE id = ${s.id}`).catch(() => {});
    }
  })());

  return NextResponse.json({ estado: "generando", inicio: new Date().toISOString(), error: null, informeFinal: s.informeFinal }, { status: 202 });
}
