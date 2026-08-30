"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, selectCampo } from "@/lib/ui";
import { SelectShell } from "@/components/select-shell";
import { notificar } from "@/components/notificaciones";

export type EntradaBitacora = {
  id: string;
  fecha: string | Date;
  tipo: string;
  nota: string;
  autor: string | null;
  autorEsAdmin: boolean | null;
  leida: boolean;
};

const ESTILO_TIPO: Record<string, string> = {
  devolucion: "bg-fraude/10 text-fraude",
  pedido_ayuda: "bg-amber/15 text-amber",
  mail: "bg-ok/10 text-ok",
  nota: "bg-paper text-slate",
  llamado: "bg-paper text-slate",
  visita: "bg-paper text-slate",
};
const ETIQUETA_TIPO: Record<string, string> = {
  devolucion: "🔧 corrección pedida",
  pedido_ayuda: "🆘 pedido de ayuda",
  mail: "mail",
  nota: "nota",
  llamado: "llamado",
  visita: "visita",
};

// Bitácora del caso — además del registro de gestión (llamados, mails), es
// el canal directo entre admin y operador para ese caso puntual: en vez de
// resolver correcciones o dudas por WhatsApp personal (se pierde, no queda
// registro), queda todo acá. Las entradas que el otro rol todavía no vio
// llegan con un puntito — el "leída" se resuelve solo al abrir el caso (ver
// app/(app)/siniestros/[id]/page.tsx), así que lo que se ve marcado acá es
// literalmente "esto era nuevo cuando entraste".
export function BitacoraPanel({ siniestroId, entradasIniciales, esAdmin, nombreOperador }: {
  siniestroId: string;
  entradasIniciales: EntradaBitacora[];
  esAdmin: boolean;
  nombreOperador: string;
}) {
  const router = useRouter();
  const [entradas, setEntradas] = useState(entradasIniciales);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("nota");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/bitacora/${siniestroId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, nota: texto.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar.");
      setEntradas(e => [data.entrada, ...e]);
      setTexto("");
      setTipo("nota");
      router.refresh();
    } catch (err) {
      notificar.error(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={enviar} className="space-y-2 rounded-md border border-line bg-paper p-3">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={esAdmin ? "Escribile algo al operador sobre este caso…" : "Escribile algo al admin sobre este caso…"}
          rows={2}
          className={`w-full resize-none ${campo}`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SelectShell>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={`w-56 ${selectCampo}`}>
              <option value="nota">Nota</option>
              {esAdmin && <option value="devolucion">🔧 Pedir corrección</option>}
              {!esAdmin && <option value="pedido_ayuda">🆘 Necesito ayuda</option>}
            </select>
          </SelectShell>
          <button type="submit" disabled={enviando || !texto.trim()} className={boton.primario}>
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>

      {entradas.length === 0 ? (
        <p className="text-sm text-slate">Sin entradas todavía.</p>
      ) : (
        <div className="space-y-2">
          {entradas.map(n => (
            <div key={n.id} className="relative border-b border-line pb-2 pl-3 last:border-0">
              {!n.leida && n.autorEsAdmin !== null && (
                <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-fraude" title="Sin leer" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${ESTILO_TIPO[n.tipo] ?? "bg-paper text-slate"}`}>
                  {ETIQUETA_TIPO[n.tipo] ?? n.tipo}
                </span>
                <span className="text-xs font-medium text-ink">{n.autor ?? nombreOperador}</span>
                <FechaLocal fecha={n.fecha} />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{n.nota}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Arranca vacío y se completa recién en el cliente (useEffect) — el
// servidor de Vercel corre en UTC y el navegador en hora de Argentina,
// toLocaleString("es-AR") calculado en cada uno da un string distinto para
// la misma fecha, y React tira error de hidratación al no coincidir con lo
// que ya mandó el servidor (mismo problema de fondo que el del link de
// Google Calendar — ver el comentario en caso-wizard.tsx).
function FechaLocal({ fecha }: { fecha: string | Date }) {
  const [texto, setTexto] = useState("");
  useEffect(() => { setTexto(new Date(fecha).toLocaleString("es-AR")); }, [fecha]);
  return <span className="text-xs text-slate">{texto}</span>;
}
