import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega la columna "gmail_mensaje_id" a siniestros si todavía no existe.
export async function asegurarColumnaGmailMensajeId() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS gmail_mensaje_id text`);
  asegurada = true;
}
