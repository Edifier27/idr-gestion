import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { gmailConexion, usuarios } from "@/lib/db/schema";
import { asegurarColumnaGmailConexionUsuario } from "@/lib/db/asegurar-usuario-gmail-conexion";
import { asegurarTablasGmail } from "@/lib/db/asegurar-gmail";
import { intercambiarCodigo } from "@/lib/gmail";
import { sesionRequerida } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/gmail/callback — Google vuelve acá con ?code=... después de que
// el admin autoriza. Cambia el code por un refresh token y lo guarda.
export async function GET(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(new URL(`/admin/mail?error=${encodeURIComponent(errorParam)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/admin/mail?error=falta_code", req.url));
  }

  try {
    const { refreshToken, email } = await intercambiarCodigo(code, req.nextUrl.origin);
    await asegurarTablasGmail();
    const db = getDb();
    // Reconectar la misma casilla renueva el permiso de la fila que ya
    // existe (en vez de duplicarla), así no se pierde a quién estaba
    // asignada. Y queda asignada a quien la conectó: cada socio conecta su
    // propio mail desde su usuario.
    const [existente] = await db.select({ id: gmailConexion.id }).from(gmailConexion).where(eq(gmailConexion.email, email)).limit(1);
    let conexionId: string;
    if (existente) {
      await db.update(gmailConexion)
        .set({ refreshToken, conectadoPor: session.user.username, conectadoEn: new Date() })
        .where(eq(gmailConexion.id, existente.id));
      conexionId = existente.id;
    } else {
      const [nueva] = await db.insert(gmailConexion)
        .values({ email, refreshToken, conectadoPor: session.user.username })
        .returning({ id: gmailConexion.id });
      conexionId = nueva.id;
    }
    await asegurarColumnaGmailConexionUsuario();
    if (session.user.id) await db.update(usuarios).set({ gmailConexionId: conexionId }).where(eq(usuarios.id, session.user.id));
    return NextResponse.redirect(new URL("/admin/mail?conectado=1", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al conectar con Gmail.";
    return NextResponse.redirect(new URL(`/admin/mail?error=${encodeURIComponent(message)}`, req.url));
  }
}
