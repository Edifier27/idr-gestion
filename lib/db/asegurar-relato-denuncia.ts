import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega la columna "relato_denuncia" a siniestros si todavía no existe.
export async function asegurarColumnaRelatoDenuncia() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS relato_denuncia text`);
  asegurada = true;
}
