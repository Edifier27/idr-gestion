import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega la columna "informe_final" a siniestros si todavía no existe.
export async function asegurarColumnaInformeFinal() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS informe_final text`);
  asegurada = true;
}
