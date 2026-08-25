"use client";

import { useMemo, useState } from "react";
import type { SiniestroRow } from "@/lib/db/schema";
import { formatARS } from "@/lib/facturacion";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";

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
        <div className="mb-4 rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Por vendedor</h2>
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
            className="min-w-[220px] flex-1 rounded border border-line bg-white px-3 py-1.5 text-sm text-ink placeholder:text-slate/60 focus:border-ink/40 focus:outline-none"
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
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        activo ? "bg-ink text-paper" : "border border-ink/20 text-ink hover:bg-ink/5"
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
      className={`rounded-lg border p-3 text-left transition ${
        activo ? "border-ink bg-ink/5" : "border-line bg-white hover:border-ink/30 hover:bg-paper"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink" title={nombre}>{nombre}</span>
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
      className="rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Tabla({ rows, esAdmin }: { rows: SiniestroRow[]; esAdmin: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-slate">
            <th className="px-3 py-3 font-medium">Gestión</th>
            <th className="px-3 py-3 font-medium">Asegurado</th>
            <th className="px-3 py-3 font-medium">Tipo</th>
            <th className="px-3 py-3 font-medium">Estado</th>
            {esAdmin && <th className="px-3 py-3 font-medium">Cobro</th>}
            <th className="px-3 py-3 font-medium">Vence</th>
            {esAdmin && <th className="px-3 py-3 text-right font-medium">Facturar</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const dias = s.fechaLimite ? Math.ceil((new Date(s.fechaLimite).getTime() - Date.now()) / 86400000) : null;
            const venceColor = dias === null ? "" : dias < 0 ? "text-fraude font-semibold" : dias <= 3 ? "text-amber font-semibold" : "text-slate";
            return (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                <td className="px-3 py-3">
                  <a href={`/siniestros/${s.id}`} className="font-mono text-ink underline-offset-2 hover:underline">
                    {s.numeroGestion ?? "—"}
                  </a>
                  <span className="ml-2 font-mono text-xs text-slate">{s.nroSiniestro ?? ""}</span>
                </td>
                <td className="px-3 py-3">{s.asegurado ?? "—"}</td>
                <td className="px-3 py-3 text-slate">{s.tipo ?? "—"}</td>
                <td className="px-3 py-3"><EstadoBadge estado={s.estado} /></td>
                {esAdmin && <td className="px-3 py-3"><CobroBadge estado={s.estadoCobro} /></td>}
                <td className={`px-3 py-3 ${venceColor}`}>
                  {dias === null ? "—" : dias < 0 ? `hace ${Math.abs(dias)}d` : `${dias}d`}
                </td>
                {esAdmin && <td className="tnum px-3 py-3 text-right font-medium">{formatARS(s.facturar)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
