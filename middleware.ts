import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Todo requiere sesión salvo /login, /setup, las rutas de auth, y estáticos.
  matcher: ["/((?!api/auth|api/setup|login|setup|_next/static|_next/image|favicon.ico).*)"],
};
