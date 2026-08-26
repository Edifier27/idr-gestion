import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Crea la tabla "evidencia" si todavía no existe. Se llama al principio de
// cada ruta que la toca; con el flag en memoria evita repetir el CREATE TABLE
// en cada request dentro de la misma instancia serverless.
export async function asegurarTablaEvidencia() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS evidencia (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      siniestro_id uuid NOT NULL,
      nombre text NOT NULL,
      url text NOT NULL,
      tipo text NOT NULL,
      tamano integer,
      categoria text,
      subido_por text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS categoria text`);
  asegurada = true;
}
