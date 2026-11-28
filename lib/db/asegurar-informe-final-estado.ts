import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Estado de la generación del informe final con IA, que corre en el servidor
// aunque el admin cierre o cambie de página: generando | listo | error.
export async function asegurarEstadoInformeFinal() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_estado text`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_inicio timestamptz`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_error text`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_fin timestamptz`);
  // En qué paso está (lo informa el servidor mientras trabaja): "Bajando las pruebas (3 de 15)", "Redactando · 640 palabras"…
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_paso text`);
  // Versión resumida (veredicto, a favor, en contra, falta, recomendación).
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_resumen jsonb`);
  // Orden y títulos del anexo del legajo en Word ([{ id, titulo }]).
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_anexo jsonb`);
  // Resolución elegida al generar el informe (clasificación del PDF si el resultado sigue pendiente).
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final_resolucion text`);
  asegurada = true;
}

