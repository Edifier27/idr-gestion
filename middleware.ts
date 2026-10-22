import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // El sitio público (home) y /login, /setup quedan libres. api/backup
  // y api/recordatorio-plazo también: los dispara el Cron de Vercel (sin sesión/cookie), y se protegen
  // aparte con CRON_SECRET adentro del propio handler.
  // Todo lo demás (panel, siniestros, admin, API de datos) requiere sesión.
  matcher: [
    "/((?!$|api/auth|api/setup|api/migrar|api/backup|api/recordatorio-plazo|login|setup|privacidad|_next/static|_next/image|favicon.ico).*)",
  ],
};
