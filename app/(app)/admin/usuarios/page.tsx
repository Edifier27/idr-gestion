import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios, siniestros } from "@/lib/db/schema";
import { listarConexiones } from "@/lib/gmail";
import { UsuariosPanel } from "@/components/usuarios-panel";

export const dynamic = "force-dynamic";

export default async function AdminUsuarios() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  const lista = dbConfigurada() ? await getDb().select({
    id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre,
    rol: usuarios.rol, operador: usuarios.operador, activo: usuarios.activo, creadoEn: usuarios.creadoEn,
    gmailConexionId: usuarios.gmailConexionId,
  }).from(usuarios).orderBy(usuarios.creadoEn) : [];

  const operadoresExistentes = dbConfigurada()
    ? Array.from(new Set((await getDb().select({ operador: siniestros.operador }).from(siniestros))
        .map(r => r.operador).filter((v): v is string => !!v))).sort()
    : [];

  const casillas = dbConfigurada() ? (await listarConexiones()).map(c => ({ id: c.id, email: c.email })) : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Usuarios</h1>
        <p className="text-sm text-slate">Creá una cuenta por cada operador. Cada uno ve solo los casos donde su "operador" vinculado coincide con el campo Operador del caso.</p>
      </header>
      <UsuariosPanel usuariosIniciales={lista} operadoresExistentes={operadoresExistentes} casillas={casillas} />
    </main>
  );
}
