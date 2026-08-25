"use client";

import { signOut } from "next-auth/react";

export function UserMenu({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate">
        {nombre} <span className="text-xs uppercase text-slate/70">({rol})</span>
      </span>
      {rol === "admin" && (
        <>
          <a href="/admin/usuarios" className="text-ink underline-offset-2 hover:underline">Usuarios</a>
          <a href="/admin/mail" className="text-ink underline-offset-2 hover:underline">Mail</a>
          <a href="/admin/importar-caso" className="text-ink underline-offset-2 hover:underline">Importar caso</a>
        </>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded border border-ink/20 px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
