import type { Session } from "next-auth";
import { auth } from "@/auth";

export type Sesion = Session;

export async function sesionRequerida(): Promise<Sesion | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

// Un admin ve cualquier caso; un operador solo el suyo (operador vinculado a su cuenta).
export function puedeVerCaso(session: Sesion, operador: string | null) {
  return session.user.rol === "admin" || session.user.operador === operador;
}

// Datos de facturación (monto a facturar, estado de cobro, N° de factura, km,
// factura en PDF) son solo para el admin. El operador gestiona el caso pero no
// ve ni toca esa parte.
export function puedeVerFacturacion(session: Sesion) {
  return session.user.rol === "admin";
}

const CAMPOS_FACTURACION = ["kmTotal", "facturar", "numeroFc", "gastoFijo", "estadoCobro"] as const;

// Saca los campos de facturación de un registro (o de una lista) antes de
// devolverlo en una respuesta a alguien que no puede verlos.
export function ocultarFacturacion<T extends Record<string, unknown>>(row: T): T {
  const limpio = { ...row };
  for (const campo of CAMPOS_FACTURACION) delete (limpio as Record<string, unknown>)[campo];
  return limpio;
}
