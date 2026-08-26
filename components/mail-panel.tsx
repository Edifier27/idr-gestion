"use client";

import { useState } from "react";

type Archivo = { id: string; nombre: string; tipo: string };

export function MailPanel({ siniestroId, destinatarioSugerido, archivos }: {
  siniestroId: string;
  destinatarioSugerido: string | null;
  archivos: Archivo[];
}) {
  const [para, setPara] = useState(destinatarioSugerido ?? "");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<"ok" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSeleccionados(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);
    setError(null);
    try {
      const res = await fetch("/api/mail/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siniestroId, para, asunto, cuerpo,
          evidenciaIds: Array.from(seleccionados),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar.");
      setResultado("ok");
      setAsunto(""); setCuerpo(""); setSeleccionados(new Set());
    } catch (e) {
      setResultado("error");
      setError(e instanceof Error ? e.message : "Error al enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Para</span>
        <input type="email" value={para} onChange={e => setPara(e.target.value)} required
          className="w-full rounded border border-line px-3 py-1.5 text-sm focus:border-ink/40 focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Asunto</span>
        <input value={asunto} onChange={e => setAsunto(e.target.value)} required
          className="w-full rounded border border-line px-3 py-1.5 text-sm focus:border-ink/40 focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Mensaje</span>
        <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={5}
          className="w-full resize-y rounded border border-line px-3 py-2 text-sm focus:border-ink/40 focus:outline-none" />
      </label>

      {archivos.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate">Adjuntar de la evidencia</span>
            <button
              type="button"
              onClick={() => setSeleccionados(s => s.size === archivos.length ? new Set() : new Set(archivos.map(a => a.id)))}
              className="text-xs font-medium text-ink underline-offset-2 hover:underline"
            >
              {seleccionados.size === archivos.length ? "Quitar selección" : "Seleccionar todo"}
            </button>
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-line p-2">
            {archivos.map(a => (
              <label key={a.id} className="flex items-center gap-2 text-xs text-ink">
                <input type="checkbox" checked={seleccionados.has(a.id)} onChange={() => toggle(a.id)} />
                {a.nombre}
              </label>
            ))}
          </div>
        </div>
      )}

      <button type="submit" disabled={enviando}
        className="rounded bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar mail"}
      </button>
      {resultado === "ok" && <p className="text-xs text-ok">Mail enviado.</p>}
      {resultado === "error" && <p className="text-xs text-fraude">{error}</p>}
    </form>
  );
}
