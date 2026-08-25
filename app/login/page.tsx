"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await signIn("credentials", { username, password, redirect: false });
      if (res?.error) { setError("Usuario o contraseña incorrectos."); return; }
      router.push("/panel");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate">IDR Gestión</p>
        <h1 className="text-xl font-semibold text-ink">Iniciar sesión</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Usuario</span>
          <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus
            className="w-full rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Contraseña</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
        </label>
        {error && <p className="text-sm text-fraude">{error}</p>}
        <button type="submit" disabled={enviando}
          className="w-full rounded bg-ink px-3 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50">
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
