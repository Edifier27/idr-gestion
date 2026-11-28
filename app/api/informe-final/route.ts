import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora } from "@/lib/db/schema";
import { generarInformeFinal, resumirInforme, ordenarAnexo, RESOLUCIONES } from "@/lib/informe-final";
import { evidencia } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { sesionRequerida, puedeVerCaso, puedeVerInformeFinal } from "@/lib/acceso";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";

export const runtime = "nodejs";
export const maxDuration = 800; // mira todas las pruebas y puede reintentar: sigue en el servidor aunque se cierre la página

// Si quedó "generando" más que esto, la ejecución se cortó: se puede volver a pedir.
const VENCE_MS = 14 * 60_000;

type Estado = { estado: string | null; inicio: string | null; error: string | null; paso: string | null; informeFinal: string | null; resumen: unknown };

async function leerEstado(id: string): Promise<Estado | null> {
  const r = await getDb().execute(sql`
    SELECT informe_final_estado AS estado, informe_final_inicio AS inicio, informe_final_error AS error, informe_final_paso AS paso, informe_final AS "informeFinal", informe_final_resumen AS resumen
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
  const { siniestroId, resolucion } = await req.json().catch(() => ({}));
  const decision = typeof resolucion === "string" && RESOLUCIONES[resolucion] ? resolucion : "ia";
  const a = await autorizar(String(siniestroId ?? ""));
  if ("error" in a) return a.error;
  const s = a.s;
  await asegurarEstadoInformeFinal();
  const db = getDb();

  // Una sola generación a la vez por caso.
  const tomada = await db.execute(sql`
    UPDATE siniestros SET informe_final_estado = 'generando', informe_final_inicio = now(), informe_final_error = NULL, informe_final_fin = NULL, informe_final_paso = 'Arrancando…'
    WHERE id = ${s.id} AND (informe_final_estado IS DISTINCT FROM 'generando' OR informe_final_inicio < now() - make_interval(secs => ${VENCE_MS / 1000}))
    RETURNING id`);
  if (!tomada.rows.length) return NextResponse.json(await leerEstado(s.id), { status: 202 });

  waitUntil((async () => {
    try {
      const notas = await db.select().from(bitacora).where(eq(bitacora.siniestroId, s.id));
      const lectura = await leerLecturaDenuncia(s.id);
      // Lo que va haciendo se guarda en el caso (como mucho cada 3 s, salvo
      // cambios de etapa) para mostrarlo en la tarjeta y en el indicador.
      let ultimo = 0, ultimoTexto = "";
      const informarPaso = (texto: string, forzar = false) => {
        const ahora = Date.now();
        if (texto === ultimoTexto || (!forzar && ahora - ultimo < 3000)) return;
        ultimo = ahora; ultimoTexto = texto;
        db.execute(sql`UPDATE siniestros SET informe_final_paso = ${texto} WHERE id = ${s.id} AND informe_final_estado = 'generando'`).catch(() => {});
      };
      informarPaso("Leyendo la denuncia y el chat del caso", true);
      const { texto: informeTexto, archivos } = await generarInformeFinal(s, notas.map((n) => `[${n.tipo}] ${n.nota}`), lectura, informarPaso, decision);
      informarPaso("Ordenando las pruebas del legajo según el relato", true);
      const filas = await db.select({ id: evidencia.id, nombre: evidencia.nombre, categoria: evidencia.categoria }).from(evidencia).where(eq(evidencia.siniestroId, s.id)).orderBy(asc(evidencia.creadoEn));
      const numero = new Map(archivos.map(a => [a.id, a.n]));
      const anexo = await ordenarAnexo(informeTexto, filas.filter(f => !/^(caratula|certif)/i.test(f.nombre)).map(f => ({ ...f, n: numero.get(f.id) ?? null }))).catch(() => []);
      informarPaso("Armando el informe resumido", true);
      const resumen = await resumirInforme(informeTexto).catch(() => null);
      await db.execute(sql`
        UPDATE siniestros SET informe_final = ${informeTexto}, informe_final_resumen = ${resumen ? JSON.stringify(resumen) : null}::jsonb, informe_final_anexo = ${anexo.length ? JSON.stringify(anexo) : null}::jsonb, informe_final_resolucion = ${decision === "ia" ? null : decision}, informe_final_estado = 'listo', informe_final_error = NULL, informe_final_fin = now(), informe_final_paso = NULL, actualizado_en = now()
        WHERE id = ${s.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar la resolución final.";
      await db.execute(sql`UPDATE siniestros SET informe_final_estado = 'error', informe_final_error = ${message}, informe_final_fin = now(), informe_final_paso = NULL WHERE id = ${s.id}`).catch(() => {});
    }
  })());

  return NextResponse.json({ estado: "generando", inicio: new Date().toISOString(), error: null, informeFinal: s.informeFinal }, { status: 202 });
}
