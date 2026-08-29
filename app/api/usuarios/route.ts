import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { asegurarColumnaGmailConexionUsuario } from "@/lib/db/asegurar-usuario-gmail-conexion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ usuarios: [] });
  await asegurarColumnaGmailConexionUsuario();
  const db = getDb();
  const rows = await db.select({
    id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre,
    rol: usuarios.rol, operador: usuarios.operador, activo: usuarios.activo, creadoEn: usuarios.creadoEn,
    gmailConexionId: usuarios.gmailConexionId,
  }).from(usuarios).orderBy(usuarios.creadoEn);
  return NextResponse.json({ usuarios: rows });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const nombre = typeof body?.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : username;
  const rol = body?.rol === "admin" ? "admin" : "vendedor";
  const operador = typeof body?.operador === "string" && body.operador.trim() ? body.operador.trim().toUpperCase() : null;
  const gmailConexionId = typeof body?.gmailConexionId === "string" && body.gmailConexionId ? body.gmailConexionId : null;

  if (!username || password.length < 6) {
    return NextResponse.json({ error: "Usuario requerido y contraseña de al menos 6 caracteres." }, { status: 400 });
  }
  if (rol === "vendedor" && !operador) {
    return NextResponse.json({ error: "Falta el código de operador vinculado a esta cuenta (define qué casos ve)." }, { status: 400 });
  }

  await asegurarColumnaGmailConexionUsuario();
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [row] = await db.insert(usuarios)
      .values({ username, passwordHash, nombre, rol, operador: rol === "admin" ? null : operador, activo: true, gmailConexionId })
      .returning({ id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre, rol: usuarios.rol, operador: usuarios.operador, activo: usuarios.activo, gmailConexionId: usuarios.gmailConexionId });
    return NextResponse.json({ usuario: row });
  } catch {
    return NextResponse.json({ error: "Ese usuario ya existe." }, { status: 409 });
  }
}
