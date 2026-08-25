import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { conexionActiva } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export default async function AdminMail({ searchParams }: { searchParams: { error?: string; conectado?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const conexion = await conexionActiva();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <a href="/panel" className="mb-5 inline-block text-sm text-slate hover:text-ink">← Volver al tablero</a>
      <header className="mb-6 border-b border-line pb-5">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">IDR Gestión</p>
        <h1 className="text-xl font-semibold text-ink">Casilla de mail</h1>
        <p className="text-sm text-slate">Conectá la casilla corporativa para poder mandar mails con adjuntos desde cada caso.</p>
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
    </main>
  );
}
