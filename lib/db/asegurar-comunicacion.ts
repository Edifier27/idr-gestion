import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

let asegurada = false;

// Agrega lo necesario para que la bitácora funcione como canal de
// comunicación admin↔operador (autor/autor_es_admin/leida) y el mail del
// operador en usuarios (para el aviso automático al asignarle un caso), si
// todavía no existen.
export async function asegurarColumnasComunicacion() {
  if (asegurada) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE bitacora ADD COLUMN IF NOT EXISTS autor text`);
  await db.execute(sql`ALTER TABLE bitacora ADD COLUMN IF NOT EXISTS autor_es_admin boolean`);
  // OJO con el orden: agregar la columna con DEFAULT false la backfillea en
  // false para TODAS las filas existentes (quedarían "sin leer" de golpe) —
  // el UPDATE de acá abajo las marca leídas: solo lo nuevo, a partir de
  // ahora, arranca sin leer de verdad.
  await db.execute(sql`ALTER TABLE bitacora ADD COLUMN IF NOT EXISTS leida boolean NOT NULL DEFAULT false`);
  await db.execute(sql`UPDATE bitacora SET leida = true WHERE autor IS NULL AND autor_es_admin IS NULL`);
  await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`);
  asegurada = true;
}
