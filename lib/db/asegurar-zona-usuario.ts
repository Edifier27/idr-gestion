import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Zona de trabajo de cada operador (ej. "Zona Oeste y Norte CABA").
export async function asegurarColumnaZonaUsuario() {
  if (asegurada) return;
  await getDb().execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS zona text`);
  asegurada = true;
}
