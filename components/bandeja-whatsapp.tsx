"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, colorPorTexto, selectCampo } from "@/lib/ui";
import { notificar } from "@/components/notificaciones";
import { CATEGORIAS_EVIDENCIA, etiquetaCategoriaEvidencia } from "@/lib/categorias-evidencia";

export type Conversacion = {
  id: string; telefono: string; nombre: string | null; operador: string | null; nombre_operador: string | null;
  ultimo_en: string; ultimo_texto: string | null; no_leidos: number; ventana_hasta: string | null; pendientes: number;
};
export type Mensaje = {
  id: string; conversacion_id: string; direccion: "entrante" | "saliente"; tipo: string; texto: string | null;
  media_url: string | null; media_mime: string | null; media_nombre: string | null; estado: string | null;
  siniestro_id: string | null; categoria: string | null; asignacion: string | null; asignacion_nota: string | null;
  autor: string | null; creado_en: string; caso_nro: string | null; caso_nombre: string | null; conv_operador: string | null;
};
export type CasoOpcion = { id: string; nro: string | null; asegurado: string | null; operador: string | null; tipo: string | null };
export type OperadorTel = { operador: string; nombre: string; telefono: string | null };

function hora(iso: string) {
  const d = new Date(iso);
  const hoy = new Date().toDateString() === d.toDateString();
  return hoy ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function normalizar(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function BandejaWhatsapp({ conversaciones, seleccionadaId, vistaSin, mensajes, casos, operadores }: {
  conversaciones: Conversacion[]; seleccionadaId: string | null; vistaSin: boolean; mensajes: Mensaje[];
  casos: CasoOpcion[]; operadores: OperadorTel[];
}) {
  const router = useRouter();
  const sel = conversaciones.find(c => c.id === seleccionadaId) ?? null;
  const totalPendientes = conversaciones.reduce((a, c) => a + c.pendientes, 0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // Nuevos mensajes: se vuelve a pedir la pantalla cada 8 segundos.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, seleccionadaId]);

  useEffect(() => {
    if (sel && sel.no_leidos > 0) {
      fetch("/api/whatsapp/leido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacionId: sel.id }) }).catch(() => {});
    }
  }, [sel?.id, sel?.no_leidos]); // eslint-disable-line react-hooks/exhaustive-deps

  const ventanaAbierta = !!sel?.ventana_hasta && new Date(sel.ventana_hasta).getTime() > Date.now();

  async function enviar() {
    if (!sel || !texto.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/whatsapp/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacionId: sel.id, texto }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo enviar.");
      setTexto("");
      router.refresh();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <a href="/whatsapp?vista=sin" className={`flex items-center justify-between border-b border-line px-4 py-3 text-sm font-semibold ${vistaSin ? "bg-amber/10 text-amber" : "text-ink hover:bg-paper"}`}>
          <span>📥 Sin asignar</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${totalPendientes ? "bg-amber text-paper" : "bg-paper text-slate"}`}>{totalPendientes}</span>
        </a>
        <div className="flex-1 divide-y divide-line overflow-y-auto">
          {conversaciones.length === 0 && <p className="p-4 text-sm text-slate">Todavía no llegó ningún WhatsApp. Probá con el simulador de abajo.</p>}
          {conversaciones.map(c => {
            const nombre = c.nombre_operador ?? c.nombre ?? c.telefono;
            const activo = !vistaSin && c.id === seleccionadaId;
            return (
              <a key={c.id} href={`/whatsapp?c=${c.id}`} className={`flex gap-3 px-4 py-3 transition ${activo ? "bg-azul/5" : "hover:bg-paper"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorPorTexto(c.operador ?? c.telefono) }}>{nombre.trim()[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{nombre}</span>
                    <span className="shrink-0 text-[11px] text-slate">{hora(c.ultimo_en)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate">{c.operador ? "" : "⚠️ Sin operador · "}{c.ultimo_texto ?? ""}</span>
                    <span className="flex shrink-0 gap-1">
                      {c.pendientes > 0 && <span className="rounded-full bg-amber/15 px-1.5 text-[10px] font-bold text-amber">{c.pendientes}</span>}
                      {c.no_leidos > 0 && <span className="rounded-full bg-ok px-1.5 text-[10px] font-bold text-white">{c.no_leidos}</span>}
                    </span>
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        <Simulador operadores={operadores} ocupado={simulando} setOcupado={setSimulando} onListo={() => router.refresh()} />
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        {vistaSin ? (
          <>
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-semibold text-ink">Sin asignar</h2>
              <p className="text-xs text-slate">Pruebas que la IA no pudo ubicar o que esperan respuesta del operador. Elegí el caso y la categoría.</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-paper/50 p-4">
              {mensajes.length === 0 && <p className="text-sm text-slate">No hay nada pendiente. 🎉</p>}
              {mensajes.map(m => (
                <div key={m.id} className="rounded-lg border border-line bg-white p-3">
                  <p className="mb-2 text-xs text-slate">{m.conv_operador ?? "Sin operador"} · {new Date(m.creado_en).toLocaleString("es-AR")}{m.texto ? ` · "${m.texto}"` : ""}</p>
                  <Adjunto m={m} />
                  <Asignador m={m} casos={casos} operador={m.conv_operador} onListo={() => router.refresh()} />
                </div>
              ))}
            </div>
          </>
        ) : !sel ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate">Elegí un chat.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <h2 className="font-semibold text-ink">{sel.nombre_operador ?? sel.nombre ?? sel.telefono}</h2>
                <p className="text-xs text-slate">+{sel.telefono}{sel.operador ? ` · Operador ${sel.operador}` : " · número sin vincular: cargalo en Usuarios"}</p>
              </div>
              <span className={`text-xs ${ventanaAbierta ? "text-ok" : "text-slate"}`}>{ventanaAbierta ? "Ventana de 24 h abierta" : "Ventana de 24 h cerrada"}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#EDE8E0] p-4 dark:bg-paper">
              {mensajes.map(m => (
                <div key={m.id} className={`flex ${m.direccion === "saliente" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.direccion === "saliente" ? "bg-[#D7F0E8] text-ink" : "bg-white text-ink"}`}>
                    {m.direccion === "saliente" && m.autor && <p className="mb-0.5 text-[10px] font-semibold text-slate">{m.autor}</p>}
                    {m.media_url && <Adjunto m={m} />}
                    {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                    {m.media_url && <EstadoAsignacion m={m} />}
                    {m.media_url && (m.asignacion === "sin_asignar" || m.asignacion === "pregunta") && (
                      <Asignador m={m} casos={casos} operador={sel.operador} onListo={() => router.refresh()} />
                    )}
                    <p className="mt-0.5 text-right text-[10px] text-slate">{new Date(m.creado_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}{m.direccion === "saliente" && m.estado ? ` · ${m.estado}` : ""}</p>
                  </div>
                </div>
              ))}
              <div ref={finRef} />
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                rows={1}
                disabled={!ventanaAbierta}
                placeholder={ventanaAbierta ? "Escribile al operador…" : "Pasaron más de 24 h: WhatsApp no deja escribir hasta que el operador vuelva a escribir"}
                className={`min-w-0 flex-1 resize-none ${campo}`}
              />
              <button onClick={enviar} disabled={enviando || !texto.trim() || !ventanaAbierta} className={boton.primario}>{enviando ? "…" : "Enviar"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Adjunto({ m }: { m: Mensaje }) {
  if (!m.media_url) return null;
  if (m.media_mime?.startsWith("image/")) {
    return (
      <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.media_url} alt={m.media_nombre ?? "foto"} className="max-h-60 rounded-md object-contain" />
      </a>
    );
  }
  return (
    <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink hover:underline">
      📎 {m.media_nombre ?? "archivo"}
    </a>
  );
}

function EstadoAsignacion({ m }: { m: Mensaje }) {
  if (m.asignacion === "asignado") {
    return (
      <a href={`/siniestros/${m.siniestro_id}`} className="mt-1 inline-block rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok hover:underline" title={m.asignacion_nota ?? undefined}>
        ✓ {m.caso_nombre ?? "Caso"} #{m.caso_nro ?? "s/n"}{m.categoria ? ` · ${etiquetaCategoriaEvidencia(m.categoria)}` : ""}
      </a>
    );
  }
  if (m.asignacion === "pregunta") return <p className="mt-1 text-[11px] font-semibold text-amber" title={m.asignacion_nota ?? undefined}>❓ Se le preguntó al operador de qué caso es</p>;
  if (m.asignacion === "sin_asignar") return <p className="mt-1 text-[11px] font-semibold text-fraude">Sin asignar{m.asignacion_nota ? ` · ${m.asignacion_nota}` : ""}</p>;
  if (m.asignacion === "pendiente") return <p className="mt-1 text-[11px] text-slate">La IA lo está ubicando…</p>;
  return null;
}

function Asignador({ m, casos, operador, onListo }: { m: Mensaje; casos: CasoOpcion[]; operador: string | null; onListo: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [caso, setCaso] = useState("");
  const [categoria, setCategoria] = useState(m.categoria ?? "");
  const [guardando, setGuardando] = useState(false);
  // Primero los casos de ese operador; con búsqueda, todos.
  const opciones = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const base = palabras.length ? casos : casos.filter(c => !operador || c.operador === operador);
    return base.filter(c => palabras.every(p => normalizar(`${c.nro ?? ""} ${c.asegurado ?? ""} ${c.operador ?? ""}`).includes(p))).slice(0, 30);
  }, [busqueda, casos, operador]);

  async function guardar() {
    if (!caso) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/whatsapp/asignar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensajeId: m.id, siniestroId: caso, categoria }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo asignar.");
      notificar.ok("Guardado en la evidencia del caso.");
      onListo();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo asignar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-line bg-paper/60 p-2">
      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar caso por apellido o N°…" className={`w-full text-xs ${campo}`} />
      <div className="flex flex-wrap gap-1.5">
        <select value={caso} onChange={e => setCaso(e.target.value)} className={`min-w-0 flex-1 text-xs ${selectCampo}`} aria-label="Caso">
          <option value="">Elegí el caso…</option>
          {opciones.map(c => <option key={c.id} value={c.id}>#{c.nro ?? "s/n"} · {c.asegurado ?? "—"}{c.operador ? ` · ${c.operador}` : ""}</option>)}
        </select>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className={`text-xs ${selectCampo}`} aria-label="Categoría">
          <option value="">Sin categoría</option>
          {CATEGORIAS_EVIDENCIA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={guardar} disabled={!caso || guardando} className={`text-xs ${boton.primario}`}>{guardando ? "…" : "Guardar"}</button>
      </div>
    </div>
  );
}

function Simulador({ operadores, ocupado, setOcupado, onListo }: { operadores: OperadorTel[]; ocupado: boolean; setOcupado: (v: boolean) => void; onListo: () => void }) {
  const conTel = operadores.filter(o => o.telefono);
  const [telefono, setTelefono] = useState(conTel[0]?.telefono ?? "");
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [abierto, setAbierto] = useState(false);

  async function mandar() {
    setOcupado(true);
    try {
      const fd = new FormData();
      fd.append("telefono", telefono);
      fd.append("texto", texto);
      if (archivo) fd.append("archivo", archivo);
      const res = await fetch("/api/whatsapp/simular", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo simular.");
      setTexto("");
      setArchivo(null);
      onListo();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo simular.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="border-t border-line p-3">
      <button onClick={() => setAbierto(a => !a)} className="w-full text-left text-xs font-semibold text-slate hover:text-ink">
        🧪 Simular un WhatsApp de un operador {abierto ? "▲" : "▼"}
      </button>
      {abierto && (
        <div className="mt-2 space-y-1.5">
          {conTel.length === 0 ? (
            <p className="text-xs text-slate">Cargale el WhatsApp a algún operador en Usuarios, o escribí un número.</p>
          ) : (
            <select value={telefono} onChange={e => setTelefono(e.target.value)} className={`w-full text-xs ${selectCampo}`} aria-label="Operador">
              {conTel.map(o => <option key={o.operador} value={o.telefono ?? ""}>{o.nombre} ({o.operador})</option>)}
            </select>
          )}
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono (ej. 1123456789)" className={`w-full text-xs ${campo}`} />
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Texto (ej. 'te mando lo de Gómez')" className={`w-full text-xs ${campo}`} />
          <input type="file" accept="image/*,.pdf" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="w-full text-xs" />
          <button onClick={mandar} disabled={ocupado || !telefono || (!texto.trim() && !archivo)} className={`w-full text-xs ${boton.secundario}`}>
            {ocupado ? "Procesando (la IA está mirando el archivo)…" : "Mandar como el operador"}
          </button>
        </div>
      )}
    </div>
  );
}
