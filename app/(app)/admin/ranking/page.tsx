import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { listarOperadoresActivos } from "@/lib/operadores";
import { RankingOperadoresPanel, type StatOperador, type EventoDesistido } from "@/components/ranking-operadores-panel";

export const dynamic = "force-dynamic";

// Ranking de operadores por cantidad de casos desistidos, pensado para
// "motivar" — Dario quiere poder mostrar/mandar quién viene consiguiendo
// más desistimientos, con la opción de filtrar por mes. Incluye a todo
// operador activo aunque todavía no tenga casos (arranca en 0), no solo a
// los que ya aparecen en el tablero.
export default async function AdminRanking() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const operadoresActivos = await listarOperadoresActivos();

  const filas = dbConfigurada()
    ? await getDb().select({
        operador: siniestros.operador, resultado: siniestros.resultado, estado: siniestros.estado,
        fechaDesistido: siniestros.fechaDesistido, actualizadoEn: siniestros.actualizadoEn,
      }).from(siniestros)
    : [];

  const mapa = new Map<string, StatOperador>();
  for (const nombre of operadoresActivos) mapa.set(nombre, { nombre, total: 0, resueltos: 0 });

  // Un evento por cada caso desistido, con su fecha — el filtro por mes se
  // resuelve del lado del cliente agrupando estos eventos, sin ir de nuevo
  // al servidor cada vez que Dario cambia el mes.
  const eventos: EventoDesistido[] = [];

  for (const r of filas) {
    if (!r.operador) continue;
    const acc = mapa.get(r.operador) ?? { nombre: r.operador, total: 0, resueltos: 0 };
    acc.total++;
    if (r.estado === "cerrado") acc.resueltos++;
    mapa.set(r.operador, acc);

    if (r.resultado === "desistido") {
      // fecha_desistido se empieza a registrar recién ahora — para un caso
      // ya desistido de antes de este cambio, actualizado_en es la mejor
      // aproximación disponible (no hay forma de reconstruir el momento
      // exacto retroactivamente).
      const fecha = r.fechaDesistido ?? r.actualizadoEn;
      if (fecha) eventos.push({ operador: r.operador, fecha: fecha.toISOString() });
    }
  }

  const stats = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">🏆 Ranking de operadores</h1>
        <p className="text-sm text-slate">Quién viene consiguiendo más desistimientos — filtrá por mes y armá la imagen para compartir.</p>
      </header>
      <RankingOperadoresPanel stats={stats} eventos={eventos} fecha={fecha} />
    </main>
  );
}
