import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { ImportarMailPanel } from "@/components/importar-mail-panel";

export const dynamic = "force-dynamic";

export default async function ImportarMail() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const operadoresExistentes = dbConfigurada()
    ? Array.from(new Set((await getDb().select({ operador: siniestros.operador }).from(siniestros))
        .map(r => r.operador).filter((v): v is string => !!v))).sort()
    : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <a href="/panel" className="mb-5 inline-block text-sm text-slate hover:text-ink">← Volver al tablero</a>
      <header className="mb-6 border-b border-line pb-5">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">IDR Gestión</p>
        <h1 className="text-xl font-semibold text-ink">Importar caso desde mail</h1>
        <p className="text-sm text-slate">
          Pegá el asunto y el cuerpo del mail de derivación. La IA extrae los datos; revisalos antes de crear el caso.
        </p>
      </header>
      <ImportarMailPanel operadoresExistentes={operadoresExistentes} />
    </main>
  );
}
