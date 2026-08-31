"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Setup() {
  const router = useRouter();
  const [chequeando, setChequeando] = useState(true);
  const [disponible, setDisponible] = useState(false);
  const [username, setUsername] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then(d => setDisponible(Boolean(d.disponible)))
      .finally(() => setChequeando(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nombre, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "No se pudo crear el administrador."); return; }
      router.push("/login");
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (chequeando) return null;

  if (!disponible) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
        <div className="rounded-lg border border-line bg-white p-6 text-center">
          <p className="text-sm text-slate">Ya hay un administrador configurado.</p>
          <a href="/login" className="mt-3 inline-block text-sm font-medium text-ink underline">Ir a iniciar sesión</a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">IDR Gestión</p>
        <h1 className="text-xl font-semibold text-ink">Crear administrador</h1>
        <p className="mt-1 text-sm text-slate">Primer ingreso: creá tu cuenta de admin. Después vos das de alta a cada operador.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-white p-5">
        <Campo label="Usuario">
          <input value={username} onChange={e => setUsername(e.target.value)} required
            className="w-full rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
        </Campo>
        <Campo label="Nombre visible">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={username}
            className="w-full rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
        </Campo>
        <Campo label="Contraseña (mín. 6 caracteres)">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
            className="w-full rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
        </Campo>
        {error && <p className="text-sm text-fraude">{error}</p>}
        <button type="submit" disabled={enviando}
          className="w-full rounded bg-azul px-3 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50">
          {enviando ? "Creando…" : "Crear administrador"}
        </button>
      </form>
    </main>
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
