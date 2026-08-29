import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { asegurarColumnaGmailConexionUsuario } from "@/lib/db/asegurar-usuario-gmail-conexion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (typeof body?.activo === "boolean") patch.activo = body.activo;
  if (typeof body?.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
  if (typeof body?.operador === "string") patch.operador = body.operador.trim().toUpperCase() || null;
  if ("gmailConexionId" in (body ?? {})) patch.gmailConexionId = typeof body.gmailConexionId === "string" && body.gmailConexionId ? body.gmailConexionId : null;
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    patch.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });

  // No permitir que el admin se desactive a si mismo por error y se quede afuera.
  if (params.id === session.user.id && patch.activo === false) {
    return NextResponse.json({ error: "No podés desactivar tu propia cuenta." }, { status: 400 });
  }

  await asegurarColumnaGmailConexionUsuario();
  const db = getDb();
  const [row] = await db.update(usuarios).set(patch).where(eq(usuarios.id, params.id))
    .returning({ id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre, rol: usuarios.rol, operador: usuarios.operador, activo: usuarios.activo, gmailConexionId: usuarios.gmailConexionId });
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  return NextResponse.json({ usuario: row });
}
