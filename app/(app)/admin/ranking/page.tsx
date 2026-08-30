import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { listarOperadoresActivos } from "@/lib/operadores";
import { RankingOperadoresPanel, type StatOperador } from "@/components/ranking-operadores-panel";

export const dynamic = "force-dynamic";

// Ranking de operadores por cantidad de casos desistidos, pensado para
// "motivar": Dario quiere poder mostrar/mandar quién viene consiguiendo
// más desistimientos. Incluye a todo operador activo aunque todavía no
// tenga casos (arranca en 0), no solo a los que ya aparecen en el tablero.
export default async function AdminRanking() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const operadoresActivos = await listarOperadoresActivos();

  const filas = dbConfigurada()
    ? await getDb().select({
        operador: siniestros.operador, resultado: siniestros.resultado, estado: siniestros.estado,
      }).from(siniestros)
    : [];

  const mapa = new Map<string, StatOperador>();
  for (const nombre of operadoresActivos) mapa.set(nombre, { nombre, total: 0, desistidos: 0, resueltos: 0 });
  for (const r of filas) {
    if (!r.operador) continue;
    const acc = mapa.get(r.operador) ?? { nombre: r.operador, total: 0, desistidos: 0, resueltos: 0 };
    acc.total++;
    if (r.resultado === "desistido") acc.desistidos++;
    if (r.estado === "cerrado") acc.resueltos++;
    mapa.set(r.operador, acc);
  }

  const stats = Array.from(mapa.values()).sort((a, b) => b.desistidos - a.desistidos || b.total - a.total);
  const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">🏆 Ranking de operadores</h1>
        <p className="text-sm text-slate">Quién viene consiguiendo más desistimientos — armá la imagen y compartila con el equipo.</p>
      </header>
      <RankingOperadoresPanel stats={stats} fecha={fecha} />
    </main>
  );
}
