import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { sesionRequerida, puedeVerInformeFinal } from "@/lib/acceso";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/informe-final/en-curso — informes con IA que se están generando y
// los que terminaron en los últimos 30 minutos (para el indicador que el admin
// ve en cualquier pantalla mientras sigue con otros casos).
export async function GET() {
  const session = await sesionRequerida();
  if (!session || !puedeVerInformeFinal(session)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ informes: [] });
  await asegurarEstadoInformeFinal();
  const r = await getDb().execute(sql`
    SELECT id, nro_siniestro AS nro, COALESCE(asegurado, denunciante) AS asegurado, informe_final_estado AS estado,
           informe_final_inicio AS inicio, informe_final_fin AS fin, informe_final_error AS error, informe_final_paso AS paso
    FROM siniestros
    WHERE informe_final_estado = 'generando'
       OR (informe_final_estado IN ('listo', 'error') AND informe_final_inicio > now() - interval '30 minutes')
    ORDER BY informe_final_inicio DESC LIMIT 30`);
  const vence = Date.now() - 14 * 60_000;
  const informes = (r.rows as { id: string; nro: string | null; asegurado: string | null; estado: string; inicio: string | null; fin: string | null; error: string | null; paso: string | null }[])
    .map(x => (x.estado === "generando" && x.inicio && new Date(x.inicio).getTime() < vence ? { ...x, estado: "error", error: "Se cortó. Probá de nuevo." } : x));
  return NextResponse.json({ informes });
}
