"use client";

import { useState } from "react";
import { etiquetaRol } from "@/lib/roles";
import { boton, campo, tarjeta, tarjetaElevada, colorPorTexto, cinta, cintaTexto, badge, badgeDot } from "@/lib/ui";
import { pedirTexto, notificar } from "@/components/notificaciones";

type Usuario = {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  operador: string | null;
  activo: boolean;
  creadoEn: Date | string;
  gmailConexionId?: string | null;
};

type Casilla = { id: string; email: string };

export function UsuariosPanel({ usuariosIniciales, operadoresExistentes, casillas = [] }: {
  usuariosIniciales: Usuario[];
  operadoresExistentes: string[];
  casillas?: Casilla[];
}) {
  const [lista, setLista] = useState(usuariosIniciales);
  const [username, setUsername] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"vendedor" | "admin">("vendedor");
  const [operador, setOperador] = useState("");
  const [gmailConexionId, setGmailConexionId] = useState("");
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
        body: JSON.stringify({ username, nombre, password, rol, operador, gmailConexionId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "No se pudo crear el usuario."); return; }
      setLista(l => [...l, data.usuario]);
      setUsername(""); setNombre(""); setPassword(""); setOperador(""); setRol("vendedor"); setGmailConexionId("");
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function asignarCasilla(u: Usuario, id: string) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailConexionId: id }),
    });
    const data = await res.json();
    if (res.ok) setLista(l => l.map(x => x.id === u.id ? { ...x, gmailConexionId: data.usuario.gmailConexionId } : x));
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
    const nueva = await pedirTexto(`Nueva contraseña para ${u.username} (mín. 6 caracteres)`, { tipo: "password", placeholder: "••••••" });
    if (!nueva) return;
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: nueva }),
    });
    const data = await res.json();
    if (!res.ok) notificar.error(data.error ?? "No se pudo cambiar la contraseña.");
    else notificar.ok("Contraseña actualizada.");
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
          <Campo label="Casilla de mail (opcional)">
            <select value={gmailConexionId} onChange={e => setGmailConexionId(e.target.value)} className={`w-full ${campo}`}>
              <option value="">Sin asignar</option>
              {casillas.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate">
              Con qué casilla ve su bandeja, importa casos y manda mail. Conectá casillas nuevas en <a href="/admin/mail" className="underline underline-offset-2">Mail</a>.
            </span>
          </Campo>
          {error && <p className="text-sm font-medium text-fraude md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <button type="submit" disabled={enviando} className={boton.primario}>
              {enviando ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        {lista.map(u => {
          const etiqueta = u.nombre || u.username;
          return (
            <div key={u.id} className={`flex overflow-hidden ${tarjetaElevada}`}>
              <span className={`w-7 py-3 text-[10px] ${cinta}`} style={{ background: colorPorTexto(etiqueta) }} title={etiqueta}>
                <span className={cintaTexto}>{etiqueta}</span>
              </span>
              <div className="min-w-0 flex-1 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="font-mono text-base font-bold text-ink">{u.username}</p>
                    <p className="truncate text-sm text-slate">
                      {u.nombre} · {etiquetaRol(u.rol)}{u.operador ? ` · Operador ${u.operador}` : ""}
                    </p>
                  </div>
                  <span className={`${badge} ${u.activo ? "bg-ok/15 text-ok" : "bg-fraude/15 text-fraude"}`}>
                    <span className={badgeDot} />
                    {u.activo ? "Activo" : "Desactivado"}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                  <button onClick={() => toggleActivo(u)} className={boton.ghost}>
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => resetPassword(u)} className={boton.ghost}>
                    Cambiar contraseña
                  </button>
                  {casillas.length > 0 && (
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-slate">
                      📧
                      <select
                        value={u.gmailConexionId ?? ""}
                        onChange={e => asignarCasilla(u, e.target.value)}
                        className={`px-2 py-1 text-xs ${campo}`}
                      >
                        <option value="">Sin casilla</option>
                        {casillas.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
