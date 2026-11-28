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
  asegurada = true;
}
