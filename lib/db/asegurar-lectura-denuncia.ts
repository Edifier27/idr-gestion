import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Lo que la IA leyó de la denuncia policial y la ampliación de cada caso
// (tabla aparte, no columna de siniestros: así ningún select de siniestros
// depende de que esta migración haya corrido).
export async function asegurarTablaLecturaDenuncia() {
  if (asegurada) return;
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS lectura_denuncia (
      siniestro_id uuid PRIMARY KEY,
      datos jsonb NOT NULL,
      leido_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  asegurada = true;
}
