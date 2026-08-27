import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, bitacora, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { expedientePDF, type ArchivoConBytes } from "@/lib/pdf";

// Arma el PDF de expediente completo de un caso (carátula + cotejo + evidencia
// documental). Lo comparten el botón "Expediente PDF" (api/expediente-pdf) y
// el botón "Adjuntar expediente" del mail (api/mail/enviar), para no repetir
// dos veces la lógica de traer evidencia + bitácora + bajar los archivos.
export async function construirExpedientePDF(siniestroId: string): Promise<{ siniestro: SiniestroRow; bytes: Uint8Array } | null> {
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

  const bytes = await expedientePDF(s, archivos, notas);
  return { siniestro: s, bytes };
}
