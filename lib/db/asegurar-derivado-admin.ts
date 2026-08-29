import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega las columnas de derivación al admin (derivado_admin, derivado_en) a
// siniestros si todavía no existen — el operador las usa para devolverle el
// trámite al admin cuando no logra contactar al denunciante.
export async function asegurarColumnasDerivadoAdmin() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS derivado_admin boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS derivado_en timestamptz`);
  asegurada = true;
}
