import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { rubroDeTipo } from "@/lib/tipos-siniestro";
import { Pipeline, type TarjetaCaso } from "@/components/pipeline";

export const metadata: Metadata = { title: "Pipeline · IDR Gestión" };
export const dynamic = "force-dynamic";

// Pipeline: todos los casos como tarjetas numeradas en columnas por etapa
// (como el Embudo de AsesorCRM). El operador ve solo los suyos.
export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const esAdmin = session.user.rol === "admin";
  const todos = dbConfigurada() ? await getDb().select().from(siniestros).orderBy(desc(siniestros.creadoEn)) : [];
  const propios = esAdmin ? todos : todos.filter(s => s.operador === session.user.operador);
  const hace30 = Date.now() - 30 * 86_400_000;
  // Cerrados: solo los del último mes (el resto está en Cerrados/Base de datos).
  const visibles = propios.filter(s => s.estado !== "cerrado" || new Date(s.actualizadoEn).getTime() >= hace30);
  const tarjetas: TarjetaCaso[] = visibles.map(s => ({
    id: s.id, nro: s.nroSiniestro, asegurado: s.asegurado ?? s.denunciante, tipo: s.tipo, rubro: rubroDeTipo(s.tipo),
    operador: s.operador, etapa: s.etapaContacto, cerrado: s.estado === "cerrado", resultado: s.resultado,
    dias: Math.floor((Date.now() - new Date(s.creadoEn).getTime()) / 86_400_000),
    entrevista: s.fechaEntrevista ? new Date(s.fechaEntrevista).toISOString() : null,
    derivado: s.derivadoAdmin,
  }));
  const operadores = Array.from(new Set(propios.map(s => s.operador).filter((v): v is string => !!v))).sort();
  return (
    <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">IDR Gestión</p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">Pipeline</h1>
        <p className="text-sm text-slate">Arrastrá un caso a otra columna para cambiarle la etapa.{esAdmin ? " Soltalo en Cerrado para cerrarlo." : ""}</p>
      </header>
      <Pipeline tarjetas={tarjetas} esAdmin={esAdmin} operadores={operadores} />
    </main>
  );
}
