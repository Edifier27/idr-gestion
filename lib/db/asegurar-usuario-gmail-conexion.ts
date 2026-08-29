import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega la columna "gmail_conexion_id" a usuarios si todavía no existe —
// vincula a cada operador con la casilla de gmail_conexion que le corresponde.
export async function asegurarColumnaGmailConexionUsuario() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS gmail_conexion_id uuid`);
  asegurada = true;
}
