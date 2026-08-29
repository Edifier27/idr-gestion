import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      rol: string;
      operador: string | null;
      username: string;
      gmailConexionId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: string;
    operador?: string | null;
    username?: string;
    gmailConexionId?: string | null;
  }
}
