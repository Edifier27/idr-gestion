"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";
import { confirmar, notificar } from "@/components/notificaciones";

// Igual que InformePanel, pero apunta a /api/informe-final y al campo
// informe_final: la resolución privada del admin, que el operador no ve
// (puedeVerInformeFinal en lib/acceso.ts).
export function InformeFinalPanel({ siniestroId, informeInicial }: { siniestroId: string; informeInicial: string | null }) {
  const router = useRouter();
  // El informe se genera en el servidor: aunque cierres o cambies de página
  // sigue pensando, y al volver esta tarjeta retoma el estado.
  const [generando, setGenerando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
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
    return data as { estado: string | null; inicio: string | null; error: string | null };
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
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        if (!vivo.current) return;
        setGenerando(false);
        setInicio(null);
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
            {borrando ? "Borrando…" : "🗑 Borrar todo"}
          </button>
        )}
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
      {generando && (
        <div className="flex items-start gap-3 rounded-lg border border-azul/20 bg-azul/5 px-4 py-3">
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-azul/30 border-t-azul" aria-hidden />
          <div className="text-sm text-ink">
            <p className="font-medium">Mirando cada prueba y redactando el informe · {reloj}</p>
            <p className="text-xs text-slate">Puede tardar varios minutos. Podés seguir trabajando o cerrar esta página: el informe se sigue generando y queda guardado en este caso.</p>
          </div>
        </div>
      )}
      {informeInicial ? (
        <div className="overflow-hidden rounded-lg border border-ink/20 bg-ink/[0.03]">
          <div className="flex items-center gap-1.5 border-b border-ink/10 bg-white px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">🔒 Privado — solo vos lo ves</span>
          </div>
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-ink">{informeInicial}</pre>
        </div>
      ) : (
        <p className="text-sm text-slate">
          Todavía no generaste el informe de investigación. La IA mira cada foto y documento del caso, los perita y redacta el informe con el formato del que se manda a la aseguradora (como el del siniestro 571673). Es un borrador: revisalo y corregilo antes de mandarlo. El operador no lo ve.
        </p>
      )}
    </div>
  );
}
