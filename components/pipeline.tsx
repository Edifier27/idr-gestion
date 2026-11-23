"use client";

import { useMemo, useState } from "react";
import { colorPorTexto, selectCampo } from "@/lib/ui";
import { notificar } from "@/components/notificaciones";
import { RUBROS } from "@/lib/tipos-siniestro";

export type TarjetaCaso = {
  id: string; nro: string | null; asegurado: string | null; tipo: string | null; rubro: number | null;
  operador: string | null; etapa: string | null; cerrado: boolean; resultado: string; dias: number;
  entrevista: string | null; derivado: boolean;
};

const COLUMNAS = [
  { id: "recibido", titulo: "Recibido", tono: "border-t-slate/50" },
  { id: "contacto_fallido", titulo: "Sin respuesta", tono: "border-t-fraude" },
  { id: "contactado", titulo: "Contactado", tono: "border-t-ok/70" },
  { id: "entrevista_pactada", titulo: "Entrevista pactada", tono: "border-t-amber" },
  { id: "informe_enviado", titulo: "Informe enviado", tono: "border-t-ok" },
  { id: "cerrado", titulo: "Cerrado (30 días)", tono: "border-t-ink" },
] as const;
type Columna = (typeof COLUMNAS)[number]["id"];

const RESULTADO: Record<string, string> = { sin_fraude: "Sin fraude", con_fraude: "Con fraude", posible_fraude: "Posible fraude", desistido: "Desistido", rechazo: "Rechazo", sin_cobertura: "Sin cobertura" };

function columnaDe(t: TarjetaCaso): Columna {
  if (t.cerrado) return "cerrado";
  return (t.etapa as Columna) ?? "recibido";
}

function normalizar(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Pipeline({ tarjetas, esAdmin, operadores }: { tarjetas: TarjetaCaso[]; esAdmin: boolean; operadores: string[] }) {
  const [lista, setLista] = useState(tarjetas);
  const [operador, setOperador] = useState("");
  const [rubro, setRubro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Columna | null>(null);

  const visibles = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    return lista.filter(t =>
      (!operador || t.operador === operador) &&
      (!rubro || String(t.rubro ?? "") === rubro) &&
      palabras.every(p => normalizar(`${t.nro ?? ""} ${t.asegurado ?? ""} ${t.tipo ?? ""}`).includes(p)));
  }, [lista, operador, rubro, busqueda]);

  async function mover(id: string, destino: Columna) {
    const t = lista.find(x => x.id === id);
    if (!t || columnaDe(t) === destino) return;
    if ((destino === "cerrado" || t.cerrado) && !esAdmin) { notificar.error("Cerrar o reabrir un caso lo hace el administrador."); return; }
    const body: Record<string, unknown> = destino === "cerrado"
      ? { estado: "cerrado" }
      : { etapa_contacto: destino === "recibido" ? null : destino, ...(t.cerrado ? { estado: "en_gestion" } : {}) };
    const antes = lista;
    setLista(l => l.map(x => x.id === id ? { ...x, cerrado: destino === "cerrado", etapa: destino === "cerrado" ? x.etapa : destino === "recibido" ? null : destino } : x));
    try {
      const res = await fetch(`/api/siniestros/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo mover el caso.");
    } catch (e) {
      setLista(antes);
      notificar.error(e instanceof Error ? e.message : "No se pudo mover el caso.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por N°, nombre o tipo…"
          className="min-w-[200px] flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm focus:border-ink/40 focus:outline-none" />
        {esAdmin && (
          <select value={operador} onChange={e => setOperador(e.target.value)} className={selectCampo} aria-label="Operador">
            <option value="">Todos — Operador</option>
            {operadores.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select value={rubro} onChange={e => setRubro(e.target.value)} className={selectCampo} aria-label="Rubro">
          <option value="">Todos — Rubro</option>
          {RUBROS.map(r => <option key={r.rubro} value={r.rubro}>{r.rubro} · {r.nombre}</option>)}
        </select>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3">
          {COLUMNAS.map(col => {
            const deCol = visibles.filter(t => columnaDe(t) === col.id);
            return (
              <div
                key={col.id}
                onDragOver={e => { e.preventDefault(); setSobre(col.id); }}
                onDragLeave={() => setSobre(s => (s === col.id ? null : s))}
                onDrop={e => { e.preventDefault(); setSobre(null); const id = e.dataTransfer.getData("text/plain"); if (id) mover(id, col.id); }}
                className={`flex min-h-[60vh] flex-col rounded-lg border border-t-4 bg-paper/60 ${col.tono} ${sobre === col.id ? "border-azul ring-2 ring-azul/30" : "border-line"}`}
              >
                <div className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
                  <h2 className="text-sm font-semibold text-ink">{col.titulo}</h2>
                  <span className="text-xs font-semibold tabular-nums text-slate">{deCol.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {deCol.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); setArrastrando(t.id); }}
                      onDragEnd={() => setArrastrando(null)}
                      className={`cursor-grab rounded-md border border-line bg-white shadow-sm transition active:cursor-grabbing ${arrastrando === t.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex">
                        <span className="w-1.5 shrink-0 rounded-l-md" style={{ background: colorPorTexto(t.operador ?? "Sin operador") }} title={t.operador ?? "Sin operador"} />
                        <div className="min-w-0 flex-1 p-2.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <a href={`/siniestros/${t.id}`} className="font-mono text-xs font-bold text-ink hover:underline">#{t.nro ?? "s/n"}</a>
                            <span className="text-[10px] tabular-nums text-slate">{t.dias} d</span>
                          </div>
                          <p className="truncate text-sm font-medium text-ink">{t.asegurado ?? "—"}</p>
                          <p className="truncate text-[11px] text-slate">{t.rubro ? `${t.rubro} · ` : ""}{t.tipo ?? "Sin tipo"}{esAdmin && t.operador ? ` · ${t.operador}` : ""}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.derivado && !t.cerrado && <span className="rounded-full bg-fraude/10 px-1.5 text-[10px] font-semibold text-fraude">Derivado</span>}
                            {t.etapa === "entrevista_pactada" && t.entrevista && <span className="rounded-full bg-amber/10 px-1.5 text-[10px] font-semibold text-amber">{new Date(t.entrevista).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>}
                            {t.cerrado && RESULTADO[t.resultado] && <span className="rounded-full bg-ink/5 px-1.5 text-[10px] font-semibold text-ink">{RESULTADO[t.resultado]}</span>}
                          </div>
                          {/* En el celular no hay arrastre: se mueve con este selector. */}
                          <select
                            value={columnaDe(t)}
                            onChange={e => mover(t.id, e.target.value as Columna)}
                            className="mt-1.5 w-full rounded border border-line bg-white px-1 py-0.5 text-[11px] text-slate md:hidden"
                            aria-label="Mover a"
                          >
                            {COLUMNAS.filter(c => esAdmin || c.id !== "cerrado" || t.cerrado).map(c => <option key={c.id} value={c.id}>Mover a: {c.titulo}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  {deCol.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate/70">Sin casos</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
