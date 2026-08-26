"use client";

import { useState } from "react";
import { etiquetaRol } from "@/lib/roles";
import { boton, campo, tarjeta } from "@/lib/ui";

type Usuario = {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  operador: string | null;
  activo: boolean;
  creadoEn: Date | string;
};

export function UsuariosPanel({ usuariosIniciales, operadoresExistentes }: {
  usuariosIniciales: Usuario[];
  operadoresExistentes: string[];
}) {
  const [lista, setLista] = useState(usuariosIniciales);
  const [username, setUsername] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"vendedor" | "admin">("vendedor");
  const [operador, setOperador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nombre, password, rol, operador }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "No se pudo crear el usuario."); return; }
      setLista(l => [...l, data.usuario]);
      setUsername(""); setNombre(""); setPassword(""); setOperador(""); setRol("vendedor");
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    const data = await res.json();
    if (res.ok) setLista(l => l.map(x => x.id === u.id ? { ...x, activo: data.usuario.activo } : x));
  }

  async function resetPassword(u: Usuario) {
    const nueva = window.prompt(`Nueva contraseña para ${u.username} (mín. 6 caracteres):`);
    if (!nueva) return;
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: nueva }),
    });
    const data = await res.json();
    if (!res.ok) window.alert(data.error ?? "No se pudo cambiar la contraseña.");
    else window.alert("Contraseña actualizada.");
  }

  return (
    <div className="space-y-6">
      <section className={`p-5 ${tarjeta}`}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Nuevo usuario</h2>
        <form onSubmit={crear} className="grid gap-3 md:grid-cols-2">
          <Campo label="Usuario">
            <input value={username} onChange={e => setUsername(e.target.value)} required
              className={`w-full ${campo}`} />
          </Campo>
          <Campo label="Nombre visible">
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={username}
              className={`w-full ${campo}`} />
          </Campo>
          <Campo label="Contraseña (mín. 6 caracteres)">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className={`w-full ${campo}`} />
          </Campo>
          <Campo label="Rol">
            <select value={rol} onChange={e => setRol(e.target.value as "vendedor" | "admin")}
              className={`w-full ${campo}`}>
              <option value="vendedor">Operador</option>
              <option value="admin">Admin</option>
            </select>
          </Campo>
          {rol === "vendedor" && (
            <Campo label="Operador vinculado (qué casos ve)">
              <input value={operador} onChange={e => setOperador(e.target.value)} required
                list="operadores-existentes" placeholder="Ej: NACHO"
                className={`w-full uppercase ${campo}`} />
              <datalist id="operadores-existentes">
                {operadoresExistentes.map(o => <option key={o} value={o} />)}
              </datalist>
              <span className="mt-1 block text-xs text-slate">Tiene que coincidir con el campo "Operador" de sus casos.</span>
            </Campo>
          )}
          {error && <p className="text-sm font-medium text-fraude md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <button type="submit" disabled={enviando} className={boton.primario}>
              {enviando ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className={`overflow-x-auto ${tarjeta}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-3 py-3 font-medium">Usuario</th>
              <th className="px-3 py-3 font-medium">Nombre</th>
              <th className="px-3 py-3 font-medium">Rol</th>
              <th className="px-3 py-3 font-medium">Operador</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-3 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(u => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3 font-mono text-ink">{u.username}</td>
                <td className="px-3 py-3">{u.nombre}</td>
                <td className="px-3 py-3 text-slate">{etiquetaRol(u.rol)}</td>
                <td className="px-3 py-3 text-slate">{u.operador ?? "—"}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${u.activo ? "bg-ok/15 text-ok" : "bg-fraude/15 text-fraude"}`}>
                    {u.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggleActivo(u)} className={boton.ghost}>
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => resetPassword(u)} className={boton.ghost}>
                      Cambiar contraseña
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">{label}</span>
      {children}
    </label>
  );
}
