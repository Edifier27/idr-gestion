import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usuarios, bitacora, type SiniestroRow } from "@/lib/db/schema";
import { enviarMail } from "@/lib/gmail";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";

// Aviso automático por mail al operador cuando se le asigna un caso (al
// crearlo o al reasignarlo) — así no se entera solo si entra al tablero.
// Sale desde la casilla Gmail del admin que asigna. Nunca tira error: si no
// hay mail conectado o el operador no tiene mail cargado, no pasa nada (la
// asignación en sí ya está guardada).
export async function avisarAsignacion(caso: SiniestroRow, operador: string, conexionId: string | undefined) {
  try {
    await asegurarColumnasComunicacion();
    const db = getDb();
    const [op] = await db.select({ nombre: usuarios.nombre, email: usuarios.email })
      .from(usuarios)
      .where(and(eq(usuarios.operador, operador), eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)));
    if (!op?.email) return;
    const nombre = caso.asegurado ?? caso.denunciante ?? "sin nombre";
    const cuerpo = [
      `Hola ${op.nombre},`,
      "",
      "Te asignaron un caso nuevo en IDR Gestión:",
      "",
      `Asegurado: ${nombre}`,
      `DNI: ${caso.dni ?? "—"}`,
      `N° Siniestro: ${caso.nroSiniestro ?? "—"}`,
      `Tipo: ${caso.tipo ?? "—"}`,
      `Compañía: ${caso.compania ?? "—"}`,
      "",
      `Entrá a verlo: https://idrgestion.com.ar/siniestros/${caso.id}`,
      "",
      "— IDR Gestión",
    ].join("\n");
    await enviarMail({ para: op.email, asunto: `Nuevo caso asignado — ${nombre}`, cuerpo, adjuntos: [], conexionId });
    await db.insert(bitacora).values({
      siniestroId: caso.id, tipo: "mail",
      nota: `Aviso automático de asignación enviado a ${op.email}.`,
    });
  } catch {
    // no bloquea la asignación si el mail falla
  }
}
