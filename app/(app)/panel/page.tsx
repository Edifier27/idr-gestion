import type { Metadata } from "next";
import { desc, and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora } from "@/lib/db/schema";
import type { SiniestroRow } from "@/lib/db/schema";
import { listarOperadoresActivos } from "@/lib/operadores";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";
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
  // Unión de operadores con usuario activo + los que aparecen en casos
  // (por si algún caso viejo quedó con un operador ya dado de baja) — así
  // el filtro nunca deja afuera a nadie que pueda tener casos.
  const operadoresDeCasos = Array.from(new Set(todas.map(r => r.operador).filter((v): v is string => !!v)));
  const operadoresActivos = await listarOperadoresActivos();
  const operadoresExistentes = Array.from(new Set([...operadoresActivos, ...operadoresDeCasos])).sort();

  const total = rows.length;
  const derivados = esAdmin ? rows.filter(r => r.derivadoAdmin && r.estado !== "cerrado").length : 0;

  // Pedidos de ayuda del operador sin leer todavía — mismo trato que los
  // casos derivados: un aviso que no depende de que el admin se acuerde de
  // entrar a mirar la bitácora de cada caso.
  let pedidosAyuda: { siniestroId: string; nota: string; autor: string | null; caso: SiniestroRow }[] = [];
  if (esAdmin && dbConfigurada()) {
    await asegurarColumnasComunicacion();
    const db = getDb();
    const filas = await db.select({ siniestroId: bitacora.siniestroId, nota: bitacora.nota, autor: bitacora.autor })
      .from(bitacora)
      .where(and(eq(bitacora.tipo, "pedido_ayuda"), eq(bitacora.leida, false)))
      .orderBy(desc(bitacora.fecha));
    const mapaCasos = new Map(todas.map(r => [r.id, r]));
    pedidosAyuda = filas
      .map(f => ({ ...f, caso: mapaCasos.get(f.siniestroId) }))
      .filter((f): f is typeof f & { caso: SiniestroRow } => !!f.caso);
  }

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

      {derivados > 0 && (
        <a
          href="/panel?quick=derivados"
          className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3 text-sm font-medium text-fraude shadow-sm transition hover:bg-fraude/10"
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fraude opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fraude" />
            </span>
            🚩 {derivados} caso{derivados === 1 ? "" : "s"} derivado{derivados === 1 ? "" : "s"} por el operador — no se pudo contactar al denunciante y necesita tu intervención
          </span>
          <span aria-hidden>→</span>
        </a>
      )}

      {pedidosAyuda.map(p => (
        <a
          key={p.siniestroId}
          href={`/siniestros/${p.siniestroId}`}
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 text-sm font-medium text-amber shadow-sm transition hover:bg-amber/10"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber" />
            </span>
            <span className="truncate">
              🆘 {p.autor ?? "El operador"} pide ayuda con {p.caso.asegurado ?? "un caso"}: "{p.nota}"
            </span>
          </span>
          <span aria-hidden className="shrink-0">→</span>
        </a>
      ))}

      <PanelLayout esAdmin={esAdmin} operadoresExistentes={operadoresExistentes}>
        {sinDb ? <EmptyStateSinDb /> : rows.length === 0 ? <EmptyStateSinDatos /> : (
          <TablaSiniestros rows={rows} esAdmin={esAdmin} operadoresExistentes={operadoresExistentes} />
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
