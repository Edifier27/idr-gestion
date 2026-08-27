"use client";

import { useMemo, useState } from "react";
import type { SiniestroRow } from "@/lib/db/schema";
import { formatARS } from "@/lib/facturacion";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";
import { tarjetaElevada } from "@/lib/ui";

const ESTADOS = [
  { value: "ingresado", label: "Ingresado" },
  { value: "en_gestion", label: "En gestión" },
  { value: "inspeccionado", label: "Inspeccionado" },
  { value: "elevado", label: "Elevado" },
  { value: "facturado", label: "Facturado" },
  { value: "cerrado", label: "Cerrado" },
];

const ESTADOS_COBRO = [
  { value: "no_facturado", label: "Sin facturar" },
  { value: "facturado", label: "Facturado" },
  { value: "presentado", label: "Presentado" },
  { value: "cobrado", label: "Cobrado" },
  { value: "rechazado", label: "Rechazado" },
];

type QuickFilter = "todos" | "pendientes" | "sin_informe" | "por_facturar" | "por_cobrar" | "vencidos";

function diasRestantes(fechaLimite: string | null): number | null {
  if (!fechaLimite) return null;
  const diff = new Date(fechaLimite).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function esPendiente(r: SiniestroRow) { return !["facturado", "cerrado"].includes(r.estado); }
function esPorFacturar(r: SiniestroRow) { return r.estado === "elevado" && (r.estadoCobro ?? "no_facturado") === "no_facturado"; }
function esPorCobrar(r: SiniestroRow) { return r.estadoCobro === "facturado" || r.estadoCobro === "presentado"; }
function esVencido(r: SiniestroRow) { const d = diasRestantes(r.fechaLimite); return d !== null && d < 0; }
function esSinInforme(r: SiniestroRow) { return !r.informe; }

const SIN_ASIGNAR = "__sin_asignar__";
function claveOperador(r: SiniestroRow) { return r.operador ?? SIN_ASIGNAR; }

export function TablaSiniestros({ rows, esAdmin }: { rows: SiniestroRow[]; esAdmin: boolean }) {
  const [quick, setQuick] = useState<QuickFilter>("todos");
  const [operador, setOperador] = useState("");
  const [compania, setCompania] = useState("");
  const [estado, setEstado] = useState("");
  const [estadoCobro, setEstadoCobro] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const operadores = useMemo(
    () => Array.from(new Set(rows.map(r => r.operador).filter((v): v is string => !!v))).sort(),
    [rows]
  );
  const companias = useMemo(
    () => Array.from(new Set(rows.map(r => r.compania).filter((v): v is string => !!v))).sort(),
    [rows]
  );

  const conteos = useMemo(() => ({
    todos: rows.length,
    pendientes: rows.filter(esPendiente).length,
    sin_informe: rows.filter(esSinInforme).length,
    por_facturar: rows.filter(esPorFacturar).length,
    por_cobrar: rows.filter(esPorCobrar).length,
    vencidos: rows.filter(esVencido).length,
  }), [rows]);

  const porOperador = useMemo(() => {
    const mapa = new Map<string, { pendientes: number; resueltos: number; vencidos: number; total: number }>();
    for (const r of rows) {
      const clave = claveOperador(r);
      const acc = mapa.get(clave) ?? { pendientes: 0, resueltos: 0, vencidos: 0, total: 0 };
      acc.total++;
      if (esPendiente(r)) acc.pendientes++; else acc.resueltos++;
      if (esVencido(r)) acc.vencidos++;
      mapa.set(clave, acc);
    }
    return Array.from(mapa.entries())
      .map(([clave, datos]) => ({ clave, ...datos }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const filtradas = useMemo(() => {
    let out = rows;
    if (quick === "pendientes") out = out.filter(esPendiente);
    else if (quick === "sin_informe") out = out.filter(esSinInforme);
    else if (quick === "por_facturar") out = out.filter(esPorFacturar);
    else if (quick === "por_cobrar") out = out.filter(esPorCobrar);
    else if (quick === "vencidos") out = out.filter(esVencido);

    if (operador) out = out.filter(r => claveOperador(r) === operador);
    if (compania) out = out.filter(r => r.compania === compania);
    if (estado) out = out.filter(r => r.estado === estado);
    if (estadoCobro) out = out.filter(r => (r.estadoCobro ?? "no_facturado") === estadoCobro);

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter(r =>
        (r.asegurado ?? "").toLowerCase().includes(q) ||
        (r.dni ?? "").toLowerCase().includes(q) ||
        (r.nroSiniestro ?? "").toLowerCase().includes(q) ||
        (r.numeroGestion ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, quick, operador, compania, estado, estadoCobro, busqueda]);

  return (
    <div>
      {esAdmin && porOperador.length > 0 && (
        <div className={`mb-4 p-4 ${tarjetaElevada}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Por operador</h2>
            {operador && (
              <button onClick={() => setOperador("")} className="text-xs text-slate underline-offset-2 hover:text-ink hover:underline">
                Ver todos
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {porOperador.map(o => (
              <TarjetaOperador
                key={o.clave}
                nombre={o.clave === SIN_ASIGNAR ? "Sin asignar" : o.clave}
                {...o}
                activo={operador === o.clave}
                onClick={() => setOperador(a => a === o.clave ? "" : o.clave)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <QuickBtn label="Todos" activo={quick === "todos"} n={conteos.todos} onClick={() => setQuick("todos")} />
          <QuickBtn label="Pendientes" activo={quick === "pendientes"} n={conteos.pendientes} onClick={() => setQuick("pendientes")} />
          <QuickBtn label="Sin informe" activo={quick === "sin_informe"} n={conteos.sin_informe} onClick={() => setQuick("sin_informe")} />
          {esAdmin && <QuickBtn label="Por facturar" activo={quick === "por_facturar"} n={conteos.por_facturar} onClick={() => setQuick("por_facturar")} />}
          {esAdmin && <QuickBtn label="Por cobrar" activo={quick === "por_cobrar"} n={conteos.por_cobrar} onClick={() => setQuick("por_cobrar")} />}
          <QuickBtn label="Vencidos" activo={quick === "vencidos"} n={conteos.vencidos} onClick={() => setQuick("vencidos")} />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por asegurado, DNI o N° siniestro..."
            className="min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm transition placeholder:text-slate/60 focus:border-ink/40 focus:outline-none"
          />
          <Select value={operador} onChange={setOperador} placeholder="Operador" opciones={operadores.map(o => ({ value: o, label: o }))} />
          <Select value={compania} onChange={setCompania} placeholder="Compañía" opciones={companias.map(c => ({ value: c, label: c }))} />
          <Select value={estado} onChange={setEstado} placeholder="Estado" opciones={ESTADOS} />
          {esAdmin && <Select value={estadoCobro} onChange={setEstadoCobro} placeholder="Cobro" opciones={ESTADOS_COBRO} />}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm text-slate">Ningún siniestro coincide con los filtros.</p>
        </div>
      ) : (
        <Tabla rows={filtradas} esAdmin={esAdmin} />
      )}
    </div>
  );
}

function QuickBtn({ label, n, activo, onClick }: { label: string; n: number; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
        activo ? "bg-ink text-paper" : "border border-ink/20 bg-white text-ink hover:bg-ink/5"
      }`}
    >
      {label} <span className={activo ? "text-paper/70" : "text-slate"}>({n})</span>
    </button>
  );
}

function TarjetaOperador({ nombre, total, pendientes, resueltos, vencidos, activo, onClick }: {
  nombre: string; total: number; pendientes: number; resueltos: number; vencidos: number; activo: boolean; onClick: () => void;
}) {
  const pctResuelto = total === 0 ? 0 : Math.round((resueltos / total) * 100);
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left shadow-sm transition hover:shadow-md ${
        activo ? "border-ink bg-ink/5" : "border-line bg-white hover:border-ink/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            activo ? "bg-ink text-paper" : "bg-ink/10 text-ink"
          }`}>
            {nombre.trim()[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="truncate text-sm font-semibold text-ink" title={nombre}>{nombre}</span>
        </span>
        {vencidos > 0 && (
          <span className="shrink-0 rounded-full bg-fraude/10 px-1.5 py-0.5 text-[10px] font-semibold text-fraude">
            {vencidos} venc.
          </span>
        )}
      </div>
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-ok transition-[width]" style={{ width: `${pctResuelto}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>
        <span className="text-ok">{resueltos} resuelto{resueltos === 1 ? "" : "s"}</span>
      </div>
    </button>
  );
}

function Select({ value, onChange, placeholder, opciones }: {
  value: string; onChange: (v: string) => void; placeholder: string; opciones: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={placeholder}
      className={`rounded-md border px-2.5 py-1.5 text-sm shadow-sm transition focus:border-ink/40 focus:outline-none ${
        value ? "border-ink/30 bg-ink/5 font-medium text-ink" : "border-line bg-white text-ink"
      }`}
    >
      <option value="">Todos — {placeholder}</option>
      {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Color determinístico por compañía (mismo hash siempre da el mismo color),
// para que la cinta lateral de cada card se distinga sin tener que mantener
// una paleta a mano por cada aseguradora nueva que aparezca.
function colorPorTexto(texto: string): string {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 34%)`;
}

function Tabla({ rows, esAdmin }: { rows: SiniestroRow[]; esAdmin: boolean }) {
  return (
    <div className="space-y-2">
      {rows.map(s => {
        const dias = s.fechaLimite ? Math.ceil((new Date(s.fechaLimite).getTime() - Date.now()) / 86400000) : null;
        const venceColor = dias === null ? "text-slate" : dias < 0 ? "text-fraude" : dias <= 3 ? "text-amber" : "text-slate";
        const venceTexto = dias === null ? "Sin vencimiento" : dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : `Vence en ${dias}d`;
        const compania = s.compania ?? "Sin compañía";
        return (
          <a
            key={s.id}
            href={`/siniestros/${s.id}`}
            className={`group flex overflow-hidden ${tarjetaElevada}`}
          >
            <span
              className="flex w-7 shrink-0 items-center justify-center overflow-hidden py-3 text-center text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ background: colorPorTexto(compania) }}
              title={compania}
            >
              <span className="[writing-mode:vertical-rl] whitespace-nowrap rotate-180">{compania}</span>
            </span>
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <p className="font-mono text-base font-bold text-ink">
                    #{s.numeroGestion ?? s.nroSiniestro ?? "—"}
                  </p>
                  <p className="truncate text-sm text-slate">
                    {s.asegurado ?? "—"} · {s.dni ?? "—"} · {s.tipo ?? "—"}{s.operador ? ` · ${s.operador}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <EstadoBadge estado={s.estado} />
                  {esAdmin && <CobroBadge estado={s.estadoCobro} />}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-ok transition group-hover:gap-1.5">
                  Abrir caso
                  <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
                    <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className={`flex items-center gap-3 text-xs font-medium ${venceColor}`}>
                  {venceTexto}
                  {esAdmin && <span className="tnum text-ink">{formatARS(s.facturar)}</span>}
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
