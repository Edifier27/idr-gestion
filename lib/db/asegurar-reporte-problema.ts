import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

export async function asegurarTablaReporteProblema() {
  if (asegurada) return;
  await getDb().execute(sql`
    CREATE TABLE IF NOT EXISTS reporte_problema (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      autor text,
      pagina text,
      descripcion text NOT NULL,
      contexto jsonb,
      respuesta_ia text,
      mail_enviado_a text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
  asegurada = true;
}
