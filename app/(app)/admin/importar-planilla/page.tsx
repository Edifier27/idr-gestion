import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportarPlanillaPanel } from "@/components/importar-planilla-panel";

export const dynamic = "force-dynamic";

export default async function ImportarPlanilla() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Importar planilla</h1>
        <p className="text-sm text-slate">
          Subí el Excel de casos (hojas de enviados y pendientes). Primero ves qué se va a cargar; los casos que ya están en el CRM se saltean.
        </p>
      </header>
      <ImportarPlanillaPanel />
    </main>
  );
}
