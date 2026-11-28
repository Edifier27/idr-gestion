import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { leerTranscripcion, transcribirPrueba } from "@/lib/transcribir-prueba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function pruebaAutorizada(id: string) {
  const session = await sesionRequerida();
  if (!session) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  await asegurarTablaEvidencia();
  const db = getDb();
  const [item] = await db.select().from(evidencia).where(eq(evidencia.id, id));
  if (!item) return { error: NextResponse.json({ error: "No existe." }, { status: 404 }) };
  const [caso] = await db.select({ operador: siniestros.operador }).from(siniestros).where(eq(siniestros.id, item.siniestroId));
  if (!caso || !puedeVerCaso(session, caso.operador)) return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  return { item };
}

// GET /api/evidencia/:id/transcripcion -> el texto ya leído (o null).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await pruebaAutorizada(params.id);
  if ("error" in a) return a.error;
  return NextResponse.json({ transcripcion: await leerTranscripcion(params.id) });
}

// POST /api/evidencia/:id/transcripcion -> la lee con IA y la guarda.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const a = await pruebaAutorizada(params.id);
  if ("error" in a) return a.error;
  try {
    const r = await fetch(a.item.url);
    if (!r.ok) throw new Error("No se pudo bajar el archivo.");
    const texto = await transcribirPrueba(Buffer.from(await r.arrayBuffer()), a.item.tipo, a.item.nombre);
    await getDb().execute(sql`
      INSERT INTO evidencia_transcripcion (evidencia_id, texto) VALUES (${params.id}, ${texto})
      ON CONFLICT (evidencia_id) DO UPDATE SET texto = EXCLUDED.texto, creado_en = now()`);
    return NextResponse.json({ transcripcion: { texto, creado_en: new Date().toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo leer la prueba." }, { status: 500 });
  }
}
