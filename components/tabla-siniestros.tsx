"use client";

import { useMemo, useState } from "react";
import type { SiniestroRow } from "@/lib/db/schema";
import { formatARS } from "@/lib/facturacion";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";
import { EtapaContactoBadge } from "@/components/etapa-contacto-badge";
import { PuntoUrgente } from "@/components/punto-urgente";
import { plazoInforme } from "@/lib/etapa-contacto";
import { tarjetaElevada, colorPorTexto, cinta, cintaTexto } from "@/lib/ui";

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

type QuickFilter = "hoy" | "todos" | "pendientes" | "sin_informe" | "por_facturar" | "por_cobrar" | "vencidos" | "cerrados";

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
function esCerrado(r: SiniestroRow) { return r.estado === "cerrado"; }

// "Bandeja de hoy": todo lo que necesita una acción ya — contacto que falló
// (le cae al admin), informe atrasado/por atrasarse (plazo de 48hs desde la
// entrevista), o vencimiento general del caso a menos de 2 días.
function esHoy(r: SiniestroRow) {
  if (esCerrado(r)) return false;
  if (r.etapaContacto === "contacto_fallido") return true;
  const plazo = plazoInforme(r.etapaContacto, r.fechaEntrevista);
  if (plazo === "vencido" || plazo === "atencion") return true;
  const d = diasRestantes(r.fechaLimite);
  return d !== null && d <= 1;
}

// Ordena lo más urgente primero, así lo que necesita atención ya no se
// pierde en el medio de la lista aunque no estés en la pestaña "Hoy".
function prioridad(r: SiniestroRow): number {
  if (r.etapaContacto === "contacto_fallido") return 5;
  const plazo = plazoInforme(r.etapaContacto, r.fechaEntrevista);
  if (plazo === "vencido") return 4;
  const d = diasRestantes(r.fechaLimite);
  if (d !== null && d < 0) return 4;
  if (plazo === "atencion") return 3;
  if (d !== null && d <= 3) return 2;
  return 0;
}

const SIN_ASIGNAR = "__sin_asignar__";
function claveOperador(r: SiniestroRow) { return r.operador ?? SIN_ASIGNAR; }

export function TablaSiniestros({ rows, esAdmin }: { rows: SiniestroRow[]; esAdmin: boolean }) {
  const [quick, setQuick] = useState<QuickFilter>("hoy");
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [operador, setOperador] = useState("");
  const [compania, setCompania] = useState("");
  const [estado, setEstado] = useState("");
  const [estadoCobro, setEstadoCobro] = useState("");
  const [etapaContacto, setEtapaContacto] = useState("");
  const [resultado, setResultado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const operadores = useMemo(
    () => Array.from(new Set(rows.map(r => r.operador).filter((v): v is string => !!v))).sort(),
    [rows]
  );
  const companias = useMemo(
    () => Array.from(new Set(rows.map(r => r.compania).filter((v): v is string => !!v))).sort(),
    [rows]
  );

  // "Todos" y el resto de las bandejas de trabajo dejan afuera lo cerrado —
  // un caso cerrado ya no es parte de la gestión activa. Se ve aparte, en
  // la pestaña "Cerrados".
  const activos = useMemo(() => rows.filter(r => !esCerrado(r)), [rows]);

  const conteos = useMemo(() => ({
    hoy: activos.filter(esHoy).length,
    todos: activos.length,
    pendientes: activos.filter(esPendiente).length,
    sin_informe: activos.filter(esSinInforme).length,
    por_facturar: activos.filter(esPorFacturar).length,
    por_cobrar: activos.filter(esPorCobrar).length,
    vencidos: activos.filter(esVencido).length,
    cerrados: rows.filter(esCerrado).length,
  }), [rows, activos]);

  // Semáforos: conteo por etapa de contacto y por resultado (entre los casos
  // activos), clickeables como filtro — mismo patrón que "Por operador".
  // "recibido" es un valor de filtro propio de la UI (no existe en la DB):
  // representa etapa_contacto en null, o sea, el caso todavía no arrancó el
  // seguimiento de contacto.
  const porEtapa = useMemo(() => ({
    recibido: activos.filter(r => !r.etapaContacto).length,
    contacto_fallido: activos.filter(r => r.etapaContacto === "contacto_fallido").length,
    contactado: activos.filter(r => r.etapaContacto === "contactado").length,
    entrevista_pactada: activos.filter(r => r.etapaContacto === "entrevista_pactada").length,
    informe_enviado: activos.filter(r => r.etapaContacto === "informe_enviado").length,
  }), [activos]);
  const porResultado = useMemo(() => ({
    sin_fraude: activos.filter(r => r.resultado === "sin_fraude").length,
    posible_fraude: activos.filter(r => r.resultado === "posible_fraude").length,
    con_fraude: activos.filter(r => r.resultado === "con_fraude").length,
    desistido: activos.filter(r => r.resultado === "desistido").length,
    rechazo: activos.filter(r => r.resultado === "rechazo").length,
  }), [activos]);

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
    const quiereCerrados = quick === "cerrados" || estado === "cerrado";
    if (!quiereCerrados) out = out.filter(r => !esCerrado(r));

    if (quick === "hoy") out = out.filter(esHoy);
    else if (quick === "cerrados") out = out.filter(esCerrado);
    else if (quick === "pendientes") out = out.filter(esPendiente);
    else if (quick === "sin_informe") out = out.filter(esSinInforme);
    else if (quick === "por_facturar") out = out.filter(esPorFacturar);
    else if (quick === "por_cobrar") out = out.filter(esPorCobrar);
    else if (quick === "vencidos") out = out.filter(esVencido);

    if (operador) out = out.filter(r => claveOperador(r) === operador);
    if (compania) out = out.filter(r => r.compania === compania);
    if (estado) out = out.filter(r => r.estado === estado);
    if (estadoCobro) out = out.filter(r => (r.estadoCobro ?? "no_facturado") === estadoCobro);
    if (etapaContacto === "recibido") out = out.filter(r => !r.etapaContacto);
    else if (etapaContacto) out = out.filter(r => r.etapaContacto === etapaContacto);
    if (resultado) out = out.filter(r => r.resultado === resultado);

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter(r =>
        (r.asegurado ?? "").toLowerCase().includes(q) ||
        (r.dni ?? "").toLowerCase().includes(q) ||
        (r.nroSiniestro ?? "").toLowerCase().includes(q) ||
        (r.numeroGestion ?? "").toLowerCase().includes(q)
      );
    }
    // Lo más urgente primero, siempre — no solo en la pestaña "Hoy".
    return [...out].sort((a, b) => prioridad(b) - prioridad(a));
  }, [rows, quick, operador, compania, estado, estadoCobro, etapaContacto, resultado, busqueda]);

  // El resumen (por operador + resultados) queda un click abajo por default:
  // si algo ahí adentro está activo como filtro, lo mostramos igual para que
  // no quede un filtro "invisible" aplicado.
  const hayFiltroEnResumen = !!operador || !!resultado;

  return (
    <div>
      {/* Caja chica con el flujo operativo día a día — nada más que esto,
          a pedido de Dario: recibido → contactado (sin respuesta u OK) →
          entrevista pactada → informe enviado. Siempre visible, no detrás
          del desplegable, porque es el filtro que más se usa. */}
      <div className="mb-4 rounded-lg border border-line bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate">Seguimiento</p>
          {etapaContacto && (
            <button onClick={() => setEtapaContacto("")} className="text-[10px] text-slate underline-offset-2 hover:text-ink hover:underline">
              Ver todos
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <QuickBtn label="Recibido" n={porEtapa.recibido} activo={etapaContacto === "recibido"} onClick={() => setEtapaContacto(v => v === "recibido" ? "" : "recibido")} />
          <QuickBtn label="Contactado (sin respuesta)" n={porEtapa.contacto_fallido} urgente={porEtapa.contacto_fallido > 0} activo={etapaContacto === "contacto_fallido"} onClick={() => setEtapaContacto(v => v === "contacto_fallido" ? "" : "contacto_fallido")} />
          <QuickBtn label="Contactado (OK)" n={porEtapa.contactado} activo={etapaContacto === "contactado"} onClick={() => setEtapaContacto(v => v === "contactado" ? "" : "contactado")} />
          <QuickBtn label="Entrevista pactada" n={porEtapa.entrevista_pactada} activo={etapaContacto === "entrevista_pactada"} onClick={() => setEtapaContacto(v => v === "entrevista_pactada" ? "" : "entrevista_pactada")} />
          <QuickBtn label="Informe enviado" n={porEtapa.informe_enviado} activo={etapaContacto === "informe_enviado"} onClick={() => setEtapaContacto(v => v === "informe_enviado" ? "" : "informe_enviado")} />
        </div>
      </div>

      <button
        onClick={() => setMostrarResumen(v => !v)}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate transition hover:text-ink"
      >
        <svg viewBox="0 0 20 20" fill="none" className={`h-3 w-3 transition-transform ${mostrarResumen ? "rotate-90" : ""}`}>
          <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {mostrarResumen ? "Ocultar resumen" : "Ver resumen (por operador y por resultado)"}
        {hayFiltroEnResumen && !mostrarResumen && <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] text-ink">filtro activo</span>}
      </button>

      {(mostrarResumen || hayFiltroEnResumen) && (
        <>
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

          {/* Semáforos por resultado — tocá uno para filtrar la tabla por ese
              valor, igual que las tarjetas "Por operador". */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Resultados</p>
              {resultado && (
                <button onClick={() => setResultado("")} className="text-xs text-slate underline-offset-2 hover:text-ink hover:underline">
                  Ver todos
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <MiniStat label="Sin fraude" valor={porResultado.sin_fraude} accent="ok" activo={resultado === "sin_fraude"} onClick={() => setResultado(v => v === "sin_fraude" ? "" : "sin_fraude")} />
              <MiniStat label="Posible fraude" valor={porResultado.posible_fraude} accent="amber" activo={resultado === "posible_fraude"} onClick={() => setResultado(v => v === "posible_fraude" ? "" : "posible_fraude")} />
              <MiniStat label="Fraude" valor={porResultado.con_fraude} accent="fraude" activo={resultado === "con_fraude"} onClick={() => setResultado(v => v === "con_fraude" ? "" : "con_fraude")} />
              <MiniStat label="Desistido" valor={porResultado.desistido} accent="slate" activo={resultado === "desistido"} onClick={() => setResultado(v => v === "desistido" ? "" : "desistido")} />
              <MiniStat label="Rechazo" valor={porResultado.rechazo} accent="fraude" activo={resultado === "rechazo"} onClick={() => setResultado(v => v === "rechazo" ? "" : "rechazo")} />
            </div>
          </div>
        </>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <QuickBtn label="🔥 Hoy" activo={quick === "hoy"} n={conteos.hoy} urgente={conteos.hoy > 0} onClick={() => setQuick("hoy")} />
          <QuickBtn label="Todos" activo={quick === "todos"} n={conteos.todos} onClick={() => setQuick("todos")} />
          <QuickBtn label="Pendientes" activo={quick === "pendientes"} n={conteos.pendientes} onClick={() => setQuick("pendientes")} />
          <QuickBtn label="Sin informe" activo={quick === "sin_informe"} n={conteos.sin_informe} onClick={() => setQuick("sin_informe")} />
          {esAdmin && <QuickBtn label="Por facturar" activo={quick === "por_facturar"} n={conteos.por_facturar} onClick={() => setQuick("por_facturar")} />}
          {esAdmin && <QuickBtn label="Por cobrar" activo={quick === "por_cobrar"} n={conteos.por_cobrar} onClick={() => setQuick("por_cobrar")} />}
          <QuickBtn label="Vencidos" activo={quick === "vencidos"} n={conteos.vencidos} onClick={() => setQuick("vencidos")} />
          <QuickBtn label="Cerrados" activo={quick === "cerrados"} n={conteos.cerrados} onClick={() => setQuick("cerrados")} />
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
          <p className="text-sm text-slate">
            {quick === "hoy" ? "🎉 Nada urgente por hoy." : "Ningún siniestro coincide con los filtros."}
          </p>
        </div>
      ) : (
        <Tabla rows={filtradas} esAdmin={esAdmin} />
      )}
    </div>
  );
}

function QuickBtn({ label, n, activo, urgente, onClick }: { label: string; n: number; activo: boolean; urgente?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
        activo ? "bg-ink text-paper" : "border border-ink/20 bg-white text-ink hover:bg-ink/5"
      }`}
    >
      {urgente && <PuntoUrgente />}
      {label} <span className={activo ? "text-paper/70" : "text-slate"}>({n})</span>
    </button>
  );
}

const COLOR_TEXTO_MINI: Record<string, string> = { ok: "text-ok", amber: "text-amber", fraude: "text-fraude", slate: "text-slate", ink: "text-ink" };
const COLOR_BARRA_MINI: Record<string, string> = { ok: "bg-ok", amber: "bg-amber", fraude: "bg-fraude", slate: "bg-slate", ink: "bg-ink" };

// Caja chica de "semáforo" (conteo por etapa/resultado), clickeable como
// filtro — mismo patrón que TarjetaOperador.
function MiniStat({ label, valor, accent, activo, onClick }: {
  label: string; valor: number; accent: keyof typeof COLOR_TEXTO_MINI; activo: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden p-3 pl-4 text-left shadow-sm transition hover:shadow-md ${
        activo ? "rounded-lg border border-ink bg-ink/5" : `rounded-lg border border-line bg-white hover:border-ink/30`
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${COLOR_BARRA_MINI[accent]}`} />
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className={`tnum text-xl font-bold ${COLOR_TEXTO_MINI[accent]}`}>{valor}</p>
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
      className={`group flex overflow-hidden rounded-lg border text-left shadow-sm transition hover:shadow-md ${
        activo ? "border-ink" : "border-line hover:border-ink/30"
      }`}
    >
      <span className={`w-6 py-2 text-[9px] ${cinta}`} style={{ background: colorPorTexto(nombre) }} title={nombre}>
        <span className={cintaTexto}>{nombre}</span>
      </span>
      <div className={`min-w-0 flex-1 p-3 ${activo ? "bg-ink/5" : "bg-white"}`}>
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
            <span className={`w-7 py-3 text-[10px] ${cinta}`} style={{ background: colorPorTexto(compania) }} title={compania}>
              <span className={cintaTexto}>{compania}</span>
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
                  <EtapaContactoBadge etapaContacto={s.etapaContacto} fechaEntrevista={s.fechaEntrevista} />
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
