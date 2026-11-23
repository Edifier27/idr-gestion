import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora, evidencia } from "@/lib/db/schema";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente } from "@/lib/categorias-evidencia";
import { generarInforme } from "@/lib/informe";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/informe  { siniestroId } -> genera informe técnico-legal con IA y lo guarda
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  try {
    const { siniestroId } = await req.json();
    const db = getDb();
    const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
    if (!s) return NextResponse.json({ error: "Siniestro no encontrado." }, { status: 404 });
    if (!puedeVerCaso(session, s.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

    // Trae las notas de bitácora para darle contexto a la IA
    const notas = await db.select().from(bitacora).where(eq(bitacora.siniestroId, siniestroId));
    const textoNotas = notas.map((n) => `[${n.tipo}] ${n.nota}`);

    const lectura = await leerLecturaDenuncia(s.id);
    // Qué pruebas hay y cuáles pide el ramo, para que sugiera las que faltan.
    const ramo = ramoDeTipo(s.tipo);
    const archivos = await db.select({ categoria: evidencia.categoria }).from(evidencia).where(eq(evidencia.siniestroId, siniestroId)).catch(() => []);
    const cargadas = Array.from(new Set(archivos.map(a => etiquetaCategoriaEvidencia(a.categoria, ramo))));
    const delRamo = seccionesExpediente(ramo).filter(x => x.id !== "otros").flatMap(x => x.categorias)
      .map(c => etiquetaCategoriaEvidencia(c, ramo));
    const informeTexto = await generarInforme(s, textoNotas, lectura, { cargadas, delRamo });
    const [updated] = await db.update(siniestros)
      .set({ informe: informeTexto, actualizadoEn: new Date() })
      .where(eq(siniestros.id, siniestroId))
      .returning();

    return NextResponse.json({ informe: informeTexto, siniestro: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar el informe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
