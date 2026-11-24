"use client";

import { useState } from "react";
import { queAdjuntar, seccionesExpediente, type Ramo } from "@/lib/categorias-evidencia";
import { Icono, ICONO_CATEGORIA, COLOR_SECCION } from "@/components/iconos-idr";
import { datosRubro } from "@/lib/tipos-siniestro";

// Etiqueta del rubro (1 a 6), la única segmentación de los casos.
export function RubroChip({ rubro, chico = false }: { rubro: number | null; chico?: boolean }) {
  const r = datosRubro(rubro);
  if (!r) return <span className={`inline-flex items-center gap-1 rounded-full bg-amarillo/25 font-semibold text-ink ${chico ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`} title="El tipo de siniestro no coincide con ningún rubro: corregilo en Datos del siniestro"><Icono n="alerta" size={chico ? 12 : 14} /> Sin rubro</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold text-white shadow-sm ${chico ? "py-0.5 pl-1 pr-1.5 text-[10px]" : "py-0.5 pl-1.5 pr-2 text-xs"}`} style={{ background: `linear-gradient(135deg, ${r.color}D9, ${r.color})` }} title={r.detalle}>
      <Icono n={r.icono} size={chico ? 13 : 15} /> {r.rubro} · {r.nombre}
    </span>
  );
}

// Lista de lo que corresponde adjuntar según el rubro, con ✓ en lo que ya está.
export function QueAdjuntar({ ramo, rubro, presentes, abiertoInicial = false, compacto = false }: {
  ramo: Ramo | null; rubro: number | null; presentes: (string | null | undefined)[]; abiertoInicial?: boolean; compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const secciones = queAdjuntar(ramo, presentes);
  const idSeccion = new Map(seccionesExpediente(ramo).map(s => [s.titulo, s.id]));
  const items = secciones.flatMap(s => s.items);
  const listos = items.filter(i => i.tiene).length;
  const r = datosRubro(rubro);
  return (
    <div className={`rounded-lg border border-line bg-white ${compacto ? "p-2" : "p-3"}`}>
      <button type="button" onClick={() => setAbierto(a => !a)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className={`font-semibold text-ink ${compacto ? "text-xs" : "text-sm"}`}>
          <span className="inline-flex items-center gap-1.5"><Icono n="clip" size={14} /> Qué adjuntar {r ? <span className="inline-flex items-center gap-1" style={{ color: r.color }}>· <Icono n={r.icono} size={14} /> {r.nombre}</span> : "· sin rubro"}</span>
        </span>
        <span className="shrink-0 text-xs text-slate">{listos}/{items.length} {abierto ? "▲" : "▼"}</span>
      </button>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <i className="block h-full rounded-full bg-ok transition-all" style={{ width: `${items.length ? (listos / items.length) * 100 : 0}%` }} />
      </div>
      {!r && <p className="mt-1.5 text-[11px] text-slate">El tipo de siniestro no coincide con ningún rubro: corregilo en Datos del siniestro para saber qué pedir.</p>}
      {abierto && (
        <div className="mt-2 space-y-2">
          {secciones.map(s => (
            <div key={s.titulo}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLOR_SECCION[idSeccion.get(s.titulo) ?? "otros"] }}>{s.titulo}</p>
              <ul className="mt-0.5 space-y-0.5">
                {s.items.map(i => (
                  <li key={i.categoria} className={`flex items-center gap-1.5 text-xs ${i.tiene ? "text-slate line-through decoration-slate/40" : "text-ink"}`}>
                    <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${i.tiene ? "bg-ok text-white" : "border border-slate/40"}`}>{i.tiene ? "✓" : ""}</span>
                    <Icono n={ICONO_CATEGORIA[i.categoria] ?? "documento"} size={14} className={i.tiene ? "opacity-50" : ""} style={{ color: COLOR_SECCION[idSeccion.get(s.titulo) ?? "otros"] }} />
                    {i.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
