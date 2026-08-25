import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios, siniestros } from "@/lib/db/schema";
import { UsuariosPanel } from "@/components/usuarios-panel";

export const dynamic = "force-dynamic";

export default async function AdminUsuarios() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const lista = dbConfigurada() ? await getDb().select({
    id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre,
    rol: usuarios.rol, operador: usuarios.operador, activo: usuarios.activo, creadoEn: usuarios.creadoEn,
  }).from(usuarios).orderBy(usuarios.creadoEn) : [];

  const operadoresExistentes = dbConfigurada()
    ? Array.from(new Set((await getDb().select({ operador: siniestros.operador }).from(siniestros))
        .map(r => r.operador).filter((v): v is string => !!v))).sort()
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <a href="/panel" className="mb-5 inline-block text-sm text-slate hover:text-ink">← Volver al tablero</a>
      <header className="mb-6 border-b border-line pb-5">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">ATM · Siniestros</p>
        <h1 className="text-xl font-semibold text-ink">Usuarios</h1>
        <p className="text-sm text-slate">Creá una cuenta por cada vendedor/operador. Cada uno ve solo los casos donde su "operador" vinculado coincide con el campo Operador del caso.</p>
      </header>
      <UsuariosPanel usuariosIniciales={lista} operadoresExistentes={operadoresExistentes} />
    </main>
  );
}
