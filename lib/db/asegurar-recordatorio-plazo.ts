import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega recordatorio_plazo_enviado_en a siniestros si todavía no existe:
// marca el momento en que se le mandó al operador el mail automático de
// "se te acerca el vencimiento del informe" (ver app/api/recordatorio-plazo/
// route.ts, disparado por el Cron de vercel.json) — para no mandarlo dos
// veces por el mismo caso.
export async function asegurarColumnaRecordatorioPlazo() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS recordatorio_plazo_enviado_en timestamptz`);
  asegurada = true;
}
