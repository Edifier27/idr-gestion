import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarConexiones } from "@/lib/gmail";
import { listarOperadoresActivos } from "@/lib/operadores";
import { InboxPanel } from "@/components/inbox-panel";

export const dynamic = "force-dynamic";

// Solo el admin: es quien recibe los casos de las aseguradoras por mail. El
// operador trabaja todo desde el CRM (no tiene casilla propia).
export default async function AdminMail({ searchParams }: { searchParams: { error?: string; conectado?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const conexiones = await listarConexiones();
  const miConexion = session.user.gmailConexionId
    ? conexiones.find(c => c.id === session.user.gmailConexionId) ?? null
    : conexiones[0] ?? null;

  const operadoresExistentes = await listarOperadoresActivos();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Casilla de mail</h1>
        <p className="text-sm text-slate">Donde entran los casos que mandan las aseguradoras.</p>
      </header>

      {searchParams.conectado && (
        <div className="mb-5 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          Conectado correctamente.
        </div>
      )}
      {searchParams.error && (
        <div className="mb-5 rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3 text-sm text-fraude">
          {searchParams.error}
        </div>
      )}

      <section className="space-y-2">
        {conexiones.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{c.email}</p>
              <p className="text-xs text-slate">
                Conectada por {c.conectadoPor ?? "—"} el {new Date(c.conectadoEn).toLocaleString("es-AR")}
              </p>
            </div>
            {c.id === miConexion?.id && (
              <span className="shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">Activa</span>
            )}
          </div>
        ))}
        {conexiones.length === 0 && (
          <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-slate">Todavía no hay ninguna casilla conectada.</p>
        )}
        <a href="/api/gmail/connect" className="inline-block rounded border border-azul/20 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-azul hover:text-paper">
          {conexiones.length === 0 ? "Conectar Gmail" : "+ Conectar otra casilla"}
        </a>
      </section>

      {miConexion && (
        <div className="mt-6">
          <InboxPanel operadoresExistentes={operadoresExistentes} />
        </div>
      )}
    </main>
  );
}
