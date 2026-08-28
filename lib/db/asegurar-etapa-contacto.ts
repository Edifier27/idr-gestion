import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega las columnas del seguimiento operativo (etapa_contacto,
// fecha_entrevista, motivo_contacto) a siniestros si todavía no existen.
export async function asegurarColumnasEtapaContacto() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS etapa_contacto text`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS fecha_entrevista timestamptz`);
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS motivo_contacto text`);
  asegurada = true;
}
