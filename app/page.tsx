import { desc } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import type { SiniestroRow } from "@/lib/db/schema";
import { formatARS } from "@/lib/facturacion";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";

export const dynamic = "force-dynamic";

async function cargar(): Promise<SiniestroRow[]> {
  if (!dbConfigurada()) return [];
  try { return await getDb().select().from(siniestros).orderBy(desc(siniestros.creadoEn)); }
  catch { return []; }
}

function diasRestantes(fechaLimite: string | null): number | null {
  if (!fechaLimite) return null;
  const diff = new Date(fechaLimite).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default async function Dashboard() {
  const rows = await cargar();
  const sinDb = !dbConfigurada();

  const total = rows.length;
  const enGestion = rows.filter(r => !["facturado","cerrado"].includes(r.estado)).length;
  const montoFacturado = rows.filter(r => r.estadoCobro === "facturado" || r.estadoCobro === "presentado")
    .reduce((a,r) => a + (r.facturar ?? 0), 0);
  const montoCobrado = rows.filter(r => r.estadoCobro === "cobrado")
    .reduce((a,r) => a + (r.facturar ?? 0), 0);

  const vencenProximo = rows.filter(r => {
    const d = diasRestantes(r.fechaLimite);
    return d !== null && d >= 0 && d <= 3;
  });
  const vencidos = rows.filter(r => {
    const d = diasRestantes(r.fechaLimite);
    return d !== null && d < 0;
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between border-b border-line pb-5">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">ATM · Siniestros</p>
          <h1 className="text-2xl font-semibold text-ink">Gestión de siniestros</h1>
        </div>
        <a href="/api/export" className="rounded border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper">
          Exportar Excel
        </a>
      </header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Siniestros" valor={String(total)} />
        <Stat label="En gestión" valor={String(enGestion)} />
        <Stat label="Por cobrar" valor={formatARS(montoFacturado)} acento />
        <Stat label="Cobrado" valor={formatARS(montoCobrado)} ok />
      </div>

      {/* Alertas de vencimiento */}
      {(vencidos.length > 0 || vencenProximo.length > 0) && (
        <div className="mb-6 space-y-2">
          {vencidos.length > 0 && (
            <div className="rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3">
              <span className="font-semibold text-fraude">⚠ {vencidos.length} vencido{vencidos.length > 1 ? "s" : ""}: </span>
              <span className="text-sm text-fraude/80">{vencidos.map(v => v.numeroGestion ?? v.nroSiniestro).join(", ")}</span>
            </div>
          )}
          {vencenProximo.length > 0 && (
            <div className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-3">
              <span className="font-semibold text-amber">⏰ Vence en ≤3 días: </span>
              <span className="text-sm text-amber/80">{vencenProximo.map(v => `${v.numeroGestion ?? v.nroSiniestro} (${diasRestantes(v.fechaLimite)}d)`).join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {sinDb ? <EmptyStateSinDb /> : rows.length === 0 ? <EmptyStateSinDatos /> : <Tabla rows={rows} />}
    </main>
  );
}

function Stat({ label, valor, acento, ok }: { label:string; valor:string; acento?:boolean; ok?:boolean }) {
  const color = ok ? "text-ok" : acento ? "text-amber" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-slate">{label}</p>
      <p className={`tnum text-xl font-semibold ${color}`}>{valor}</p>
    </div>
  );
}

function Tabla({ rows }: { rows: SiniestroRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-slate">
            <th className="px-3 py-3 font-medium">Gestión</th>
            <th className="px-3 py-3 font-medium">Asegurado</th>
            <th className="px-3 py-3 font-medium">Tipo</th>
            <th className="px-3 py-3 font-medium">Estado</th>
            <th className="px-3 py-3 font-medium">Cobro</th>
            <th className="px-3 py-3 font-medium">Vence</th>
            <th className="px-3 py-3 text-right font-medium">Facturar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const dias = s.fechaLimite ? Math.ceil((new Date(s.fechaLimite).getTime() - Date.now()) / 86400000) : null;
            const venceColor = dias === null ? "" : dias < 0 ? "text-fraude font-semibold" : dias <= 3 ? "text-amber font-semibold" : "text-slate";
            return (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                <td className="px-3 py-3">
                  <a href={`/siniestros/${s.id}`} className="font-mono text-ink underline-offset-2 hover:underline">
                    {s.numeroGestion ?? "—"}
                  </a>
                  <span className="ml-2 font-mono text-xs text-slate">{s.nroSiniestro ?? ""}</span>
                </td>
                <td className="px-3 py-3">{s.asegurado ?? "—"}</td>
                <td className="px-3 py-3 text-slate">{s.tipo ?? "—"}</td>
                <td className="px-3 py-3"><EstadoBadge estado={s.estado} /></td>
                <td className="px-3 py-3"><CobroBadge estado={s.estadoCobro} /></td>
                <td className={`px-3 py-3 ${venceColor}`}>
                  {dias === null ? "—" : dias < 0 ? `hace ${Math.abs(dias)}d` : `${dias}d`}
                </td>
                <td className="tnum px-3 py-3 text-right font-medium">{formatARS(s.facturar)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      </ul>
    </div>
  );
}
