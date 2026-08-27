import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // El sitio público (home) y /login, /setup quedan libres. api/backup
  // también: lo dispara el Cron de Vercel (sin sesión/cookie), y se protege
  // aparte con CRON_SECRET adentro del propio handler.
  // Todo lo demás (panel, siniestros, admin, API de datos) requiere sesión.
  matcher: [
    "/((?!$|api/auth|api/setup|api/migrar|api/backup|login|setup|_next/static|_next/image|favicon.ico).*)",
  ],
};
