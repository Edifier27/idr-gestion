"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";

// Igual que InformePanel, pero apunta a /api/informe-final y al campo
// informe_final: la resolución privada del admin, que el operador no ve
// (puedeVerInformeFinal en lib/acceso.ts).
export function InformeFinalPanel({ siniestroId, informeInicial }: { siniestroId: string; informeInicial: string | null }) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const res = await fetch("/api/informe-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siniestroId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar la resolución final.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar la resolución final.");
    } finally {
      setGenerando(false);
    }
  }

  async function borrarTodo() {
    if (!window.confirm("¿Borrar la resolución final? Esta acción no se puede deshacer.")) return;
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ informe_final: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo borrar la resolución final.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar la resolución final.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generar}
          disabled={generando || borrando}
          className={boton.primario}
        >
          {generando ? "Generando…" : informeInicial ? "Regenerar resolución final" : "Generar resolución final"}
        </button>
        {informeInicial && (
          <button
            onClick={borrarTodo}
            disabled={generando || borrando}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-fraude transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {borrando ? "Borrando…" : "🗑 Borrar todo"}
          </button>
        )}
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
      {informeInicial ? (
        <div className="overflow-hidden rounded-lg border border-ink/20 bg-ink/[0.03]">
          <div className="flex items-center gap-1.5 border-b border-ink/10 bg-white px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">🔒 Privado — solo vos lo ves</span>
          </div>
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-ink">{informeInicial}</pre>
        </div>
      ) : (
        <p className="text-sm text-slate">
          Todavía no generaste tu resolución final. Es independiente del informe que arma el operador — esta versión no la ve nadie más que vos.
        </p>
      )}
    </div>
  );
}
