"use client";

import { useEffect, useState } from "react";

type Mensaje = { id: string; asunto: string; de: string; fecha: string; snippet: string; noLeido: boolean };
type Adjunto = { attachmentId: string; nombre: string; tipo: string; tamano: number };
type MensajeCompleto = Mensaje & { cuerpo: string; adjuntos: Adjunto[] };

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InboxPanel({ operadoresExistentes = [] }: { operadoresExistentes?: string[] }) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<MensajeCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [importando, setImportando] = useState(false);
  const [operador, setOperador] = useState("");
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [importado, setImportado] = useState<{ id: string; archivos: number } | null>(null);

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
    setMostrarImportar(false);
    setImportado(null);
    setOperador("");
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

  async function importar() {
    if (!abierto) return;
    if (!operador.trim()) { setError("Elegí a qué operador se le asigna el caso."); return; }
    setError(null);
    setImportando(true);
    try {
      const res = await fetch(`/api/gmail/mensajes/${abierto.id}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador: operador.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo importar el caso.");
      setImportado({ id: data.siniestro.id, archivos: data.archivosImportados });
      setMostrarImportar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar el caso.");
    } finally {
      setImportando(false);
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

          {abierto.adjuntos.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                Adjuntos ({abierto.adjuntos.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {abierto.adjuntos.map(a => (
                  <a
                    key={a.attachmentId}
                    href={`/api/gmail/mensajes/${abierto.id}/adjuntos/${a.attachmentId}?nombre=${encodeURIComponent(a.nombre)}&tipo=${encodeURIComponent(a.tipo)}`}
                    className="rounded border border-ink/20 bg-white px-2.5 py-1.5 text-xs text-ink transition hover:bg-ink hover:text-paper"
                  >
                    📎 {a.nombre} <span className="text-slate">({formatearTamano(a.tamano)})</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {importado ? (
            <div className="mt-3 rounded border border-ok/30 bg-ok/5 p-3 text-sm">
              <p className="text-ok">
                Caso creado con {importado.archivos} archivo{importado.archivos === 1 ? "" : "s"} de evidencia.
              </p>
              <a href={`/siniestros/${importado.id}`} className="mt-1 inline-block text-xs font-medium text-ink underline underline-offset-2">
                Ver el caso →
              </a>
            </div>
          ) : abierto.adjuntos.some(a => a.tipo === "application/pdf") ? (
            <div className="mt-3 border-t border-line pt-3">
              {mostrarImportar ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={operador}
                    onChange={e => setOperador(e.target.value)}
                    list="operadores-existentes-inbox"
                    placeholder="Operador, ej: NACHO"
                    className="rounded border border-amber/50 bg-amber/5 px-2.5 py-1.5 text-xs uppercase focus:border-ink/40 focus:outline-none"
                  />
                  <datalist id="operadores-existentes-inbox">
                    {operadoresExistentes.map(o => <option key={o} value={o} />)}
                  </datalist>
                  <button
                    onClick={importar}
                    disabled={importando}
                    className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                  >
                    {importando ? "Creando caso…" : "Confirmar"}
                  </button>
                  <button onClick={() => setMostrarImportar(false)} className="text-xs text-slate hover:text-ink">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarImportar(true)}
                  className="rounded border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper"
                >
                  🗂️ Crear legajo desde este mail
                </button>
              )}
            </div>
          ) : null}
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
