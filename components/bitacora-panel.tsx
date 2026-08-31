"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, selectCampo, colorPorTexto } from "@/lib/ui";
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

const ETIQUETA_TIPO: Record<string, string> = {
  devolucion: "🔧 Corrección pedida",
  pedido_ayuda: "🆘 Pedido de ayuda",
  mail: "✉️ Mail automático",
  nota: "Mensaje",
  llamado: "📞 Llamado",
  visita: "📍 Visita",
};

// Solo devolución/pedido_ayuda llevan chip propio adentro del globo — un
// mensaje común ya se distingue solo por el color del globo (propio/ajeno),
// no necesita etiqueta repitiendo "mensaje".
const TAG_ESTILO: Record<string, string> = {
  devolucion: "bg-fraude text-paper",
  pedido_ayuda: "bg-amber text-paper",
};

// Bitácora del caso — además del registro de gestión (llamados, mails), es
// el canal directo entre admin y operador para ese caso puntual: en vez de
// resolver correcciones o dudas por WhatsApp personal (se pierde, no queda
// registro), queda todo acá. Se muestra como una conversación de chat (cada
// quien de un lado) porque así se lee de un vistazo quién dijo qué, sin
// tener que leer una tabla de "tipo / autor / fecha". Las entradas que el
// otro rol todavía no vio llegan marcadas "Sin leer" — el "leída" se
// resuelve solo al abrir el caso (ver app/(app)/siniestros/[id]/page.tsx).
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

  // La API entrega lo más nuevo primero; para que se lea como una
  // conversación real, acá van del más viejo (arriba) al más nuevo (abajo).
  const enOrden = [...entradas].reverse();

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-white shadow-sm">
      <div className="min-w-0 space-y-3 overflow-y-auto p-3" style={{ maxHeight: 440 }}>
        {enOrden.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate">Todavía no hay mensajes en este caso.</p>
        ) : (
          enOrden.map(n => <Mensaje key={n.id} n={n} esAdmin={esAdmin} nombreOperador={nombreOperador} />)
        )}
      </div>

      <form onSubmit={enviar} className="min-w-0 space-y-2 border-t border-line bg-paper/60 p-3">
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
              <option value="nota">Mensaje</option>
              {esAdmin && <option value="devolucion">🔧 Pedir corrección</option>}
              {!esAdmin && <option value="pedido_ayuda">🆘 Necesito ayuda</option>}
            </select>
          </SelectShell>
          <button type="submit" disabled={enviando || !texto.trim()} className={boton.primario}>
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Mensaje({ n, esAdmin, nombreOperador }: { n: EntradaBitacora; esAdmin: boolean; nombreOperador: string }) {
  // Entradas sin autor son registro automático (ej. el mail de asignación) —
  // no son parte de la conversación entre personas, se muestran como un
  // aviso centrado en vez de un globo de chat de alguien.
  if (n.autorEsAdmin === null) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-paper px-3 py-1 text-center text-[11px] text-slate">
          {ETIQUETA_TIPO[n.tipo] ?? n.tipo} · {n.nota} · <FechaLocal fecha={n.fecha} />
        </span>
      </div>
    );
  }

  const autor = n.autor ?? nombreOperador;
  const propio = esAdmin ? n.autorEsAdmin === true : n.autorEsAdmin === false;
  const tag = TAG_ESTILO[n.tipo];

  return (
    <div className={`flex items-end gap-2 ${propio ? "flex-row-reverse" : ""}`}>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: colorPorTexto(autor) }}
      >
        {autor.charAt(0).toUpperCase()}
      </span>
      <div className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${propio ? "items-end" : "items-start"}`}>
        {!n.leida && <span className="text-[10px] font-semibold text-fraude">● Sin leer</span>}
        <div
          className={`min-w-0 rounded-2xl px-3 py-2 text-sm shadow-sm ${
            propio ? "rounded-br-sm bg-azul text-paper" : "rounded-bl-sm border border-line bg-paper text-ink"
          }`}
        >
          {tag && (
            <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tag}`}>
              {ETIQUETA_TIPO[n.tipo]}
            </span>
          )}
          <p className="whitespace-pre-wrap break-words">{n.nota}</p>
        </div>
        <span className="px-1 text-[10px] text-slate">
          {autor} · <FechaLocal fecha={n.fecha} />
        </span>
      </div>
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
  return <>{texto}</>;
}
