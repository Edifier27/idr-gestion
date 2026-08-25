import type { NextAuthConfig } from "next-auth";

// Config "edge-safe": sin bcrypt ni acceso a DB. La usa el middleware
// para decidir si una request necesita sesión, y auth.ts la extiende
// con el provider de credenciales (que sí corre en runtime Node).
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
