import type { Session } from "next-auth";
import { auth } from "@/auth";

export type Sesion = Session;

export async function sesionRequerida(): Promise<Sesion | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

export function esAdmin(session: Sesion) {
  return session.user.rol === "admin";
}

// Un admin ve cualquier caso; un operador solo el suyo (operador vinculado a su cuenta).
export function puedeVerCaso(session: Sesion, operador: string | null) {
  return esAdmin(session) || session.user.operador === operador;
}

// Datos de facturación (monto a facturar, estado de cobro, N° de factura, km,
// factura en PDF) son solo para el admin. El operador gestiona el caso pero no
// ve ni toca esa parte.
export function puedeVerFacturacion(session: Sesion) {
  return esAdmin(session);
}

// El informe final (la resolución que arma el admin) es privado: el operador
// tiene su propia herramienta de IA para armar SU informe (campo "informe",
// visible para los dos), pero no ve la versión final del admin.
export function puedeVerInformeFinal(session: Sesion) {
  return esAdmin(session);
}

// El mail queda solo para el admin: es quien recibe los casos de las
// aseguradoras. El operador trabaja todo desde el CRM (recibe el caso ya
// cargado, y cuando termina su parte lo marca "informe enviado" — no manda
// mail él). Por eso esta función ya no resuelve una casilla para operadores,
// devuelve directamente el motivo del error.
export function conexionGmailDeSesion(session: Sesion): { conexionId?: string } | { error: string } {
  if (esAdmin(session)) return { conexionId: session.user.gmailConexionId ?? undefined };
  return { error: "El mail está disponible solo para el administrador." };
}

// Facturación (admin-only) + informe_final (admin-only, ver puedeVerInformeFinal).
const CAMPOS_FACTURACION = ["kmTotal", "facturar", "numeroFc", "gastoFijo", "estadoCobro", "informeFinal"] as const;

// Saca los campos que son solo del admin (facturación + informe final) de un
// registro (o de una lista) antes de devolverlo en una respuesta a alguien
// que no puede verlos. El nombre quedó de cuando solo tapaba facturación.
export function ocultarFacturacion<T extends Record<string, unknown>>(row: T): T {
  const limpio = { ...row };
  for (const campo of CAMPOS_FACTURACION) delete (limpio as Record<string, unknown>)[campo];
  return limpio;
}
