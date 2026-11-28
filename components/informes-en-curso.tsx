"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notificar } from "@/components/notificaciones";

// Indicador fijo (abajo a la derecha, en todas las pantallas del admin) de los
// informes con IA que se están generando: segundero, en qué paso va cada uno y
// aviso cuando termina. Así se puede pedir el informe de un caso, pasar al
// siguiente, pedir otro, y seguir trabajando mientras salen.

type Informe = { id: string; nro: string | null; asegurado: string | null; estado: string; inicio: string | null; fin: string | null; error: string | null; paso: string | null };

function mmss(seg: number) {
  const s = Math.max(0, Math.floor(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function InformesEnCurso() {
  const [informes, setInformes] = useState<Informe[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const anteriores = useRef<Map<string, string>>(new Map());
  const cerrados = useRef<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const res = await fetch("/api/informe-final/en-curso", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.informes) return;
    const lista: Informe[] = data.informes;
    // Aviso cuando uno que estaba generándose termina.
    for (const x of lista) {
      if (anteriores.current.get(x.id) === "generando" && x.estado !== "generando") {
        const nombre = `#${x.nro ?? "s/n"}${x.asegurado ? ` (${x.asegurado})` : ""}`;
        if (x.estado === "listo") notificar.ok(`Listo el informe del caso ${nombre}.`);
        else notificar.error(`No salió el informe del caso ${nombre}: ${x.error ?? "probá de nuevo"}.`);
        setAbierto(true);
      }
    }
    anteriores.current = new Map(lista.map(x => [x.id, x.estado]));
    setInformes(lista);
  }, []);

  const hayEnCurso = informes.some(x => x.estado === "generando");

  // Cada 3 s mientras haya alguno generándose; si no, cada 30 s.
  useEffect(() => {
    cargar();
    const t = setInterval(() => { if (document.visibilityState === "visible") cargar(); }, hayEnCurso ? 3000 : 30000);
    const alIniciar = () => setTimeout(cargar, 800);
    window.addEventListener("informe-ia-iniciado", alIniciar);
    return () => { clearInterval(t); window.removeEventListener("informe-ia-iniciado", alIniciar); };
  }, [cargar, hayEnCurso]);

  useEffect(() => {
    if (!hayEnCurso) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hayEnCurso]);

  const visibles = informes.filter(x => x.estado === "generando" || !cerrados.current.has(x.id));
  if (!visibles.length) return null;
  const enCurso = visibles.filter(x => x.estado === "generando").length;
  const listos = visibles.filter(x => x.estado === "listo").length;

  return (
    <div className="fixed bottom-20 right-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col items-end md:bottom-4">
      {abierto && (
        <div className="mb-2 max-h-[60vh] w-full overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate">Informes con IA</p>
            <button onClick={() => setAbierto(false)} className="rounded px-1.5 text-xs text-slate hover:text-ink" aria-label="Cerrar">✕</button>
          </div>
          <ul className="divide-y divide-line">
            {visibles.map(x => {
              const seg = x.inicio ? ((x.estado === "generando" ? ahora : new Date(x.fin ?? Date.now()).getTime()) - new Date(x.inicio).getTime()) / 1000 : 0;
              return (
                <li key={x.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  {x.estado === "generando"
                    ? <span className="mt-1 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-azul/30 border-t-azul" aria-hidden />
                    : <span className={`mt-0.5 shrink-0 text-sm ${x.estado === "listo" ? "text-ok" : "text-fraude"}`}>{x.estado === "listo" ? "✓" : "!"}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">#{x.nro ?? "s/n"} · {x.asegurado ?? "—"}</p>
                    <p className="truncate text-xs text-slate">
                      <span className="font-mono tabular-nums">{mmss(seg)}</span>
                      {" · "}
                      {x.estado === "generando" ? (x.paso ?? "Trabajando…") : x.estado === "listo" ? "Listo" : (x.error ?? "No salió")}
                    </p>
                  </div>
                  {x.estado === "generando" ? null : (
                    <span className="flex shrink-0 items-center gap-1">
                      <Link href={`/siniestros/${x.id}#resolucion`} className="rounded bg-azul px-2 py-1 text-[11px] font-semibold text-paper hover:opacity-90">Ver</Link>
                      <button onClick={() => { cerrados.current.add(x.id); setInformes(l => [...l]); }} className="rounded px-1 text-xs text-slate hover:text-ink" aria-label="Quitar de la lista">✕</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button onClick={() => setAbierto(a => !a)}
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition ${enCurso ? "bg-azul text-paper" : "bg-ok text-paper"}`}>
        {enCurso ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-hidden /> : <span>✓</span>}
        {enCurso ? `${enCurso} informe${enCurso === 1 ? "" : "s"} generándose` : `${listos} informe${listos === 1 ? "" : "s"} listo${listos === 1 ? "" : "s"}`}
        {enCurso > 0 && listos > 0 && <span className="rounded-full bg-paper/25 px-1.5 text-xs">{listos} listo{listos === 1 ? "" : "s"}</span>}
      </button>
    </div>
  );
}
