import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import type { SiniestroRow } from "@/lib/db/schema";
import { TablaSiniestros } from "@/components/tabla-siniestros";
import { PanelLayout } from "@/components/panel-layout";

export const metadata: Metadata = { title: "Tablero · IDR Gestión" };
export const dynamic = "force-dynamic";

async function cargar(): Promise<SiniestroRow[]> {
  if (!dbConfigurada()) return [];
  try { return await getDb().select().from(siniestros).orderBy(desc(siniestros.creadoEn)); }
  catch { return []; }
}

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const todas = await cargar();
  const esAdmin = session.user.rol === "admin";
  const rows = esAdmin ? todas : todas.filter(r => r.operador === session.user.operador);
  const sinDb = !dbConfigurada();
  const operadoresExistentes = Array.from(new Set(todas.map(r => r.operador).filter((v): v is string => !!v))).sort();

  const total = rows.length;
  const montoFacturado = rows.filter(r => r.estadoCobro === "facturado" || r.estadoCobro === "presentado")
    .reduce((a,r) => a + (r.facturar ?? 0), 0);
  const montoCobrado = rows.filter(r => r.estadoCobro === "cobrado")
    .reduce((a,r) => a + (r.facturar ?? 0), 0);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">IDR Gestión</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">Tablero</h1>
          {/* La cantidad total de siniestros va acá, chica y de paso — ya no
              como una caja grande arriba de todo: lo que importa mirar
              primero es el seguimiento operativo, no el conteo total. */}
          <p className="text-sm text-slate">{total} siniestro{total === 1 ? "" : "s"} en gestión</p>
        </div>
        <a href="/api/export" className="rounded-md border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-ink/30 hover:bg-paper">
          Exportar Excel
        </a>
      </header>

      <PanelLayout esAdmin={esAdmin} operadoresExistentes={operadoresExistentes}>
        {sinDb ? <EmptyStateSinDb /> : rows.length === 0 ? <EmptyStateSinDatos /> : (
          <TablaSiniestros rows={rows} esAdmin={esAdmin} montoFacturado={montoFacturado} montoCobrado={montoCobrado} />
        )}
      </PanelLayout>
    </main>
  );
}

function EmptyStateSinDatos() {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
      <h2 className="mb-1 font-semibold text-ink">Sin siniestros cargados</h2>
      <p className="text-sm text-slate">Cuando llegue el mail, el botón los carga acá automáticamente.</p>
    </div>
  );
}

function EmptyStateSinDb() {
  return (
    <div className="rounded-lg border border-dashed border-amber/40 bg-amber/5 p-8">
      <h2 className="mb-2 font-semibold text-ink">Falta conectar la base de datos</h2>
      <p className="mb-3 text-sm text-slate">Configurá estas variables de entorno en Vercel:</p>
      <ul className="space-y-1 font-mono text-xs text-slate">
        <li>· DATABASE_URL — Neon Postgres (gratis)</li>
        <li>· ANTHROPIC_API_KEY — parseo PDF + informe IA</li>
        <li>· GOOGLE_MAPS_API_KEY — cálculo de km</li>
        <li>· BASE_ORIGEN — (opcional) Gral. Deheza 527, Avellaneda, BA</li>
        <li>· AUTH_SECRET — login (generar con: openssl rand -base64 32)</li>
      </ul>
    </div>
  );
}
