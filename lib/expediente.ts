import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, bitacora, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { expedientePDF, type ArchivoConBytes } from "@/lib/pdf";
import { leerLecturaDenuncia } from "@/lib/leer-denuncia";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";

// Arma el PDF de expediente completo de un caso (carátula + cotejo + evidencia
// documental). Lo comparten el botón "Expediente PDF" (api/expediente-pdf) y
// el botón "Adjuntar expediente" del mail (api/mail/enviar), para no repetir
// dos veces la lógica de traer evidencia + bitácora + bajar los archivos.
// conInformeFinal: solo para el admin (el informe final no lo ve el operador).
export async function construirExpedientePDF(siniestroId: string, conInformeFinal = false): Promise<{ siniestro: SiniestroRow; bytes: Uint8Array } | null> {
  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!s) return null;

  await asegurarTablaEvidencia();
  const rows = await db.select().from(evidencia).where(eq(evidencia.siniestroId, siniestroId));
  const notas = await db.select().from(bitacora).where(eq(bitacora.siniestroId, siniestroId));

  const archivos: ArchivoConBytes[] = await Promise.all(rows.map(async row => {
    try {
      const res = await fetch(row.url);
      if (!res.ok) return { row, bytes: null };
      return { row, bytes: new Uint8Array(await res.arrayBuffer()) };
    } catch {
      return { row, bytes: null };
    }
  }));

  const lectura = await leerLecturaDenuncia(siniestroId);
  // Orden de las pruebas según el relato y resolución elegida (los guarda el informe final).
  let opciones: { anexo?: { id: string; titulo: string }[]; resolucion?: string | null } = {};
  try {
    await asegurarEstadoInformeFinal();
    const r = (await db.execute(sql`SELECT informe_final_anexo AS anexo, informe_final_resolucion AS resolucion FROM siniestros WHERE id = ${siniestroId}`)).rows[0] as { anexo: { id: string; titulo: string }[] | null; resolucion: string | null } | undefined;
    opciones = { anexo: conInformeFinal ? r?.anexo ?? undefined : undefined, resolucion: r?.resolucion ?? null };
  } catch { /* sin esos datos sale con el orden del modelo */ }
  const bytes = await expedientePDF(s, archivos, notas, lectura, conInformeFinal, opciones);
  return { siniestro: s, bytes };
}
