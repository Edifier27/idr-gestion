import { eq, and } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";

// Todos los operadores activos (usuarios con rol "vendedor" = "Operador" en
// la UI), para poblar selects/filtros/sugerencias. A diferencia de
// derivarlos de los siniestros existentes (como se hacía antes en varios
// lugares), esto muestra a un operador recién creado aunque todavía no
// tenga ningún caso asignado — Dario reportó que en el filtro del tablero
// faltaban operadores nuevos (ej. "Nacho") porque no tenían casos aún.
export async function listarOperadoresActivos(): Promise<string[]> {
  if (!dbConfigurada()) return [];
  const filas = await getDb().select({ operador: usuarios.operador })
    .from(usuarios)
    .where(and(eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)));
  return Array.from(new Set(filas.map(f => f.operador).filter((v): v is string => !!v))).sort();
}
