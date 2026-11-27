"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { esPdf } from "@/lib/adjuntos";
import { boton, campo, tarjeta } from "@/lib/ui";
import { confirmar, notificar } from "@/components/notificaciones";
import { Icono } from "@/components/iconos-idr";

// Casilla de mail dentro del CRM, con lo de todos los días de Gmail: carpetas
// (Recibidos, No leídos, Destacados, Con adjuntos, Enviados, Todos),
// buscador con la misma sintaxis de Gmail, mails viejos sin límite (de a 30,
// "cargar más antiguos"), fecha en globito por día y en cada mail, lectura
// con el formato original (HTML), responder, responder a todos, reenviar
// (con los adjuntos) y redactar. Más lo propio del CRM: crear el legajo desde
// el mail y ver si ya se subió.
//
// modo "completo" (página Mail): lista y lectura lado a lado.
// modo "compacto" (al costado del tablero): una columna.

type CasoImportado = { id: string; etiqueta: string; subidoEn?: string; operador?: string | null; automatico?: boolean } | null;
type LecturaAuto = { resultado: string; detalle: string | null; en: string } | null;
type Mensaje = {
  id: string; threadId?: string; asunto: string; de: string; para?: string; fecha: string; snippet: string;
  noLeido: boolean; destacado?: boolean; enviado?: boolean; conAdjuntos?: boolean; casoImportado?: CasoImportado; lecturaAuto?: LecturaAuto;
};
type Adjunto = { attachmentId: string; nombre: string; tipo: string; tamano: number };
type MensajeCompleto = Mensaje & { cuerpo: string; cuerpoHtml: string; adjuntos: Adjunto[]; cc: string; responderA: string };
type ModoRedactar = "nuevo" | "responder" | "responder_todos" | "reenviar";
type Borrador = { modo: ModoRedactar; origen: MensajeCompleto | null; para: string; cc: string; asunto: string; cuerpo: string; conAdjuntos: boolean; archivos: File[] };

const CARPETAS = [
  { k: "recibidos", t: "Recibidos" },
  { k: "no_leidos", t: "No leídos" },
  { k: "destacados", t: "Destacados" },
  { k: "adjuntos", t: "Con adjuntos" },
  { k: "enviados", t: "Enviados" },
  { k: "todos", t: "Todos" },
] as const;

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// El remitente viene como header crudo: `Nombre <mail@dominio.com>` o solo el mail.
function parsearRemitente(de: string): { nombre: string; email: string } {
  const match = de.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) {
    const nombre = match[1].trim();
    return { nombre: nombre || match[2], email: match[2] };
  }
  return { nombre: de, email: de };
}
const emailsDe = (lista: string) => lista.split(",").map(x => parsearRemitente(x.trim()).email.toLowerCase()).filter(Boolean);

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? "?").toUpperCase();
}

function colorPorTexto(t: string) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 45% 42%)`;
}

const fecha = (iso: string) => new Date(iso);
const valida = (d: Date) => !Number.isNaN(d.getTime());
function mismoDia(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

// Globito del día, como los separadores de WhatsApp: Hoy, Ayer, el día de la
// semana si es de esta semana, la fecha (con año si no es de este año).
function etiquetaDia(iso: string): string {
  const d = fecha(iso);
  if (!valida(d)) return "Sin fecha";
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, hoy)) return "Hoy";
  if (mismoDia(d, ayer)) return "Ayer";
  const dias = (hoy.getTime() - d.getTime()) / 86_400_000;
  if (dias < 7) return d.toLocaleDateString("es-AR", { weekday: "long" });
  return d.toLocaleDateString("es-AR", d.getFullYear() === hoy.getFullYear()
    ? { weekday: "long", day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" });
}

// Globito de fecha en cada mail: hora si es de hoy; si no, día y hora.
function fechaCorta(iso: string): string {
  const d = fecha(iso);
  if (!valida(d)) return iso;
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (mismoDia(d, new Date())) return hora;
  const anio = d.getFullYear() !== new Date().getFullYear();
  return `${d.toLocaleDateString("es-AR", anio ? { day: "2-digit", month: "short", year: "2-digit" } : { day: "2-digit", month: "short" })} · ${hora}`;
}

function fechaCompleta(iso: string): string {
  const d = fecha(iso);
  return valida(d) ? d.toLocaleString("es-AR", { dateStyle: "full", timeStyle: "short" }) : iso;
}

function diaYHora(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `el ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} a las ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Globo debajo de cada mail: a qué legajo se subió, cuándo y cómo (o qué
// dijo la lectura automática del mail si no era un caso).
function GloboSubido({ caso, auto }: { caso?: CasoImportado; auto?: LecturaAuto }) {
  if (caso) {
    return (
      <div className="relative mt-2 ml-2 inline-block max-w-full rounded-lg bg-ok/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-ink ring-1 ring-ok/25 before:absolute before:-top-1.5 before:left-4 before:h-3 before:w-3 before:rotate-45 before:bg-[inherit] before:content-['']">
        <span className="relative"><Icono n="ok" size={14} className="mr-1 inline align-[-3px] text-ok" />Caso subido al legajo <b>{caso.etiqueta}</b> {diaYHora(caso.subidoEn)}{caso.automatico ? " · automático" : ""}{caso.operador ? ` · ${caso.operador}` : " · sin operador"}</span>
      </div>
    );
  }
  if (auto) {
    const texto = auto.resultado === "duplicado" ? "Ya estaba en el CRM" : auto.resultado === "error" ? "No se pudo leer" : "La IA lo revisó: no es un caso";
    return (
      <div className="mt-2 ml-2 inline-block max-w-full rounded-lg bg-paper px-2.5 py-1 text-[11px] text-slate ring-1 ring-line" title={auto.detalle ?? ""}>
        <Icono n={auto.resultado === "error" ? "alerta" : "ojo"} size={13} className="mr-1 inline align-[-2px]" />{texto} · {diaYHora(auto.en)}
      </div>
    );
  }
  return null;
}

// El HTML del mail, aislado: sin scripts (sandbox sin allow-scripts) y con los
// links abriendo en otra pestaña. La altura se ajusta al contenido.
function CuerpoHtml({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [alto, setAlto] = useState(320);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    body{margin:0;padding:16px;font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;word-wrap:break-word}
    img{max-width:100%;height:auto} table{max-width:100%} pre{white-space:pre-wrap}
  </style></head><body>${html}</body></html>`;
  function medir() {
    const b = ref.current?.contentDocument?.body;
    if (b) setAlto(Math.min(Math.max(b.scrollHeight + 8, 120), 4000));
  }
  return (
    <iframe ref={ref} title="Contenido del mail" srcDoc={doc} onLoad={() => { medir(); setTimeout(medir, 400); }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="block w-full border-0 bg-white" style={{ height: alto }} />
  );
}

// operadorFijo: cuando un operador (no admin) usa su propia bandeja, el caso
// se le asigna siempre a sí mismo — no tiene sentido (ni se le permite en el
// backend) que elija a otro operador, así que ni se le muestra el campo.
export function InboxPanel({ operadoresExistentes = [], operadorFijo, modo = "compacto" }: { operadoresExistentes?: string[]; operadorFijo?: string; modo?: "completo" | "compacto" }) {
  const completo = modo === "completo";
  const [carpeta, setCarpeta] = useState<string>("recibidos");
  const [busqueda, setBusqueda] = useState("");
  const [buscado, setBuscado] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [casilla, setCasilla] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [abierto, setAbierto] = useState<MensajeCompleto | null>(null);
  const [verTexto, setVerTexto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [importando, setImportando] = useState(false);
  const [operador, setOperador] = useState(operadorFijo ?? "");
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [importado, setImportado] = useState<{ id: string; archivos: number } | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pedido = useRef(0);
  const finLista = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async (mas = false, pagina: string | null = null) => {
    const n = ++pedido.current;
    if (mas) setCargandoMas(true); else { setCargando(true); setError(null); }
    try {
      const params = new URLSearchParams({ carpeta });
      if (buscado) params.set("q", buscado);
      if (mas && pagina) params.set("pagina", pagina);
      const res = await fetch(`/api/gmail/mensajes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer la casilla.");
      if (n !== pedido.current) return; // llegó tarde: ya se pidió otra carpeta/búsqueda
      setMensajes(lista => (mas && lista ? [...lista, ...data.mensajes.filter((m: Mensaje) => !lista.some(x => x.id === m.id))] : data.mensajes));
      setSiguiente(data.siguiente ?? null);
      setTotal(data.total ?? 0);
      if (data.casilla) setCasilla(data.casilla);
    } catch (e) {
      if (n === pedido.current) setError(e instanceof Error ? e.message : "Error al leer la casilla.");
    } finally {
      if (n === pedido.current) { setCargando(false); setCargandoMas(false); }
    }
  }, [carpeta, buscado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mails más viejos al llegar al final de la lista (y con el botón).
  useEffect(() => {
    const el = finLista.current;
    if (!el || !siguiente) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting && !cargandoMas) cargar(true, siguiente); }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [siguiente, cargandoMas, cargar]);

  function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setBuscado(busqueda.trim());
  }

  async function abrir(id: string) {
    setCargandoDetalle(true);
    setAbierto(null);
    setVerTexto(false);
    setMostrarImportar(false);
    setImportado(null);
    setBorrador(null);
    setOperador(operadorFijo ?? "");
    try {
      const res = await fetch(`/api/gmail/mensajes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer el mail.");
      setAbierto(data.mensaje);
      setMensajes(lista => lista?.map(m => (m.id === id ? { ...m, noLeido: false } : m)) ?? lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el mail.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function redactar(modoR: ModoRedactar, origen: MensajeCompleto | null = null) {
    if (!origen) { setBorrador({ modo: "nuevo", origen: null, para: "", cc: "", asunto: "", cuerpo: "", conAdjuntos: false, archivos: [] }); return; }
    const yo = (casilla ?? "").toLowerCase();
    const remitente = origen.responderA || origen.de;
    const citado = `\n\n\nEl ${fechaCompleta(origen.fecha)}, ${origen.de} escribió:\n${(origen.cuerpo || origen.snippet).split("\n").map(l => `> ${l}`).join("\n")}`;
    const prefijo = (p: string) => (origen.asunto.toLowerCase().startsWith(p.toLowerCase()) ? origen.asunto : `${p} ${origen.asunto}`);
    if (modoR === "reenviar") {
      setBorrador({
        modo: modoR, origen, para: "", cc: "", asunto: prefijo("Fwd:"), conAdjuntos: origen.adjuntos.length > 0, archivos: [],
        cuerpo: `\n\n---------- Mensaje reenviado ----------\nDe: ${origen.de}\nFecha: ${fechaCompleta(origen.fecha)}\nAsunto: ${origen.asunto}\nPara: ${origen.para ?? ""}\n\n${origen.cuerpo || origen.snippet}`,
      });
      return;
    }
    // Si el mail lo mandé yo, "responder" vuelve a los destinatarios originales.
    const propio = emailsDe(origen.de)[0] === yo;
    const para = propio ? (origen.para ?? "") : remitente;
    let cc = "";
    if (modoR === "responder_todos") {
      const ya = new Set([...emailsDe(para), yo]);
      cc = [origen.para ?? "", origen.cc].join(",").split(",").map(x => x.trim()).filter(x => x && !ya.has(parsearRemitente(x).email.toLowerCase())).join(", ");
    }
    setBorrador({ modo: modoR, origen, para, cc, asunto: prefijo("Re:"), cuerpo: citado, conAdjuntos: false, archivos: [] });
  }

  async function enviar() {
    if (!borrador) return;
    if (!borrador.para.trim()) { notificar.error("Falta a quién mandarlo."); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("para", borrador.para);
      fd.append("cc", borrador.cc);
      fd.append("asunto", borrador.asunto);
      fd.append("cuerpo", borrador.cuerpo);
      fd.append("modo", borrador.modo);
      if (borrador.origen) fd.append("origen", borrador.origen.id);
      if (borrador.conAdjuntos) fd.append("con_adjuntos_originales", "1");
      for (const f of borrador.archivos) fd.append("archivos", f);
      const res = await fetch("/api/gmail/enviar", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo mandar el mail.");
      notificar.ok("Mail enviado.");
      setBorrador(null);
      if (carpeta === "enviados") cargar();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo mandar el mail.");
    } finally {
      setEnviando(false);
    }
  }

  async function importar(forzar = false) {
    if (!abierto) return;
    if (!operador.trim()) { setError("Elegí a qué operador se le asigna el caso."); return; }
    setError(null);
    setImportando(true);
    try {
      const res = await fetch(`/api/gmail/mensajes/${abierto.id}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador: operador.trim(), forzar }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicado) {
        const seguir = await confirmar(
          `${data.mensaje ?? "Este caso ya existe."} ${data.existente?.etiqueta ?? data.existente?.numeroGestion ?? ""} — ${data.existente?.asegurado ?? ""}. ¿Igual querés crear un caso nuevo (duplicado)?`,
          { textoConfirmar: "Crear igual", peligroso: true }
        );
        if (seguir) return importar(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "No se pudo importar el caso.");
      setImportado({ id: data.siniestro.id, archivos: data.archivosImportados });
      setMostrarImportar(false);
      setMensajes(lista => lista?.map(m => m.id === abierto.id ? { ...m, casoImportado: { id: data.siniestro.id, etiqueta: data.siniestro.numeroGestion ?? data.siniestro.nroSiniestro ?? "sin número", subidoEn: data.siniestro.creadoEn, operador: data.siniestro.operador } } : m) ?? lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar el caso.");
    } finally {
      setImportando(false);
    }
  }

  const casoDelAbierto = abierto ? mensajes?.find(m => m.id === abierto.id)?.casoImportado : null;
  const nombreCarpeta = CARPETAS.find(c => c.k === carpeta)?.t ?? "";

  const barra = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{buscado ? `Resultados de “${buscado}”` : nombreCarpeta}</h2>
          <p className="truncate text-[11px] text-slate">
            {casilla ?? "Casilla conectada"}{mensajes ? ` · ${mensajes.length}${siguiente ? ` de ~${Math.max(total, mensajes.length)}` : ""} mails` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => cargar()} disabled={cargando} className={boton.ghost} title="Buscar mails nuevos">
            {cargando ? "Actualizando…" : "↻ Actualizar"}
          </button>
          <button onClick={() => redactar("nuevo")} className={`px-3 py-1.5 text-xs ${boton.primario}`}>✎ Redactar</button>
        </div>
      </div>
      <form onSubmit={buscar} className="relative">
        <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar en el mail (nombre, asunto, N° de siniestro…)"
          className={`w-full pl-8 pr-16 ${campo}`} aria-label="Buscar en el mail" />
        {buscado && (
          <button type="button" onClick={() => { setBusqueda(""); setBuscado(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-slate hover:text-ink">
            ✕ Limpiar
          </button>
        )}
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CARPETAS.map(c => (
          <button key={c.k} onClick={() => setCarpeta(c.k)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${carpeta === c.k ? "bg-azul text-paper" : "bg-paper text-slate hover:text-ink"}`}>
            {c.t}
          </button>
        ))}
      </div>
      {!completo ? null : (
        <p className="text-[10.5px] text-slate/80">
          Tip: igual que en Gmail — <code>from:</code>aseguradora, <code>subject:</code>siniestro, <code>has:attachment</code>, <code>before:2025/01/01</code>.
        </p>
      )}
    </div>
  );

  const lista = (
    cargando && !mensajes ? (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-line/70" />
            </div>
          </div>
        ))}
      </div>
    ) : mensajes && mensajes.length === 0 ? (
      <p className="py-8 text-center text-sm text-slate">{buscado ? "No se encontró ningún mail." : "No hay mails en esta carpeta."}</p>
    ) : (
      <div className={`space-y-0.5 overflow-y-auto pr-0.5 ${completo ? "max-h-[calc(100vh-290px)] min-h-[300px]" : "max-h-[560px]"} ${cargando ? "opacity-60" : ""}`}>
        {mensajes?.map((m, i) => {
          const nuevoDia = i === 0 || !mismoDia(fecha(m.fecha), fecha(mensajes[i - 1].fecha));
          const persona = parsearRemitente(m.enviado ? `Para: ${parsearRemitente(m.para ?? "").nombre}` : m.de);
          const seleccionado = abierto?.id === m.id;
          return (
            <div key={m.id}>
              {nuevoDia && (
                <div className="sticky top-0 z-10 flex justify-center py-1.5">
                  <span className="rounded-full border border-line bg-white/95 px-3 py-0.5 text-[11px] font-semibold text-slate shadow-sm backdrop-blur first-letter:uppercase">
                    {etiquetaDia(m.fecha)}
                  </span>
                </div>
              )}
              <button onClick={() => abrir(m.id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-2.5 py-2.5 text-left transition ${seleccionado ? "border-azul/25 bg-azul/5" : "border-transparent hover:border-line hover:bg-paper"}`}>
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: m.noLeido ? colorPorTexto(persona.email) : "#cbd5e1" }}>
                  {inicial(persona.nombre)}
                  {m.noLeido && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amarillo" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${m.noLeido ? "font-semibold text-ink" : "text-ink"}`}>{persona.nombre}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] tabular-nums ${m.noLeido ? "bg-azul/10 font-semibold text-azul" : "bg-paper text-slate"}`} title={fechaCompleta(m.fecha)}>
                      {fechaCorta(m.fecha)}
                    </span>
                  </div>
                  <p className={`truncate text-sm ${m.noLeido ? "font-medium text-ink" : "text-slate"}`}>
                    {m.destacado && <span className="mr-1 text-amber">★</span>}{m.asunto}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-slate/70">{m.snippet}</p>
                    <span className="flex shrink-0 items-center gap-1">
                      {m.conAdjuntos && <span className="text-slate" title="Tiene adjuntos"><Icono n="clip" size={13} /></span>}
                    </span>
                  </div>
                  <GloboSubido caso={m.casoImportado} auto={m.lecturaAuto} />
                </div>
              </button>
            </div>
          );
        })}
        <div ref={finLista} className="py-3 text-center">
          {siguiente ? (
            <button onClick={() => cargar(true, siguiente)} disabled={cargandoMas} className={boton.secundario}>
              {cargandoMas ? "Buscando mails más viejos…" : "Cargar mails más antiguos"}
            </button>
          ) : mensajes && mensajes.length > 0 ? (
            <p className="text-[11px] text-slate">No hay mails más antiguos{buscado ? " para esta búsqueda" : " en esta carpeta"}.</p>
          ) : null}
        </div>
      </div>
    )
  );

  const redaccion = borrador && (
    <div className={`overflow-hidden ${tarjeta} border-azul/30`}>
      <div className="flex items-center justify-between border-b border-line bg-azul/5 px-4 py-2.5">
        <p className="text-sm font-semibold text-ink">
          {borrador.modo === "nuevo" ? "Mensaje nuevo" : borrador.modo === "reenviar" ? "Reenviar" : borrador.modo === "responder_todos" ? "Responder a todos" : "Responder"}
        </p>
        <button onClick={() => setBorrador(null)} className="rounded px-2 py-1 text-xs text-slate hover:bg-line/60 hover:text-ink">✕ Descartar</button>
      </div>
      <div className="space-y-2 p-4">
        <input value={borrador.para} onChange={e => setBorrador({ ...borrador, para: e.target.value })} placeholder="Para (separá con comas)" className={`w-full ${campo}`} />
        <input value={borrador.cc} onChange={e => setBorrador({ ...borrador, cc: e.target.value })} placeholder="CC (opcional)" className={`w-full ${campo}`} />
        <input value={borrador.asunto} onChange={e => setBorrador({ ...borrador, asunto: e.target.value })} placeholder="Asunto" className={`w-full ${campo}`} />
        <textarea value={borrador.cuerpo} onChange={e => setBorrador({ ...borrador, cuerpo: e.target.value })} rows={10} autoFocus
          placeholder="Escribí el mensaje…" className={`w-full resize-y font-sans leading-relaxed ${campo}`} />
        {borrador.modo === "reenviar" && borrador.origen && borrador.origen.adjuntos.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={borrador.conAdjuntos} onChange={e => setBorrador({ ...borrador, conAdjuntos: e.target.checked })} />
            Incluir los {borrador.origen.adjuntos.length} adjunto{borrador.origen.adjuntos.length === 1 ? "" : "s"} del mail original
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`cursor-pointer ${boton.secundario} px-3 py-1.5 text-xs`}>
            <Icono n="clip" size={14} /> Adjuntar archivos
            <input type="file" multiple className="hidden" onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ""; setBorrador(b => b && { ...b, archivos: [...b.archivos, ...f] }); }} />
          </label>
          {borrador.archivos.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink">
              {f.name} <span className="text-slate">({formatearTamano(f.size)})</span>
              <button onClick={() => setBorrador(b => b && { ...b, archivos: b.archivos.filter((_, j) => j !== i) })} className="text-slate hover:text-fraude" aria-label={`Quitar ${f.name}`}>✕</button>
            </span>
          ))}
          <button onClick={enviar} disabled={enviando} className={`ml-auto ${boton.primario}`}>{enviando ? "Enviando…" : "Enviar ➤"}</button>
        </div>
      </div>
    </div>
  );

  const lectura = abierto && (
    <div className={`overflow-hidden ${tarjeta}`}>
      <div className="border-b border-line bg-paper/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-base font-semibold leading-snug text-ink">{abierto.asunto}</p>
          <button onClick={() => { setAbierto(null); setBorrador(null); }} className="shrink-0 rounded px-2 py-1 text-xs text-slate transition hover:bg-line/60 hover:text-ink">✕ Cerrar</button>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: colorPorTexto(parsearRemitente(abierto.de).email) }}>
            {inicial(parsearRemitente(abierto.de).nombre)}
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate text-sm font-semibold text-ink">{parsearRemitente(abierto.de).nombre} <span className="font-normal text-slate">&lt;{parsearRemitente(abierto.de).email}&gt;</span></p>
            {abierto.para && <p className="truncate text-slate">Para: {abierto.para}</p>}
            {abierto.cc && <p className="truncate text-slate">CC: {abierto.cc}</p>}
            <span className="mt-1 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate shadow-sm ring-1 ring-line first-letter:uppercase">{fechaCompleta(abierto.fecha)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => redactar("responder", abierto)} className={`px-3 py-1.5 text-xs ${boton.secundario}`}>↩ Responder</button>
          <button onClick={() => redactar("responder_todos", abierto)} className={`px-3 py-1.5 text-xs ${boton.secundario}`}>↩↩ Responder a todos</button>
          <button onClick={() => redactar("reenviar", abierto)} className={`px-3 py-1.5 text-xs ${boton.secundario}`}>↪ Reenviar</button>
          {abierto.cuerpoHtml && (
            <button onClick={() => setVerTexto(v => !v)} className={boton.ghost}>{verTexto ? "Ver con formato" : "Ver como texto"}</button>
          )}
          <a href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(casilla ?? "")}#all/${abierto.threadId ?? abierto.id}`} target="_blank" rel="noopener noreferrer" className={boton.ghost}>Abrir en Gmail ↗</a>
        </div>
      </div>

      {borrador && borrador.origen?.id === abierto.id && <div className="border-b border-line p-3">{redaccion}</div>}

      {abierto.cuerpoHtml && !verTexto
        ? <div className={`${completo ? "max-h-[60vh]" : "max-h-96"} overflow-y-auto`}><CuerpoHtml html={abierto.cuerpoHtml} /></div>
        : <pre className={`${completo ? "max-h-[60vh]" : "max-h-96"} overflow-y-auto whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-ink`}>{abierto.cuerpo || abierto.snippet}</pre>}

      <div className="px-4 pb-4">
        {abierto.adjuntos.length > 0 && (
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Adjuntos ({abierto.adjuntos.length})</p>
            <div className="flex flex-wrap gap-2">
              {abierto.adjuntos.map(a => (
                <a key={a.attachmentId}
                  href={`/api/gmail/mensajes/${abierto.id}/adjuntos/${a.attachmentId}?nombre=${encodeURIComponent(a.nombre)}&tipo=${encodeURIComponent(a.tipo)}`}
                  className="rounded border border-azul/20 bg-paper px-2.5 py-1.5 text-xs text-ink transition hover:bg-azul hover:text-paper">
                  <Icono n="clip" size={13} className="mr-1 inline align-[-2px]" />{a.nombre} <span className="opacity-70">({formatearTamano(a.tamano)})</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {importado ? (
          <div className="mt-3 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm shadow-sm">
            <p className="font-medium text-ok">Caso creado con {importado.archivos} archivo{importado.archivos === 1 ? "" : "s"} de evidencia.</p>
            <a href={`/siniestros/${importado.id}`} className="mt-1 inline-block text-xs font-medium text-ink underline underline-offset-2">Ver el caso →</a>
          </div>
        ) : casoDelAbierto ? (
          <div className="mt-3 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm shadow-sm">
            <p className="font-medium text-ink"><Icono n="carpeta" size={15} className="mr-1 inline align-[-3px]" />Caso subido al legajo {casoDelAbierto.etiqueta} {diaYHora(casoDelAbierto.subidoEn)}{casoDelAbierto.automatico ? " (lectura automática del mail)" : ""}{casoDelAbierto.operador ? ` · ${casoDelAbierto.operador}` : ""}.</p>
            <a href={`/siniestros/${casoDelAbierto.id}`} className="mt-1 inline-block text-xs font-medium text-ink underline underline-offset-2">Ver el caso →</a>
          </div>
        ) : (
          <div className="mt-3 border-t border-line pt-3">
            {mostrarImportar ? (
              <div className="flex flex-wrap items-center gap-2">
                {!operadorFijo && (
                  <>
                    <input value={operador} onChange={e => setOperador(e.target.value)} list="operadores-existentes-inbox" placeholder="Operador, ej: NACHO"
                      className={`border-amber/50 bg-amber/5 px-2.5 py-1.5 text-xs uppercase ${campo}`} />
                    <datalist id="operadores-existentes-inbox">
                      {operadoresExistentes.map(o => <option key={o} value={o} />)}
                    </datalist>
                  </>
                )}
                <button onClick={() => importar()} disabled={importando} className={`px-3 py-1.5 text-xs ${boton.primario}`}>{importando ? "Creando caso…" : "Confirmar"}</button>
                <button onClick={() => setMostrarImportar(false)} className={boton.ghost}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setMostrarImportar(true)} className={`px-3 py-1.5 text-xs ${boton.secundario}`}><Icono n="carpeta" size={14} /> Crear legajo desde este mail</button>
            )}
            {!abierto.adjuntos.some(esPdf) && <p className="mt-1.5 text-xs text-slate">Este mail no trae PDF: los datos se leen del texto del mail.</p>}
          </div>
        )}
      </div>
    </div>
  );

  const redaccionSuelta = borrador && (!abierto || borrador.origen?.id !== abierto.id) ? redaccion : null;

  if (completo) {
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <div className={`min-w-0 space-y-3 p-4 ${tarjeta} ${abierto || borrador || cargandoDetalle ? "hidden lg:block" : ""}`}>
          {barra}
          {error && <p className="text-sm font-medium text-fraude">{error}</p>}
          {lista}
        </div>
        <div className="min-w-0 space-y-3 lg:sticky lg:top-4">
          {(abierto || borrador || cargandoDetalle) && (
            <button onClick={() => { setAbierto(null); setBorrador(null); }} className={`lg:hidden ${boton.secundario}`}>← Volver a la lista</button>
          )}
          {redaccionSuelta}
          {cargandoDetalle && <div className={`p-6 text-sm text-slate ${tarjeta}`}>Cargando mail…</div>}
          {lectura}
          {!abierto && !cargandoDetalle && !borrador && (
            <div className={`hidden flex-col items-center justify-center gap-2 p-10 text-center text-sm text-slate lg:flex ${tarjeta}`}>
              <Icono n="mail" size={36} className="text-azul" />
              Elegí un mail de la lista para leerlo, responderlo o crear el legajo.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 p-5 ${tarjeta}`}>
      {barra}
      {error && <p className="text-sm font-medium text-fraude">{error}</p>}
      {redaccionSuelta}
      {lectura}
      {cargandoDetalle && <p className="text-xs text-slate">Cargando mail…</p>}
      {lista}
    </div>
  );
}
