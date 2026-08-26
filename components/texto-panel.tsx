"use client";

import { useState } from "react";

// Editor genérico de un campo de texto libre del caso (descargo, relato_denuncia,
// etc.), guardado vía PATCH /api/siniestros/[id]. Reusado donde haga falta cargar
// o corregir a mano un texto que normalmente viene de la extracción con IA.
export function TextoPanel({ siniestroId, campo, valorInicial, placeholder, etiquetaGuardar }: {
  siniestroId: string;
  campo: string;
  valorInicial: string | null;
  placeholder: string;
  etiquetaGuardar: string;
}) {
  const [texto, setTexto] = useState(valorInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: texto }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo guardar.");
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const cambio = texto !== (valorInicial ?? "");

  return (
    <div className="space-y-2">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={6}
        placeholder={placeholder}
        className="w-full resize-y rounded border border-line bg-white p-3 text-sm text-ink focus:border-ink/40 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !cambio}
          className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : etiquetaGuardar}
        </button>
        {guardado && <span className="text-xs text-ok">Guardado.</span>}
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
    </div>
  );
}
