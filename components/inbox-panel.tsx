"use client";

import { useEffect, useState } from "react";

type Mensaje = { id: string; asunto: string; de: string; fecha: string; snippet: string; noLeido: boolean };
type MensajeCompleto = Mensaje & { cuerpo: string };

export function InboxPanel() {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<MensajeCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/mensajes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer la bandeja.");
      setMensajes(data.mensajes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer la bandeja.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function abrir(id: string) {
    setCargandoDetalle(true);
    setAbierto(null);
    try {
      const res = await fetch(`/api/gmail/mensajes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer el mail.");
      setAbierto(data.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el mail.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Bandeja de entrada (últimos 25)</h2>
        <button onClick={cargar} disabled={cargando} className="text-xs text-ink underline-offset-2 hover:underline">
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-fraude">{error}</p>}

      {abierto && (
        <div className="mb-4 rounded border border-line bg-paper p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{abierto.asunto}</p>
              <p className="text-xs text-slate">{abierto.de} · {abierto.fecha}</p>
            </div>
            <button onClick={() => setAbierto(null)} className="text-xs text-slate hover:text-ink">Cerrar</button>
          </div>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink">{abierto.cuerpo || abierto.snippet}</pre>
        </div>
      )}
      {cargandoDetalle && <p className="mb-4 text-xs text-slate">Cargando mail…</p>}

      {cargando && !mensajes ? (
        <p className="text-sm text-slate">Cargando…</p>
      ) : mensajes && mensajes.length === 0 ? (
        <p className="text-sm text-slate">Sin mensajes en la bandeja.</p>
      ) : (
        <div className="divide-y divide-line">
          {mensajes?.map(m => (
            <button
              key={m.id}
              onClick={() => abrir(m.id)}
              className="block w-full py-2.5 text-left hover:bg-paper"
            >
              <div className="flex items-center justify-between gap-3">
                <p className={`truncate text-sm ${m.noLeido ? "font-semibold text-ink" : "text-ink"}`}>{m.asunto}</p>
                <span className="shrink-0 text-xs text-slate">{m.fecha}</span>
              </div>
              <p className="truncate text-xs text-slate">{m.de}</p>
              <p className="truncate text-xs text-slate/70">{m.snippet}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
