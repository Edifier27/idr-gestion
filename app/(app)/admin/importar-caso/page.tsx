import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarOperadoresActivos } from "@/lib/operadores";
import { ImportarCasoPanel } from "@/components/importar-caso-panel";

export const dynamic = "force-dynamic";

export default async function ImportarCaso() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const operadoresExistentes = await listarOperadoresActivos();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Importar caso</h1>
        <p className="text-sm text-slate">
          Subí el PDF de carátula, o pegá el texto del mail si no viene como adjunto. La IA extrae los datos; revisalos antes de crear el caso.
        </p>
      </header>
      <ImportarCasoPanel operadoresExistentes={operadoresExistentes} />
    </main>
  );
}
