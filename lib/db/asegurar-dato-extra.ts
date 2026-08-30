import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Crea la tabla dato_extra si todavía no existe — datos libres (etiqueta +
// valor) que el admin agrega a un caso puntual cuando la IA no capturó algo
// del PDF y no hay un campo fijo para eso en "siniestros".
export async function asegurarTablaDatoExtra() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dato_extra (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      siniestro_id uuid NOT NULL,
      etiqueta text NOT NULL,
      valor text NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  asegurada = true;
}
