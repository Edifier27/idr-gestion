"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";

export function InformePanel({ siniestroId, informeInicial }: { siniestroId: string; informeInicial: string | null }) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const res = await fetch("/api/informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siniestroId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el informe.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el informe.");
    } finally {
      setGenerando(false);
    }
  }

  async function borrarTodo() {
    if (!window.confirm("¿Borrar el informe generado? Esta acción no se puede deshacer.")) return;
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ informe: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo borrar el informe.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar el informe.");
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
          {generando ? "Generando…" : informeInicial ? "Regenerar informe con IA" : "Generar informe con IA"}
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
        <div className="overflow-hidden rounded-lg border border-line bg-paper/60">
          <div className="flex items-center gap-1.5 border-b border-line bg-white px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">Borrador — revisar antes de enviar</span>
          </div>
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-ink">{informeInicial}</pre>
        </div>
      ) : (
        <p className="text-sm text-slate">
          Todavía no se generó. Usa el descargo del investigador, el relato de la denuncia y la bitácora cargados hasta ahora, y coteja los dos relatos.
        </p>
      )}
    </div>
  );
}
