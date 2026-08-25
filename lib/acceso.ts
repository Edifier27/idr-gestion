import type { Session } from "next-auth";
import { auth } from "@/auth";

export type Sesion = Session;

export async function sesionRequerida(): Promise<Sesion | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

// Un admin ve cualquier caso; un vendedor solo el suyo (operador vinculado a su cuenta).
export function puedeVerCaso(session: Sesion, operador: string | null) {
  return session.user.rol === "admin" || session.user.operador === operador;
}
