"use client";

import { useState } from "react";
import { boton, campo } from "@/lib/ui";
import { erroresRecientes } from "@/lib/errores-navegador";

// Ventana de "Reportar un problema" (solo admin, se abre desde abajo del
// menú). La IA contesta al toque y el reporte sale por mail.
export function ReportarProblema({ onCerrar }: { onCerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ respuesta: string | null; mailA: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/reportar-problema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: texto, pagina: window.location.pathname + window.location.search, errores: erroresRecientes() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar el reporte.");
      setResultado(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el reporte.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-azul/60 p-4 md:items-center" onClick={onCerrar}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Reportar un problema</h2>
          <button onClick={onCerrar} className="text-slate hover:text-ink" aria-label="Cerrar">✕</button>
        </div>

        {!resultado ? (
          <>
            <p className="mb-2 text-sm text-slate">Contá qué estabas haciendo y qué pasó. Se manda con la pantalla en la que estás.</p>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={5}
              autoFocus
              placeholder='Ej: "En el caso 566586 toco Guardar en los km y no pasa nada"'
              className={`w-full resize-y ${campo}`}
            />
            {error && <p className="mt-2 text-sm font-medium text-fraude">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onCerrar} className={boton.ghost}>Cancelar</button>
              <button onClick={enviar} disabled={enviando || !texto.trim()} className={boton.primario}>
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Respuesta</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{resultado.respuesta ?? "Recibido. La IA no pudo contestar ahora, pero el reporte quedó registrado."}</p>
            <p className="mt-4 rounded-md bg-paper px-3 py-2 text-xs text-slate">
              {resultado.mailA
                ? `El reporte completo se mandó a ${resultado.mailA}.`
                : "No se pudo mandar el mail (¿Gmail conectado?). El reporte quedó guardado igual."}
            </p>
            <div className="mt-3 flex justify-end">
              <button onClick={onCerrar} className={boton.primario}>Listo</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
