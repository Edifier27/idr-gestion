"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function KmPanel({ siniestroId, kmTotal, domicilio, lugarHecho }: {
  siniestroId: string;
  kmTotal: number | null;
  domicilio: string | null;
  lugarHecho: string;
}) {
  const router = useRouter();
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [mostrarManual, setMostrarManual] = useState(false);

  async function calcular() {
    setError(null);
    setCalculando(true);
    try {
      const res = await fetch("/api/km", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siniestroId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo calcular el km.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular el km.");
    } finally {
      setCalculando(false);
    }
  }

  async function guardarManual() {
    const valor = Number(manual);
    if (!manual.trim() || Number.isNaN(valor) || valor < 0) {
      setError("Ingresá un número de km válido.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ km_total: valor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el km.");
      setManual("");
      setMostrarManual(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el km.");
    } finally {
      setGuardando(false);
    }
  }

  const faltan = [!domicilio && "el domicilio", !lugarHecho && "el lugar del hecho"].filter(Boolean).join(" y ");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate">Km total</span>
        <div className="flex items-center gap-2">
          <span className="text-ink">{kmTotal != null ? `${kmTotal} km` : "—"}</span>
          <button
            onClick={calcular}
            disabled={calculando}
            className="rounded-md border border-azul/20 bg-white px-2 py-1 text-xs font-medium text-ink shadow-sm transition hover:bg-azul hover:text-paper disabled:opacity-50"
          >
            {calculando ? "Calculando…" : kmTotal != null ? "Recalcular" : "Calcular"}
          </button>
        </div>
      </div>

      {faltan && (
        <p className="text-xs text-amber">Falta {faltan} para calcular con Maps — cargalo a mano.</p>
      )}
      {error && <p className="text-xs text-fraude">{error}</p>}

      {mostrarManual ? (
        <div className="flex items-center gap-2">
          <input
            value={manual}
            onChange={e => setManual(e.target.value)}
            type="number"
            min={0}
            placeholder="Km"
            className="w-24 rounded-md border border-line bg-white px-2 py-1 text-xs shadow-sm focus:border-azul/40 focus:outline-none"
          />
          <button
            onClick={guardarManual}
            disabled={guardando}
            className="rounded-md bg-azul px-2 py-1 text-xs font-medium text-paper shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={() => setMostrarManual(false)} className="text-xs text-slate hover:text-ink">Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setMostrarManual(true)} className="text-xs text-slate underline underline-offset-2 hover:text-ink">
          Cargar km a mano
        </button>
      )}
    </div>
  );
}
