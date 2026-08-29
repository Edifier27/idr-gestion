import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Conteo de casos derivados al admin (sin contactar) para la campanita de
  // la sidebar — solo le importa al admin, así que solo se consulta para él.
  const esAdmin = session.user.rol === "admin";
  let derivados = 0;
  if (esAdmin && dbConfigurada()) {
    try {
      const filas = await getDb().select({ id: siniestros.id }).from(siniestros)
        .where(and(eq(siniestros.derivadoAdmin, true), ne(siniestros.estado, "cerrado")));
      derivados = filas.length;
    } catch { derivados = 0; }
  }

  return (
    <AppShell nombre={session.user.name ?? session.user.username} rol={session.user.rol} derivados={derivados}>
      {children}
    </AppShell>
  );
}
