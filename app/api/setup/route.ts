import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bootstrap de un solo uso: crea la tabla "usuarios" si no existe y,
// si todavía no hay ningún usuario cargado, permite crear el primer admin.
// Se autodeshabilita apenas existe un usuario (ver GET).
async function asegurarTabla() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      nombre text NOT NULL,
      rol text NOT NULL DEFAULT 'vendedor',
      operador text,
      activo boolean NOT NULL DEFAULT true,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function GET() {
  if (!dbConfigurada()) return NextResponse.json({ disponible: false });
  await asegurarTabla();
  const db = getDb();
  const existentes = await db.select().from(usuarios).limit(1);
  return NextResponse.json({ disponible: existentes.length === 0 });
}

export async function POST(req: NextRequest) {
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  await asegurarTabla();
  const db = getDb();

  const existentes = await db.select().from(usuarios).limit(1);
  if (existentes.length > 0) {
    return NextResponse.json({ error: "Ya existe un administrador. Andá a /login." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const nombre = typeof body?.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : username;

  if (!username || password.length < 6) {
    return NextResponse.json({ error: "Usuario requerido y contraseña de al menos 6 caracteres." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usuarios).values({ username, passwordHash, nombre, rol: "admin", operador: null, activo: true });

  return NextResponse.json({ ok: true });
}
