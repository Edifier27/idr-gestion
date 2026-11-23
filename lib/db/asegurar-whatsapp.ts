import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Tablas de la bandeja de WhatsApp (CRMgestion). Van por SQL directo y fuera
// del schema de Drizzle, igual que las demás tablas nuevas: ningún select
// existente depende de que esta migración haya corrido.
export async function asegurarTablasWhatsapp() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wa_evento (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payload jsonb NOT NULL,
      procesado_en timestamptz,
      error text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wa_conversacion (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      telefono text NOT NULL UNIQUE,
      nombre text,
      operador text,
      ultimo_en timestamptz NOT NULL DEFAULT now(),
      ultimo_texto text,
      no_leidos integer NOT NULL DEFAULT 0,
      ventana_hasta timestamptz,
      creado_en timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wa_mensaje (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversacion_id uuid NOT NULL,
      wa_id text UNIQUE,
      direccion text NOT NULL,
      tipo text NOT NULL,
      texto text,
      media_url text,
      media_mime text,
      media_nombre text,
      estado text,
      siniestro_id uuid,
      categoria text,
      evidencia_id uuid,
      asignacion text,
      asignacion_nota text,
      autor text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wa_mensaje_conv ON wa_mensaje (conversacion_id, creado_en)`);
  await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono text`);
  await db.execute(sql`ALTER TABLE wa_mensaje ADD COLUMN IF NOT EXISTS transcripcion text`);
  // Última vez que el Perito IA le habló al operador (guía por tandas).
  await db.execute(sql`ALTER TABLE wa_conversacion ADD COLUMN IF NOT EXISTS guia_en timestamptz`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS resumen_caso (
      siniestro_id uuid PRIMARY KEY,
      datos jsonb NOT NULL,
      evidencias integer NOT NULL DEFAULT 0,
      generado_en timestamptz NOT NULL DEFAULT now()
    )`);
  asegurada = true;
}
