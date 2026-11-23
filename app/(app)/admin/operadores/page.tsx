import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, usuarios } from "@/lib/db/schema";
import { asegurarColumnaZonaUsuario } from "@/lib/db/asegurar-zona-usuario";
import { pendientesDeCaso, datosParaPendientes } from "@/lib/pendientes";
import { rubroDeTipo } from "@/lib/tipos-siniestro";
import { PanelOperadores, type CasoPanel, type OperadorPanel } from "@/components/panel-operadores";

export const metadata: Metadata = { title: "Panel de operadores · IDR Gestión" };
export const dynamic = "force-dynamic";

// Panel de operadores (solo admin): la vista de supervisor de los sistemas
// de siniestros — carga de cada operador y, al entrar en uno, sus casos en
// el orden que fija el admin, con lo que hay que preguntarle en cada uno.
export default async function PanelOperadoresPage({ searchParams }: { searchParams: { op?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");
  if (!dbConfigurada()) return <main className="p-8 text-slate">Falta la base de datos.</main>;

  const db = getDb();
  const todos = await db.select().from(siniestros).orderBy(desc(siniestros.creadoEn));
  const abiertos = todos.filter(s => s.estado !== "cerrado");
  const { categorias, diferencias, orden } = await datosParaPendientes(abiertos.map(s => s.id));

  let zonas: Record<string, string | null> = {};
  try {
    await asegurarColumnaZonaUsuario();
    const res = await db.execute(sql`SELECT operador, zona FROM usuarios WHERE rol = 'vendedor'`);
    zonas = Object.fromEntries((res.rows as { operador: string | null; zona: string | null }[]).filter(r => r.operador).map(r => [r.operador as string, r.zona]));
  } catch { /* sin zona */ }
  const cuentas = await db.select({ operador: usuarios.operador, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.rol, "vendedor"));
  const nombres = Object.fromEntries(cuentas.filter(c => c.operador).map(c => [c.operador as string, c.nombre]));

  const ahora = Date.now();
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

  const casos: CasoPanel[] = abiertos.map(s => ({
    id: s.id,
    nro: s.nroSiniestro,
    asegurado: s.asegurado ?? s.denunciante,
    tipo: s.tipo,
    rubro: rubroDeTipo(s.tipo),
    etapa: s.etapaContacto,
    operador: s.operador,
    orden: orden.get(s.id) ?? null,
    dias: Math.floor((ahora - new Date(s.creadoEn).getTime()) / 86_400_000),
    pendientes: pendientesDeCaso(s, categorias.get(s.id) ?? new Set(), diferencias.get(s.id) ?? 0, ahora),
  }));

  const codigos = Array.from(new Set([...Object.keys(nombres), ...abiertos.map(s => s.operador).filter((v): v is string => !!v)])).sort();
  const operadores: OperadorPanel[] = codigos.map(op => {
    const suyos = casos.filter(c => c.operador === op);
    return {
      codigo: op,
      nombre: nombres[op] ?? op,
      zona: zonas[op] ?? null,
      abiertos: suyos.length,
      porEtapa: {
        recibido: suyos.filter(c => !c.etapa).length,
        contacto_fallido: suyos.filter(c => c.etapa === "contacto_fallido").length,
        contactado: suyos.filter(c => c.etapa === "contactado").length,
        entrevista_pactada: suyos.filter(c => c.etapa === "entrevista_pactada").length,
        informe_enviado: suyos.filter(c => c.etapa === "informe_enviado").length,
      },
      urgentes: suyos.filter(c => c.pendientes.some(p => p.tipo === "urgente")).length,
      cerradosMes: todos.filter(s => s.operador === op && s.estado === "cerrado" && new Date(s.actualizadoEn) >= inicioMes).length,
    };
  });
  const sinAsignar = casos.filter(c => !c.operador).length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">IDR Gestión</p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">Panel de operadores</h1>
        <p className="text-sm text-slate">Carga de cada operador, el orden en que tiene que trabajar sus casos y qué preguntarle en cada uno.{sinAsignar > 0 ? ` · ${sinAsignar} caso${sinAsignar === 1 ? "" : "s"} sin operador.` : ""}</p>
      </header>
      <PanelOperadores operadores={operadores} casos={casos} inicial={searchParams.op ?? operadores[0]?.codigo ?? null} />
    </main>
  );
}
