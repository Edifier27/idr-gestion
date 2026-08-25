import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega la columna "descargo" a siniestros si todavía no existe. Solo hace
// falta correr esto una vez contra la DB real (ALTER TABLE es permanente);
// el flag en memoria evita repetirlo en cada request de una misma instancia.
export async function asegurarColumnaDescargo() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS descargo text`);
  asegurada = true;
}
