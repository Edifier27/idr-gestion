"use client";

import { useEffect, useState } from "react";
import { boton, campo, tarjeta } from "@/lib/ui";
import { confirmar } from "@/components/notificaciones";

type CasoImportado = { id: string; etiqueta: string } | null;
type Mensaje = { id: string; asunto: string; de: string; fecha: string; snippet: string; noLeido: boolean; casoImportado?: CasoImportado };
type Adjunto = { attachmentId: string; nombre: string; tipo: string; tamano: number };
type MensajeCompleto = Mensaje & { cuerpo: string; adjuntos: Adjunto[] };

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// El remitente viene como header crudo: `Nombre <mail@dominio.com>` o solo el mail.
function parsearRemitente(de: string): { nombre: string; email: string } {
  const match = de.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) {
    const nombre = match[1].trim();
    return { nombre: nombre || match[2], email: match[2] };
  }
  return { nombre: de, email: de };
}

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? "?").toUpperCase();
}

// En la lista: hora si es de hoy, día+mes si no.
function formatearFechaLista(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function formatearFechaCompleta(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

// operadorFijo: cuando un operador (no admin) usa su propia bandeja, el caso
// se le asigna siempre a sí mismo — no tiene sentido (ni se le permite en el
// backend) que elija a otro operador, así que ni se le muestra el campo.
export function InboxPanel({ operadoresExistentes = [], operadorFijo }: { operadoresExistentes?: string[]; operadorFijo?: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<MensajeCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [importando, setImportando] = useState(false);
  const [operador, setOperador] = useState(operadorFijo ?? "");
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
    setOperador(operadorFijo ?? "");
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

  async function importar(forzar = false) {
    if (!abierto) return;
    if (!operador.trim()) { setError("Elegí a qué operador se le asigna el caso."); return; }
    setError(null);
    setImportando(true);
    try {
      const res = await fetch(`/api/gmail/mensajes/${abierto.id}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador: operador.trim(), forzar }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicado) {
        const seguir = await confirmar(
          `${data.mensaje ?? "Este caso ya existe."} ${data.existente?.etiqueta ?? data.existente?.numeroGestion ?? ""} — ${data.existente?.asegurado ?? ""}. ¿Igual querés crear un caso nuevo (duplicado)?`,
          { textoConfirmar: "Crear igual", peligroso: true }
        );
        if (seguir) return importar(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "No se pudo importar el caso.");
      setImportado({ id: data.siniestro.id, archivos: data.archivosImportados });
      setMostrarImportar(false);
      // Refleja en la lista que este mail ya quedó importado, sin recargar todo.
      setMensajes(lista => lista?.map(m => m.id === abierto.id ? { ...m, casoImportado: { id: data.siniestro.id, etiqueta: data.siniestro.numeroGestion ?? data.siniestro.nroSiniestro ?? "sin número" } } : m) ?? lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar el caso.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className={`p-5 ${tarjeta}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Bandeja de entrada (últimos 25)</h2>
        <button onClick={cargar} disabled={cargando} className={boton.ghost}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm font-medium text-fraude">{error}</p>}

      {abierto && (
        <div className={`mb-4 overflow-hidden ${tarjeta}`}>
          <div className="flex items-start justify-between gap-3 border-b border-line bg-paper/60 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul text-sm font-semibold text-paper">
                {inicial(parsearRemitente(abierto.de).nombre)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{abierto.asunto}</p>
                <p className="truncate text-xs text-slate">{parsearRemitente(abierto.de).nombre}</p>
                <p className="text-xs text-slate/70">{formatearFechaCompleta(abierto.fecha)}</p>
              </div>
            </div>
            <button onClick={() => setAbierto(null)} className="shrink-0 rounded px-2 py-1 text-xs text-slate transition hover:bg-line/60 hover:text-ink">
              ✕ Cerrar
            </button>
          </div>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-ink">{abierto.cuerpo || abierto.snippet}</pre>

          <div className="px-4 pb-4">
            {abierto.adjuntos.length > 0 && (
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                  Adjuntos ({abierto.adjuntos.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {abierto.adjuntos.map(a => (
                    <a
                      key={a.attachmentId}
                      href={`/api/gmail/mensajes/${abierto.id}/adjuntos/${a.attachmentId}?nombre=${encodeURIComponent(a.nombre)}&tipo=${encodeURIComponent(a.tipo)}`}
                      className="rounded border border-azul/20 bg-paper px-2.5 py-1.5 text-xs text-ink transition hover:bg-azul hover:text-paper"
                    >
                      📎 {a.nombre} <span className="text-slate">({formatearTamano(a.tamano)})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {importado ? (
              <div className="mt-3 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm shadow-sm">
                <p className="font-medium text-ok">
                  Caso creado con {importado.archivos} archivo{importado.archivos === 1 ? "" : "s"} de evidencia.
                </p>
                <a href={`/siniestros/${importado.id}`} className="mt-1 inline-block text-xs font-medium text-ink underline underline-offset-2">
                  Ver el caso →
                </a>
              </div>
            ) : mensajes?.find(m => m.id === abierto.id)?.casoImportado ? (
              <div className="mt-3 rounded-lg border border-line bg-paper p-3 text-sm shadow-sm">
                <p className="font-medium text-ink">
                  📋 Este mail ya se usó para crear el caso {mensajes.find(m => m.id === abierto.id)?.casoImportado?.etiqueta}.
                </p>
                <a href={`/siniestros/${mensajes.find(m => m.id === abierto.id)?.casoImportado?.id}`} className="mt-1 inline-block text-xs font-medium text-ink underline underline-offset-2">
                  Ver el caso →
                </a>
              </div>
            ) : abierto.adjuntos.some(a => a.tipo === "application/pdf") ? (
              <div className="mt-3 border-t border-line pt-3">
                {mostrarImportar ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!operadorFijo && (
                      <>
                        <input
                          value={operador}
                          onChange={e => setOperador(e.target.value)}
                          list="operadores-existentes-inbox"
                          placeholder="Operador, ej: NACHO"
                          className={`border-amber/50 bg-amber/5 px-2.5 py-1.5 text-xs uppercase ${campo}`}
                        />
                        <datalist id="operadores-existentes-inbox">
                          {operadoresExistentes.map(o => <option key={o} value={o} />)}
                        </datalist>
                      </>
                    )}
                    <button
                      onClick={() => importar()}
                      disabled={importando}
                      className={`px-3 py-1.5 text-xs ${boton.primario}`}
                    >
                      {importando ? "Creando caso…" : "Confirmar"}
                    </button>
                    <button onClick={() => setMostrarImportar(false)} className={boton.ghost}>Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setMostrarImportar(true)}
                    className={`px-3 py-1.5 text-xs ${boton.secundario}`}
                  >
                    🗂️ Crear legajo desde este mail
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      {cargandoDetalle && <p className="mb-4 text-xs text-slate">Cargando mail…</p>}

      {cargando && !mensajes ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      ) : mensajes && mensajes.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate">Sin mensajes en la bandeja.</p>
      ) : (
        <div className="max-h-[560px] space-y-1 overflow-y-auto pr-0.5">
          {mensajes?.map(m => {
            const remitente = parsearRemitente(m.de);
            const seleccionado = abierto?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => abrir(m.id)}
                className={`flex w-full items-start gap-3 rounded-md border px-2.5 py-2.5 text-left transition ${
                  seleccionado
                    ? "border-azul/20 bg-azul/5"
                    : "border-transparent hover:border-line hover:bg-paper"
                }`}
              >
                <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  m.noLeido ? "bg-azul text-paper" : "bg-line text-slate"
                }`}>
                  {inicial(remitente.nombre)}
                  {m.noLeido && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amarillo" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${m.noLeido ? "font-semibold text-ink" : "text-ink"}`}>{remitente.nombre}</p>
                    <span className="shrink-0 text-xs text-slate">{formatearFechaLista(m.fecha)}</span>
                  </div>
                  <p className={`truncate text-sm ${m.noLeido ? "font-medium text-ink" : "text-slate"}`}>{m.asunto}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-slate/70">{m.snippet}</p>
                    {m.casoImportado && (
                      <span className="shrink-0 rounded-full bg-ok/15 px-1.5 py-0.5 text-[10px] font-semibold text-ok" title={`Ya se creó el caso ${m.casoImportado.etiqueta}`}>
                        ✓ En el CRM
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
