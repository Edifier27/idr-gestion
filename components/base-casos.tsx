"use client";

import { useMemo, useState } from "react";
import { selectCampo } from "@/lib/ui";
import { formatARS } from "@/lib/facturacion";
import { etiquetaEtapaContacto } from "@/lib/etapa-contacto";
import { RUBROS } from "@/lib/tipos-siniestro";

export type FilaBase = {
  id: string; nro: string | null; ingreso: string | null; asegurado: string | null; dni: string | null; telefono: string | null;
  rubro: number | null; tipo: string | null; compania: string | null; operador: string | null; etapa: string | null;
  estado: string; resultado: string; km: number | null; facturar: number | null; cobro: string | null; localidad: string | null;
};

const RESULTADO: Record<string, string> = { pendiente: "Pendiente", sin_fraude: "Sin fraude", con_fraude: "Con fraude", posible_fraude: "Posible fraude", desistido: "Desistido", rechazo: "Rechazo", sin_cobertura: "Sin cobertura" };
const COBRO: Record<string, string> = { no_facturado: "No facturado", facturado: "Facturado", presentado: "Presentado", cobrado: "Cobrado", rechazado: "Rechazado" };

type Col = { k: keyof FilaBase; t: string; plata?: boolean; num?: boolean; fmt?: (f: FilaBase) => string };
const COLUMNAS: Col[] = [
  { k: "nro", t: "N°" },
  { k: "ingreso", t: "Ingreso", fmt: f => (f.ingreso ? f.ingreso.split("-").reverse().join("/") : "—") },
  { k: "asegurado", t: "Asegurado" },
  { k: "dni", t: "DNI" },
  { k: "telefono", t: "Teléfono" },
  { k: "rubro", t: "Rubro", num: true },
  { k: "tipo", t: "Tipo" },
  { k: "compania", t: "Compañía" },
  { k: "operador", t: "Operador" },
  { k: "etapa", t: "Etapa", fmt: f => etiquetaEtapaContacto(f.etapa) },
  { k: "estado", t: "Estado", fmt: f => (f.estado === "cerrado" ? "Cerrado" : "En gestión") },
  { k: "resultado", t: "Resultado", fmt: f => RESULTADO[f.resultado] ?? f.resultado },
  { k: "km", t: "Km", plata: true, num: true },
  { k: "facturar", t: "A facturar", plata: true, num: true, fmt: f => formatARS(f.facturar) },
  { k: "cobro", t: "Cobro", plata: true, fmt: f => (f.cobro ? COBRO[f.cobro] ?? f.cobro : "—") },
];

function normalizar(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function BaseCasos({ filas, verPlata, esAdmin }: { filas: FilaBase[]; verPlata: boolean; esAdmin: boolean }) {
  const [orden, setOrden] = useState<{ k: keyof FilaBase; asc: boolean }>({ k: "ingreso", asc: false });
  const [busqueda, setBusqueda] = useState("");
  const [rubro, setRubro] = useState("");
  const [estado, setEstado] = useState("");
  const [operador, setOperador] = useState("");
  const columnas = COLUMNAS.filter(c => !c.plata || verPlata);
  const operadores = useMemo(() => Array.from(new Set(filas.map(f => f.operador).filter((v): v is string => !!v))).sort(), [filas]);

  const visibles = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const out = filas.filter(f =>
      (!rubro || String(f.rubro ?? "") === rubro) &&
      (!estado || (estado === "cerrado" ? f.estado === "cerrado" : f.estado !== "cerrado")) &&
      (!operador || f.operador === operador) &&
      palabras.every(p => normalizar([f.nro, f.asegurado, f.dni, f.telefono, f.tipo, f.operador, f.localidad, f.compania].filter(Boolean).join(" ")).includes(p)));
    const { k, asc } = orden;
    return out.sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true });
      return asc ? r : -r;
    });
  }, [filas, busqueda, rubro, estado, operador, orden]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por N°, nombre, DNI, teléfono, localidad…"
          className="min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm focus:border-ink/40 focus:outline-none" />
        <select value={rubro} onChange={e => setRubro(e.target.value)} className={selectCampo} aria-label="Rubro">
          <option value="">Todos — Rubro</option>
          {RUBROS.map(r => <option key={r.rubro} value={r.rubro}>{r.rubro} · {r.nombre}</option>)}
        </select>
        <select value={estado} onChange={e => setEstado(e.target.value)} className={selectCampo} aria-label="Estado">
          <option value="">Abiertos y cerrados</option>
          <option value="abierto">Solo en gestión</option>
          <option value="cerrado">Solo cerrados</option>
        </select>
        {esAdmin && (
          <select value={operador} onChange={e => setOperador(e.target.value)} className={selectCampo} aria-label="Operador">
            <option value="">Todos — Operador</option>
            {operadores.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>
      <p className="text-xs text-slate">{visibles.length} de {filas.length} casos</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 bg-paper text-[11px] uppercase tracking-wide text-slate">
            <tr>
              {columnas.map(c => (
                <th key={c.k} className="whitespace-nowrap px-3 py-2 font-semibold">
                  <button onClick={() => setOrden(o => ({ k: c.k, asc: o.k === c.k ? !o.asc : true }))} className="inline-flex items-center gap-1 hover:text-ink">
                    {c.t}{orden.k === c.k ? (orden.asc ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visibles.map(f => (
              <tr key={f.id} className="hover:bg-paper/60">
                {columnas.map(c => (
                  <td key={c.k} className={`whitespace-nowrap px-3 py-1.5 ${c.num ? "text-right tabular-nums" : ""} ${c.k === "nro" ? "font-mono font-semibold" : ""}`}>
                    {c.k === "nro"
                      ? <a href={`/siniestros/${f.id}`} className="text-ink hover:underline">{f.nro ?? "s/n"}</a>
                      : c.fmt ? c.fmt(f) : (f[c.k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
