import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { rubroDeTipo } from "@/lib/tipos-siniestro";
import { puedeVerFacturacion } from "@/lib/acceso";
import { BaseCasos, type FilaBase } from "@/components/base-casos";

export const metadata: Metadata = { title: "Base de datos · IDR Gestión" };
export const dynamic = "force-dynamic";

// Base de datos: todos los casos (abiertos y cerrados) en una tabla para
// buscar, filtrar y ordenar por cualquier columna. El operador ve los suyos.
export default async function BasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const esAdmin = session.user.rol === "admin";
  const todos = dbConfigurada() ? await getDb().select().from(siniestros).orderBy(desc(siniestros.creadoEn)) : [];
  const propios = esAdmin ? todos : todos.filter(s => s.operador === session.user.operador);
  const verPlata = puedeVerFacturacion(session);
  const filas: FilaBase[] = propios.map(s => ({
    id: s.id, nro: s.nroSiniestro, ingreso: s.fechaIngreso, asegurado: s.asegurado ?? s.denunciante, dni: s.dni,
    telefono: s.telContacto ?? s.celContacto, rubro: rubroDeTipo(s.tipo), tipo: s.tipo, compania: s.compania,
    operador: s.operador, etapa: s.etapaContacto, estado: s.estado, resultado: s.resultado,
    km: verPlata ? s.kmTotal : null, facturar: verPlata ? s.facturar : null, cobro: verPlata ? s.estadoCobro : null,
    localidad: s.domicilio,
  }));
  return (
    <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">IDR Gestión</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">Base de datos</h1>
          <p className="text-sm text-slate">{filas.length} casos, abiertos y cerrados. Tocá un título de columna para ordenar.</p>
        </div>
        <a href="/api/export" className="rounded-md border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-ink/30 hover:bg-paper">Exportar Excel</a>
      </header>
      <BaseCasos filas={filas} verPlata={verPlata} esAdmin={esAdmin} />
    </main>
  );
}
