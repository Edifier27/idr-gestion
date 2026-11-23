import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Orden de prioridad que el admin le da a los casos de cada operador (Panel
// de operadores). Tabla aparte: ningún select de siniestros depende de ella.
export async function asegurarTablaPrioridad() {
  if (asegurada) return;
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS prioridad_caso (
      siniestro_id uuid PRIMARY KEY,
      orden integer NOT NULL,
      actualizado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  asegurada = true;
}
