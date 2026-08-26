"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";

export function InformePanel({ siniestroId, informeInicial }: { siniestroId: string; informeInicial: string | null }) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generar}
          disabled={generando}
          className={boton.primario}
        >
          {generando ? "Generando…" : informeInicial ? "Regenerar informe con IA" : "Generar informe con IA"}
        </button>
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
      {informeInicial ? (
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-ink">{informeInicial}</pre>
      ) : (
        <p className="text-sm text-slate">
          Todavía no se generó. Usa el descargo del investigador, el relato de la denuncia y la bitácora cargados hasta ahora, y coteja los dos relatos.
        </p>
      )}
    </div>
  );
}
