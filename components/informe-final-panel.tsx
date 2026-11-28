"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";
import { confirmar, notificar } from "@/components/notificaciones";
import type { ResumenInforme } from "@/lib/informe-final";

const VEREDICTO = {
  verosimil: { t: "Verosímil", c: "bg-ok text-paper" },
  dudoso: { t: "Dudoso", c: "bg-amber text-paper" },
  no_verosimil: { t: "No verosímil", c: "bg-fraude text-paper" },
} as const;
const SUGERENCIA = { continuidad: "Continuidad del trámite", rechazo: "Rechazo", ampliar: "Ampliar investigación" } as const;

// Informe resumido: para decidir en 20 segundos (mismos puntos críticos que
// las secciones 4 y 5 del informe modelo).
function Resumido({ r }: { r: ResumenInforme }) {
  const v = VEREDICTO[r.veredicto];
  return (
    <div className="space-y-3 p-4 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${v.c}`}>{v.t}</span>
        <span className="text-xs text-slate">confianza {r.confianza}</span>
        <span className="ml-auto rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide">{SUGERENCIA[r.sugerencia]}</span>
      </div>
      {r.conclusion && <p className="text-base font-medium leading-snug">{r.conclusion}</p>}
      <dl className="grid gap-2 sm:grid-cols-3">
        {([["Denuncia (Art. 46)", r.criticos.oportunidad], ["Pruebas", r.criticos.consistencia], ["Indicios de fraude", r.criticos.fraude]] as const).map(([k, val]) => (
          <div key={k} className="rounded-md border border-line bg-white px-3 py-2">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate">{k}</dt>
            <dd className="mt-0.5 text-xs leading-snug">{val || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ok">Lo que lo respalda</p>
          {r.a_favor.length ? <ul className="space-y-1">{r.a_favor.map((x, i) => <li key={i} className="flex gap-1.5 text-xs leading-snug"><span className="text-ok">✓</span>{x}</li>)}</ul> : <p className="text-xs text-slate">Nada concreto.</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fraude">Lo que no cierra</p>
          {r.en_contra.length ? <ul className="space-y-1">{r.en_contra.map((x, i) => <li key={i} className="flex gap-1.5 text-xs leading-snug"><span className="text-fraude">✗</span>{x}</li>)}</ul> : <p className="text-xs text-slate">No surgen inconsistencias.</p>}
        </div>
      </div>
      {r.faltan.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate">Falta</p>
          <ul className="space-y-1">{r.faltan.map((x, i) => <li key={i} className="flex gap-1.5 text-xs leading-snug"><span className="text-slate">○</span>{x}</li>)}</ul>
        </div>
      )}
      {r.sugerencia_texto && <p className="rounded-md bg-ink/[0.04] px-3 py-2 text-xs"><b>Sugerencia:</b> {r.sugerencia_texto}</p>}
    </div>
  );
}

// Igual que InformePanel, pero apunta a /api/informe-final y al campo
// informe_final: la resolución privada del admin, que el operador no ve
// (puedeVerInformeFinal en lib/acceso.ts).
export function InformeFinalPanel({ siniestroId, informeInicial }: { siniestroId: string; informeInicial: string | null }) {
  const router = useRouter();
  // El informe se genera en el servidor: aunque cierres o cambies de página
  // sigue pensando, y al volver esta tarjeta retoma el estado.
  const [generando, setGenerando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [paso, setPaso] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenInforme | null>(null);
  const [vista, setVista] = useState<"resumido" | "completo">("resumido");
  const [resumiendo, setResumiendo] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siguiendo = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const consultar = useCallback(async () => {
    const res = await fetch(`/api/informe-final?id=${siniestroId}`, { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data) return null;
    if (data.resumen) setResumen(data.resumen as ResumenInforme);
    return data as { estado: string | null; inicio: string | null; error: string | null; paso: string | null };
  }, [siniestroId]);

  const seguir = useCallback(async () => {
    if (siguiendo.current) return;
    siguiendo.current = true;
    try {
      while (vivo.current) {
        const e = await consultar();
        if (!e) { await new Promise(r => setTimeout(r, 5000)); continue; }
        if (e.estado === "generando") {
          setGenerando(true);
          if (e.inicio) setInicio(new Date(e.inicio).getTime());
          setPaso(e.paso);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        if (!vivo.current) return;
        setGenerando(false);
        setInicio(null);
        setPaso(null);
        if (e.estado === "error") setError(e.error ?? "No se pudo generar el informe.");
        if (e.estado === "listo") { notificar.ok("El informe de investigación está listo."); router.refresh(); }
        return;
      }
    } finally {
      siguiendo.current = false;
    }
  }, [consultar, router]);

  // Al abrir el caso: si quedó generándose, retomar el seguimiento.
  useEffect(() => {
    consultar().then(e => { if (e?.estado === "generando") seguir(); });
  }, [consultar, seguir]);

  useEffect(() => {
    if (!generando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [generando]);

  async function generar() {
    setError(null);
    setGenerando(true);
    setInicio(Date.now());
    setPaso("Arrancando…");
    window.dispatchEvent(new Event("informe-ia-iniciado"));
    try {
      const res = await fetch("/api/informe-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siniestroId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar la resolución final.");
      seguir();
    } catch (e) {
      setGenerando(false);
      setError(e instanceof Error ? e.message : "Error al generar la resolución final.");
    }
  }

  const transcurrido = inicio ? Math.max(0, Math.floor((ahora - inicio) / 1000)) : 0;
  const reloj = `${Math.floor(transcurrido / 60)}:${String(transcurrido % 60).padStart(2, "0")}`;

  async function armarResumen() {
    setResumiendo(true);
    setError(null);
    try {
      const res = await fetch("/api/informe-final/resumen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siniestroId }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo armar el resumen.");
      setResumen(data.resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo armar el resumen.");
    } finally {
      setResumiendo(false);
    }
  }

  async function borrarTodo() {
    const ok = await confirmar("¿Borrar la resolución final? Esta acción no se puede deshacer.", { textoConfirmar: "Borrar", peligroso: true });
    if (!ok) return;
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ informe_final: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo borrar la resolución final.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al borrar la resolución final.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generar}
          disabled={generando || borrando}
          className={boton.primario}
        >
          {generando ? "La IA está trabajando…" : informeInicial ? "Regenerar informe de investigación" : "Generar informe de investigación con IA"}
        </button>
        {informeInicial && (
          <button
            onClick={borrarTodo}
            disabled={generando || borrando}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-fraude transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {borrando ? "Borrando…" : "Borrar todo"}
          </button>
        )}
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
      {generando && (
        <div className="flex items-start gap-3 rounded-lg border border-azul/20 bg-azul/5 px-4 py-3">
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-azul/30 border-t-azul" aria-hidden />
          <div className="text-sm text-ink">
            <p className="font-medium"><span className="font-mono tabular-nums text-azul">{reloj}</span> · {paso ?? "Trabajando…"}</p>
            <p className="text-xs text-slate">Puede tardar varios minutos. Podés seguir trabajando o cerrar esta página: el informe se sigue generando y queda guardado en este caso.</p>
          </div>
        </div>
      )}
      {informeInicial ? (
        <div className="overflow-hidden rounded-lg border border-ink/20 bg-ink/[0.03]">
          <div className="flex items-center gap-1 border-b border-ink/10 bg-white px-2 pt-1.5">
            {(["resumido", "completo"] as const).map(v => (
              <button key={v} onClick={() => setVista(v)}
                className={`rounded-t-md border-b-2 px-3 py-1.5 text-xs font-semibold transition ${vista === v ? "border-azul text-azul" : "border-transparent text-slate hover:text-ink"}`}>
                {v === "resumido" ? "Resumido" : "Informe completo"}
              </button>
            ))}
            <span className="ml-auto pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate">Privado — solo vos lo ves</span>
          </div>
          {vista === "completo" ? (
            <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-ink">{informeInicial}</pre>
          ) : resumen ? (
            <Resumido r={resumen} />
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-4 text-sm text-slate">
              Este informe todavía no tiene versión resumida.
              <button onClick={armarResumen} disabled={resumiendo || generando} className={boton.secundario}>{resumiendo ? "Resumiendo…" : "Armar resumen"}</button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate">
          Todavía no generaste el informe de investigación. La IA mira cada foto y documento del caso, los perita y redacta el informe con el formato del que se manda a la aseguradora (como el del siniestro 571673). Es un borrador: revisalo y corregilo antes de mandarlo. El operador no lo ve.
        </p>
      )}
    </div>
  );
}
