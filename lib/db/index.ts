import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Conexión perezosa: no se conecta en build-time. Si falta DATABASE_URL,
// tira un error claro recién cuando una ruta intenta usar la base.
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está configurada. Creá una base gratis en neon.tech y pegá el connection string en .env"
    );
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}

export function dbConfigurada() {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
