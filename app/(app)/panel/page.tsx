import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import type { SiniestroRow } from "@/lib/db/schema";
import { formatARS } from "@/lib/facturacion";
import { TablaSiniestros } from "@/components/tabla-siniestros";
import { PanelLayout } from "@/components/panel-layout";
import { tarjetaElevada } from "@/lib/ui";
import { plazoInforme } from "@/lib/etapa-contacto";

export const metadata: Metadata = { title: "Tablero · IDR Gestión" };
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
  const session = await auth();
  if (!session?.user) redirect("/login");

  const todas = await cargar();
  const esAdmin = session.user.rol === "admin";
  const rows = esAdmin ? todas : todas.filter(r => r.operador === session.user.operador);
  const sinDb = !dbConfigurada();
  const operadoresExistentes = Array.from(new Set(todas.map(r => r.operador).filter((v): v is string => !!v))).sort();

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

  // Seguimiento operativo: casos que no se pudieron contactar (le caen al
  // admin para resolver el dato de contacto) y casos con entrevista pactada
  // que se están por pasar / ya se pasaron del plazo de 48hs sin informe.
  const contactoFallido = rows.filter(r => r.etapaContacto === "contacto_fallido");
  const informeVencido = rows.filter(r => plazoInforme(r.etapaContacto, r.fechaEntrevista) === "vencido");
  const informeAtencion = rows.filter(r => plazoInforme(r.etapaContacto, r.fechaEntrevista) === "atencion");

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">IDR Gestión</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">Tablero</h1>
          <p className="text-sm text-slate">Casos de investigación de siniestros</p>
        </div>
        <a href="/api/export" className="rounded-md border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-ink/30 hover:bg-paper">
          Exportar Excel
        </a>
      </header>

      {/* Stats */}
      <div className={`mb-6 grid grid-cols-2 gap-3 ${esAdmin ? "md:grid-cols-4" : ""}`}>
        <Stat label="Siniestros" valor={String(total)} icon={<IconFolder />} />
        <Stat label="En gestión" valor={String(enGestion)} icon={<IconClock />} accent="amber" />
        {esAdmin && <Stat label="Por cobrar" valor={formatARS(montoFacturado)} icon={<IconInvoice />} accent="amber" />}
        {esAdmin && <Stat label="Cobrado" valor={formatARS(montoCobrado)} icon={<IconCheck />} accent="ok" />}
      </div>

      {/* Alertas de vencimiento */}
      {(vencidos.length > 0 || vencenProximo.length > 0 || contactoFallido.length > 0 || informeVencido.length > 0 || informeAtencion.length > 0) && (
        <div className="mb-6 space-y-2">
          {vencidos.length > 0 && (
            <div className="rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3">
              <span className="font-semibold text-fraude">⚠ {vencidos.length} vencido{vencidos.length > 1 ? "s" : ""}: </span>
              <span className="text-sm text-fraude/80">{vencidos.map(v => v.numeroGestion ?? v.nroSiniestro).join(", ")}</span>
            </div>
          )}
          {contactoFallido.length > 0 && (
            <div className="rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3">
              <span className="font-semibold text-fraude">📵 {contactoFallido.length} sin contactar: </span>
              <span className="text-sm text-fraude/80">{contactoFallido.map(v => v.numeroGestion ?? v.nroSiniestro).join(", ")} — necesitan que el admin revise el dato de contacto.</span>
            </div>
          )}
          {informeVencido.length > 0 && (
            <div className="rounded-lg border border-fraude/30 bg-fraude/5 px-4 py-3">
              <span className="font-semibold text-fraude">⚠ {informeVencido.length} informe{informeVencido.length > 1 ? "s" : ""} vencido{informeVencido.length > 1 ? "s" : ""} (+48hs de la entrevista): </span>
              <span className="text-sm text-fraude/80">{informeVencido.map(v => v.numeroGestion ?? v.nroSiniestro).join(", ")}</span>
            </div>
          )}
          {informeAtencion.length > 0 && (
            <div className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-3">
              <span className="font-semibold text-amber">⏰ {informeAtencion.length} informe{informeAtencion.length > 1 ? "s" : ""} por vencer (24-48hs de la entrevista): </span>
              <span className="text-sm text-amber/80">{informeAtencion.map(v => v.numeroGestion ?? v.nroSiniestro).join(", ")}</span>
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

      <PanelLayout esAdmin={esAdmin} operadoresExistentes={operadoresExistentes}>
        {sinDb ? <EmptyStateSinDb /> : rows.length === 0 ? <EmptyStateSinDatos /> : <TablaSiniestros rows={rows} esAdmin={esAdmin} />}
      </PanelLayout>
    </main>
  );
}

function Stat({ label, valor, icon, accent }: { label:string; valor:string; icon: React.ReactNode; accent?: "amber" | "ok" }) {
  const colorTexto = accent === "ok" ? "text-ok" : accent === "amber" ? "text-amber" : "text-ink";
  const colorIcono = accent === "ok" ? "bg-ok/10 text-ok" : accent === "amber" ? "bg-amber/10 text-amber" : "bg-ink/5 text-ink";
  const colorCinta = accent === "ok" ? "bg-ok" : accent === "amber" ? "bg-amber" : "bg-ink";
  return (
    <div className={`group flex overflow-hidden ${tarjetaElevada}`}>
      <span className={`flex w-7 shrink-0 items-center justify-center py-3 text-[10px] font-bold uppercase tracking-wide text-white ${colorCinta}`}>
        <span className="[writing-mode:vertical-rl] whitespace-nowrap rotate-180">{label}</span>
      </span>
      <div className="min-w-0 flex-1 p-4">
        <div className="mb-1.5 flex items-center justify-end">
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${colorIcono}`}>{icon}</span>
        </div>
        <p className={`tnum text-3xl font-bold tracking-tight ${colorTexto}`}>{valor}</p>
      </div>
    </div>
  );
}

function IconFolder() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5A1 1 0 012.5 2.5H6l1.5 1.5h6a1 1 0 011 1v8a1 1 0 01-1 1h-11a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>;
}
function IconClock() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function IconInvoice() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="1.5" width="10" height="13" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3"/><path d="M5.2 8.2l1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
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
