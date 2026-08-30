import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";
import { UsuariosPanel } from "@/components/usuarios-panel";

export const dynamic = "force-dynamic";

export default async function AdminUsuarios() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");

  if (dbConfigurada()) await asegurarColumnasComunicacion();
  const lista = dbConfigurada() ? await getDb().select({
    id: usuarios.id, username: usuarios.username, nombre: usuarios.nombre,
    rol: usuarios.rol, operador: usuarios.operador, email: usuarios.email, activo: usuarios.activo, creadoEn: usuarios.creadoEn,
  }).from(usuarios).orderBy(usuarios.creadoEn) : [];

  // Se deriva de la propia lista de usuarios ya cargada arriba (no de los
  // siniestros): así un operador recién creado, sin casos todavía, ya
  // aparece como sugerencia al crear el próximo.
  const operadoresExistentes = Array.from(new Set(
    lista.filter(u => u.rol === "vendedor" && u.activo).map(u => u.operador).filter((v): v is string => !!v)
  )).sort();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Usuarios</h1>
        <p className="text-sm text-slate">Creá una cuenta por cada operador. Cada uno ve solo los casos donde su "operador" vinculado coincide con el campo Operador del caso.</p>
      </header>
      <UsuariosPanel usuariosIniciales={lista} operadoresExistentes={operadoresExistentes} />
    </main>
  );
}
