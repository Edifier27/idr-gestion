"use client";

import { useState } from "react";
import { boton, campo, tarjeta } from "@/lib/ui";
import { ETAPAS_CONTACTO } from "@/lib/etapa-contacto";

type Fila = {
  hoja: string; fila: number; enviado: boolean; nroSiniestro: string; fechaIngreso: string | null;
  nombre: string; tipo: string | null; resultado: string; estadoPlanilla: string | null;
  etapaContacto: string | null; km: number | null; operador: string | null;
};
type Operador = { operador: string; username: string; nombre: string; zona: string; accion: string; password?: string };
type Vista = { filas: Fila[]; repetidas: string[]; avisos: string[] };
type Resultado = { creados: number; repetidas: string[]; operadores: Operador[]; avisos: string[] };

const RESULTADO_TXT: Record<string, string> = {
  pendiente: "Pendiente", sin_fraude: "Sin fraude", con_fraude: "Con fraude", posible_fraude: "Posible fraude",
  desistido: "Desistido", sin_cobertura: "Sin cobertura", rechazo: "Rechazo",
};

export function ImportarPlanillaPanel() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(modo: "vista" | "importar") {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("modo", modo);
      const res = await fetch("/api/importar-planilla", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer la planilla.");
      if (modo === "vista") setVista(data); else { setResultado(data); setVista(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar.");
    } finally {
      setCargando(false);
    }
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-ok/30 bg-ok/5 p-5 text-sm text-ok shadow-sm">
          <p className="font-semibold">Se crearon {resultado.creados} casos.</p>
          {resultado.repetidas.length > 0 && <p className="mt-1 text-slate">Salteados por estar ya cargados: {resultado.repetidas.join(", ")}</p>}
        </div>
        <section className={`p-5 ${tarjeta}`}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Operadores</h2>
          <ul className="space-y-2 text-sm">
            {resultado.operadores.map(o => (
              <li key={o.operador} className="text-ink">
                <span className="font-semibold">{o.nombre}</span> ({o.operador}) · {o.zona} ·{" "}
                {o.accion === "creado"
                  ? <>cuenta nueva: usuario <code className="font-mono">{o.username}</code>, contraseña provisoria <code className="rounded bg-amarillo/30 px-1 font-mono">{o.password}</code></>
                  : <>cuenta <code className="font-mono">{o.username}</code> actualizada</>}
              </li>
            ))}
          </ul>
          {resultado.operadores.some(o => o.password) && (
            <p className="mt-3 text-xs text-slate">Anotá las contraseñas provisorias: no se vuelven a mostrar. Se cambian desde Usuarios.</p>
          )}
        </section>
        <a href="/panel" className={boton.primario}>Ir al tablero</a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className={`p-5 ${tarjeta}`}>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.xls" className={`min-w-0 flex-1 ${campo}`}
            onChange={e => { setArchivo(e.target.files?.[0] ?? null); setVista(null); }} />
          <button onClick={() => enviar("vista")} disabled={!archivo || cargando} className={boton.primario}>
            {cargando && !vista ? "Leyendo…" : "Ver qué se carga"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-fraude">{error}</p>}
      </section>

      {vista && (
        <section className={`p-5 ${tarjeta}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{vista.filas.length} casos nuevos</span>
              {" "}({vista.filas.filter(f => f.enviado).length} enviados, {vista.filas.filter(f => !f.enviado).length} pendientes)
              {vista.repetidas.length > 0 && <span className="text-slate"> · {vista.repetidas.length} ya estaban cargados</span>}
            </p>
            <button onClick={() => enviar("importar")} disabled={cargando || vista.filas.length === 0} className={boton.primario}>
              {cargando ? "Importando…" : `Crear ${vista.filas.length} casos`}
            </button>
          </div>
          <p className="mb-3 text-xs text-slate">
            Los enviados quedan cerrados (en Cerrados, con su km y monto para facturar). Los pendientes quedan en gestión con la etapa que dice la planilla.
            También se actualizan los operadores (nombre completo y zona) y se crean las cuentas que falten.
          </p>
          {vista.avisos.length > 0 && (
            <ul className="mb-3 list-disc pl-5 text-xs text-fraude">{vista.avisos.map(a => <li key={a}>{a}</li>)}</ul>
          )}
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-slate">
                <tr><th className="py-1 pr-2">N°</th><th className="pr-2">Nombre</th><th className="pr-2">Tipo</th><th className="pr-2">Ope</th><th className="pr-2">Km</th><th className="pr-2">Situación</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vista.filas.map(f => (
                  <tr key={`${f.hoja}-${f.fila}`} className="text-ink">
                    <td className="py-1 pr-2 font-mono">{f.nroSiniestro}</td>
                    <td className="pr-2">{f.nombre}</td>
                    <td className="pr-2">{f.tipo ?? "—"}</td>
                    <td className="pr-2">{f.operador ?? "—"}</td>
                    <td className="pr-2">{f.km ?? "—"}</td>
                    <td className="pr-2">
                      {f.enviado
                        ? `Enviado · ${RESULTADO_TXT[f.resultado] ?? f.resultado}`
                        : `${ETAPAS_CONTACTO.find(e => e.value === f.etapaContacto)?.label ?? "Recibido"}${f.estadoPlanilla ? ` · ${f.estadoPlanilla}` : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
