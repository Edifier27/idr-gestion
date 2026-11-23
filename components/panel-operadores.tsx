"use client";

import { useMemo, useState } from "react";
import { boton, campo, colorPorTexto } from "@/lib/ui";
import { notificar } from "@/components/notificaciones";
import { etiquetaEtapaContacto } from "@/lib/etapa-contacto";
import type { Pendiente } from "@/lib/pendientes";
import { enPeriodo, PERIODOS, type Periodo } from "@/components/bandeja-whatsapp";
import { RUBROS } from "@/lib/tipos-siniestro";
import { RubroChip } from "@/components/que-adjuntar";

export type CasoPanel = {
  id: string; nro: string | null; asegurado: string | null; tipo: string | null; rubro: number | null;
  etapa: string | null; operador: string | null; orden: number | null; dias: number; pendientes: Pendiente[];
  ingreso: string;
};
export type OperadorPanel = {
  codigo: string; nombre: string; zona: string | null; abiertos: number; urgentes: number; cerradosMes: number;
  porEtapa: Record<"recibido" | "contacto_fallido" | "contactado" | "entrevista_pactada" | "informe_enviado", number>;
};

const ETAPAS: { k: keyof OperadorPanel["porEtapa"]; label: string; color: string }[] = [
  { k: "recibido", label: "Recibido", color: "bg-slate/40" },
  { k: "contacto_fallido", label: "Sin respuesta", color: "bg-fraude" },
  { k: "contactado", label: "Contactado", color: "bg-ok/70" },
  { k: "entrevista_pactada", label: "Entrevista", color: "bg-amber" },
  { k: "informe_enviado", label: "Informe enviado", color: "bg-ok" },
];

const PESO = { urgente: 3, atencion: 2, info: 1 } as const;
const ESTILO = { urgente: "border-fraude/40 bg-fraude/5 text-fraude", atencion: "border-amber/40 bg-amber/5 text-amber", info: "border-line bg-paper text-slate" } as const;

function ordenar(lista: CasoPanel[]) {
  // Primero los que el admin ordenó (en su orden); después el resto, por
  // urgencia de lo pendiente y antigüedad.
  const peso = (c: CasoPanel) => Math.max(0, ...c.pendientes.map(p => PESO[p.tipo]));
  return [...lista].sort((a, b) => {
    if (a.orden != null || b.orden != null) return (a.orden ?? 1e9) - (b.orden ?? 1e9);
    return peso(b) - peso(a) || b.dias - a.dias;
  });
}

export function PanelOperadores({ operadores, casos, inicial }: { operadores: OperadorPanel[]; casos: CasoPanel[]; inicial: string | null }) {
  const [sel, setSel] = useState(inicial);
  const [lista, setLista] = useState(casos);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  // Período de ingreso: para no ver todos los casos del operador de golpe.
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  // Segmento: solo los 6 rubros ("" = todos, "0" = sin rubro).
  const [rubro, setRubro] = useState("");

  const todosSuyos = useMemo(() => ordenar(lista.filter(c => c.operador === sel)), [lista, sel]);
  const enRubro = (c: CasoPanel, r: string) => r === "" || String(c.rubro ?? 0) === r;
  const suyos = useMemo(() => todosSuyos.filter(c => enPeriodo(c.ingreso, periodo) && enRubro(c, rubro)), [todosSuyos, periodo, rubro]);
  const op = operadores.find(o => o.codigo === sel) ?? null;

  async function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= suyos.length) return;
    // Con filtros puestos se intercambian los dos casos dentro de la lista
    // COMPLETA del operador (si no, se renumerarían solo los visibles).
    const nuevo = [...todosSuyos];
    const a = nuevo.findIndex(c => c.id === suyos[i].id), b = nuevo.findIndex(c => c.id === suyos[j].id);
    [nuevo[a], nuevo[b]] = [nuevo[b], nuevo[a]];
    const ordenNuevo = new Map(nuevo.map((c, k) => [c.id, k + 1]));
    setLista(l => l.map(c => (ordenNuevo.has(c.id) ? { ...c, orden: ordenNuevo.get(c.id)! } : c)));
    setGuardandoOrden(true);
    try {
      const res = await fetch("/api/prioridad", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: nuevo.map(c => c.id) }) });
      if (!res.ok) throw new Error();
    } catch {
      notificar.error("No se pudo guardar el orden.");
    } finally {
      setGuardandoOrden(false);
    }
  }

  function abrirPregunta(c: CasoPanel) {
    setAbierta(c.id);
    setTexto(c.pendientes.map(p => `• ${p.pregunta}`).join("\n"));
  }

  async function enviar(c: CasoPanel) {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/bitacora/${c.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "pregunta", nota: texto.trim() }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo enviar.");
      notificar.ok(`Pregunta enviada a ${op?.nombre ?? "el operador"}: la ve en el chat del caso.`);
      setAbierta(null);
      setTexto("");
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {operadores.map(o => {
          const activo = o.codigo === sel;
          const total = Math.max(1, o.abiertos);
          return (
            <button
              key={o.codigo}
              onClick={() => { setSel(o.codigo); setAbierta(null); }}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${activo ? "border-azul ring-2 ring-azul/30" : "border-line hover:border-azul/30"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorPorTexto(o.codigo) }}>{o.nombre.trim()[0]?.toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{o.nombre}</p>
                    <p className="truncate text-xs text-slate">{o.zona ?? o.codigo}</p>
                  </div>
                </div>
                {o.urgentes > 0 && <span className="shrink-0 rounded-full bg-fraude/10 px-2 py-0.5 text-xs font-semibold text-fraude">{o.urgentes} urgente{o.urgentes === 1 ? "" : "s"}</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-3 text-sm">
                <span><b className="text-xl text-ink tabular-nums">{o.abiertos}</b> <span className="text-slate">abiertos</span></span>
                <span className="text-slate"><b className="text-ink tabular-nums">{o.cerradosMes}</b> cerrados este mes</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-paper" title={ETAPAS.map(e => `${e.label}: ${o.porEtapa[e.k]}`).join(" · ")}>
                {ETAPAS.map(e => o.porEtapa[e.k] > 0 && <span key={e.k} className={e.color} style={{ width: `${(o.porEtapa[e.k] / total) * 100}%` }} />)}
              </div>
              <p className="mt-1.5 text-[11px] text-slate">{ETAPAS.filter(e => o.porEtapa[e.k] > 0).map(e => `${e.label} ${o.porEtapa[e.k]}`).join(" · ") || "Sin casos abiertos"}</p>
            </button>
          );
        })}
      </div>

      {op && (
        <section className="rounded-xl border border-line bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Casos de {op.nombre} <span className="text-sm font-normal text-slate">· {suyos.length} abiertos</span></h2>
            <p className="text-xs text-slate">{guardandoOrden ? "Guardando orden…" : "Ordená con las flechas: el operador los ve en ese orden en su tablero."}</p>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PERIODOS.map(x => (
              <button key={x.k} onClick={() => setPeriodo(x.k)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${periodo === x.k ? "bg-azul text-paper" : "bg-paper text-slate hover:text-ink"}`}>
                {x.t} ({todosSuyos.filter(c => enPeriodo(c.ingreso, x.k)).length})
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setRubro("")} className={`rounded-full px-3 py-1 text-xs font-medium transition ${rubro === "" ? "bg-ink text-paper" : "bg-paper text-slate hover:text-ink"}`}>
              Todos los rubros ({todosSuyos.filter(c => enPeriodo(c.ingreso, periodo)).length})
            </button>
            {RUBROS.map(r => {
              const n = todosSuyos.filter(c => enPeriodo(c.ingreso, periodo) && c.rubro === r.rubro).length;
              const activo = rubro === String(r.rubro);
              return (
                <button key={r.rubro} onClick={() => setRubro(activo ? "" : String(r.rubro))} title={r.detalle}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${activo ? "text-white" : "bg-white text-ink hover:opacity-80"}`}
                  style={activo ? { background: r.color, borderColor: r.color } : { borderColor: r.color }}>
                  {r.emoji} {r.rubro} · {r.nombre} ({n})
                </button>
              );
            })}
            {todosSuyos.some(c => !c.rubro) && (
              <button onClick={() => setRubro(rubro === "0" ? "" : "0")} className={`rounded-full px-3 py-1 text-xs font-medium ${rubro === "0" ? "bg-amarillo text-ink" : "bg-amarillo/20 text-ink"}`}>
                ⚠️ Sin rubro ({todosSuyos.filter(c => !c.rubro && enPeriodo(c.ingreso, periodo)).length})
              </button>
            )}
          </div>
          {suyos.length === 0 ? <p className="text-sm text-slate">{todosSuyos.length ? "Ningún caso en este período o rubro." : "No tiene casos abiertos."}</p> : (
            <ol className="divide-y divide-line">
              {suyos.map((c, i) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col items-center">
                      <button onClick={() => mover(i, -1)} disabled={i === 0} className="px-1.5 text-slate hover:text-ink disabled:opacity-30" aria-label="Subir">▲</button>
                      <span className="text-xs font-bold tabular-nums text-ink">{i + 1}</span>
                      <button onClick={() => mover(i, 1)} disabled={i === suyos.length - 1} className="px-1.5 text-slate hover:text-ink disabled:opacity-30" aria-label="Bajar">▼</button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <a href={`/siniestros/${c.id}`} className="font-mono text-sm font-bold text-ink hover:underline">#{c.nro ?? "s/n"}</a>
                        <span className="truncate text-sm text-ink">{c.asegurado ?? "—"}</span>
                        <RubroChip rubro={c.rubro} chico />
                        <span className="text-xs text-slate">{c.tipo ?? "—"} · {etiquetaEtapaContacto(c.etapa)} · {c.dias} días</span>
                      </div>
                      {c.pendientes.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.pendientes.map((p, k) => <span key={k} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTILO[p.tipo]}`}>{p.texto}</span>)}
                        </div>
                      ) : <p className="mt-1 text-xs text-ok">Al día</p>}
                      {abierta === c.id && (
                        <div className="mt-2 space-y-2">
                          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} className={`w-full ${campo}`} />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setAbierta(null)} className={boton.ghost}>Cancelar</button>
                            <button onClick={() => enviar(c)} disabled={enviando || !texto.trim()} className={boton.primario}>{enviando ? "Enviando…" : "Enviar al chat del caso"}</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {abierta !== c.id && (
                      <button onClick={() => abrirPregunta(c)} className={`shrink-0 ${boton.secundario}`}>❓ Preguntar</button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
