import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { gmailConexion } from "@/lib/db/schema";
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
    const { refreshToken, email } = await intercambiarCodigo(code);
    await asegurarTablasGmail();
    const db = getDb();
    await db.insert(gmailConexion).values({ email, refreshToken, conectadoPor: session.user.username });
    return NextResponse.redirect(new URL("/admin/mail?conectado=1", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al conectar con Gmail.";
    return NextResponse.redirect(new URL(`/admin/mail?error=${encodeURIComponent(message)}`, req.url));
  }
}
