import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

export async function asegurarTablasGmail() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS gmail_conexion (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      refresh_token text NOT NULL,
      conectado_por text,
      conectado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mail_enviado (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      siniestro_id uuid NOT NULL,
      para text NOT NULL,
      asunto text NOT NULL,
      enviado_por text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  asegurada = true;
}
