import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega fecha_desistido a siniestros si todavía no existe: el momento
// exacto en que un caso pasa a resultado "desistido" (no alcanza con
// actualizado_en, que se pisa con cualquier otro cambio posterior al
// caso) — la usa el ranking de operadores para poder filtrar por mes.
export async function asegurarColumnaFechaDesistido() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS fecha_desistido timestamptz`);
  asegurada = true;
}
