import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { asegurarColumnaGmailConexionUsuario } from "@/lib/db/asegurar-usuario-gmail-conexion";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const db = getDb();
        await asegurarColumnaGmailConexionUsuario();
        const [u] = await db.select().from(usuarios).where(eq(usuarios.username, username));
        if (!u || !u.activo) return null;

        const ok = await bcrypt.compare(password, u.passwordHash);
        if (!ok) return null;

        return { id: u.id, name: u.nombre, username: u.username, rol: u.rol, operador: u.operador, gmailConexionId: u.gmailConexionId };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as { rol: string }).rol;
        token.operador = (user as { operador: string | null }).operador;
        token.username = (user as { username: string }).username;
        token.gmailConexionId = (user as { gmailConexionId: string | null }).gmailConexionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.rol = token.rol as string;
        session.user.operador = token.operador as string | null;
        session.user.username = token.username as string;
        session.user.gmailConexionId = (token.gmailConexionId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
