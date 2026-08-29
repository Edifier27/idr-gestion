"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { boton, campo } from "@/lib/ui";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-8">
      {/* Mismo fondo decorativo (manchas tenues) que el shell autenticado —
          así el login ya se siente parte del mismo producto, no una pantalla
          genérica aparte. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-ink/[0.04] blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-amber/[0.08] blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber/70 text-lg font-bold text-ink shadow-sm">
            IDR
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">IDR Gestión</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate">Investigación de siniestros</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-white p-6 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">Usuario</span>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className={`w-full ${campo}`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={`w-full ${campo}`}
            />
          </label>
          {error && (
            <p className="flex items-center gap-1.5 rounded-md border border-fraude/30 bg-fraude/5 px-3 py-2 text-sm font-medium text-fraude">
              <span aria-hidden>⚠</span> {error}
            </p>
          )}
          <button type="submit" disabled={enviando} className={`w-full ${boton.primario}`}>
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
