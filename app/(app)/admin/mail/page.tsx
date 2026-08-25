import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { conexionActiva } from "@/lib/gmail";
import { InboxPanel } from "@/components/inbox-panel";

export const dynamic = "force-dynamic";

export default async function AdminMail({ searchParams }: { searchParams: { error?: string; conectado?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const conexion = await conexionActiva();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Casilla de mail</h1>
        <p className="text-sm text-slate">Conectá la casilla corporativa para mandar mails con adjuntos desde cada caso y ver la bandeja de entrada acá.</p>
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

      <section className="rounded-lg border border-line bg-white p-5">
        {conexion ? (
          <>
            <p className="text-sm text-slate">Casilla conectada</p>
            <p className="mb-4 text-lg font-semibold text-ink">{conexion.email}</p>
            <p className="mb-4 text-xs text-slate">
              Conectada por {conexion.conectadoPor ?? "—"} el {new Date(conexion.conectadoEn).toLocaleString("es-AR")}
            </p>
            <a href="/api/gmail/connect" className="inline-block rounded border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper">
              Reconectar / cambiar de casilla
            </a>
            <p className="mt-3 text-xs text-slate">
              Si la conectaste antes de que sumáramos la bandeja de entrada, hacé clic en "Reconectar" una vez para darle permiso de lectura además de envío.
            </p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">Todavía no hay ninguna casilla conectada.</p>
            <a href="/api/gmail/connect" className="inline-block rounded bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90">
              Conectar Gmail
            </a>
          </>
        )}
      </section>

      {conexion && (
        <div className="mt-6">
          <InboxPanel />
        </div>
      )}
    </main>
  );
}
