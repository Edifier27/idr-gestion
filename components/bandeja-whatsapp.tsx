"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colorPorTexto } from "@/lib/ui";
import { notificar } from "@/components/notificaciones";
import { CATEGORIAS_EVIDENCIA, etiquetaCategoriaEvidencia, ramoDeTipo } from "@/lib/categorias-evidencia";
import type { ResumenCaso } from "@/lib/resumen-caso";
import {
  IconoAbajo, IconoBandeja, IconoBuscar, IconoCamara, IconoCasos, IconoCerrar, IconoDer, IconoDescargar, IconoDocumento,
  IconoEmoji, IconoEnviar, IconoFotos, IconoIzq, IconoMas, IconoRapidas, IconoVolver,
} from "@/components/wa-iconos";

export type Conversacion = {
  id: string; telefono: string; nombre: string | null; operador: string | null; nombre_operador: string | null; zona_operador: string | null;
  ultimo_en: string; ultimo_texto: string | null; no_leidos: number; ventana_hasta: string | null; pendientes: number;
  ultima_direccion: string | null; ultimo_estado: string | null;
};
export type Mensaje = {
  id: string; conversacion_id: string; direccion: "entrante" | "saliente"; tipo: string; texto: string | null;
  media_url: string | null; media_mime: string | null; media_nombre: string | null; estado: string | null;
  siniestro_id: string | null; categoria: string | null; asignacion: string | null; asignacion_nota: string | null;
  autor: string | null; creado_en: string; caso_nro: string | null; caso_nombre: string | null; caso_tipo: string | null; conv_operador: string | null;
  transcripcion?: string | null;
};
export type CasoOpcion = { id: string; nro: string | null; asegurado: string | null; operador: string | null; tipo: string | null };
export type OperadorTel = { operador: string; nombre: string; telefono: string | null };
export type CasoHerramientas = {
  id: string; nro: string | null; asegurado: string | null; dni: string | null; tipo: string | null; rubro: number | null;
  domicilio: string | null; lugar: string | null; telefono: string | null; etapa: string; entrevista: string | null;
  ingreso: string;
  pedidas: number; tiene: number; faltan: string[]; porWhatsapp: number;
  resumen: ResumenCaso | null; resumenEn: string | null; resumenViejo: boolean;
};

// Selector de emojis por categoría, como el de WhatsApp.
const EMOJIS: { cat: string; icono: string; lista: string[] }[] = [
  { cat: "Caritas", icono: "😊", lista: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤓", "🤗", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😮", "😯", "😲", "😳", "🥺", "😢", "😭", "😤", "😠", "😡", "🤯", "😬", "😴", "🤒", "🤕", "😷"] },
  { cat: "Gestos", icono: "👍", lista: ["👍", "👎", "👌", "✌️", "🤞", "🤝", "🙏", "👏", "🙌", "👋", "✋", "🤚", "👊", "✊", "💪", "☝️", "👆", "👇", "👉", "👈", "🫡", "🤷", "🤦", "🙋", "👀", "✍️", "💬", "🗣️"] },
  { cat: "Trabajo", icono: "📄", lista: ["📄", "📃", "📑", "🗂️", "📁", "📎", "🖇️", "📌", "📍", "🗺️", "📸", "📷", "🎥", "📞", "📱", "💻", "🧾", "🪪", "🔑", "🗝️", "🔒", "📅", "📆", "⏰", "⏳", "✅", "☑️", "❌", "❓", "❗", "⚠️", "🚫", "🔍", "🔎", "📝", "💰", "🏠", "🏢", "🚓", "👮"] },
  { cat: "Vehículos", icono: "🚗", lista: ["🚗", "🚙", "🚕", "🛻", "🚚", "🚐", "🏍️", "🛵", "🚲", "🚦", "🛞", "⛽", "🅿️", "🚧", "💥", "🔥", "🧯", "🪟", "🔧", "🛠️"] },
  { cat: "Símbolos", icono: "❤️", lista: ["❤️", "💚", "💙", "💛", "🧡", "💜", "🖤", "🤍", "💯", "🆗", "🆕", "🔝", "⭐", "✨", "🎉", "➡️", "⬅️", "⬆️", "⬇️", "🔁", "➕", "➖", "✔️", "✖️"] },
];

// Color de cada caso (separadores, etiquetas y tarjetas): el ángulo dorado
// reparte bien los tonos aunque los identificadores se parezcan.
function colorCaso(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `hsl(${Math.round((Math.abs(h) * 137.508) % 360)} 55% 38%)`;
}

// Filtro por período de ingreso del caso (hoy, semana, mes), para no ver
// todos los casos de golpe en los paneles.
export type Periodo = "todos" | "hoy" | "semana" | "mes";
export function enPeriodo(iso: string, periodo: Periodo, ahora = new Date()) {
  if (periodo === "todos") return true;
  const d = new Date(iso);
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  if (periodo === "semana") inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7)); // desde el lunes
  if (periodo === "mes") inicio.setDate(1);
  return d >= inicio;
}
export const PERIODOS: { k: Periodo; t: string }[] = [
  { k: "todos", t: "Todos" }, { k: "hoy", t: "Hoy" }, { k: "semana", t: "Esta semana" }, { k: "mes", t: "Este mes" },
];

function normalizar(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function horaLista(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return horaCorta(iso);
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function etiquetaDia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  if (hoy.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("es-AR", { weekday: "long" });
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nombreConv(c: Conversacion) {
  return c.nombre_operador ?? c.nombre ?? `+${c.telefono}`;
}
function Tilde({ estado }: { estado: string | null }) {
  if (estado === "failed") return <span className="wa-tilde error" title="No se pudo entregar">⚠</span>;
  if (estado === "read") return <span className="wa-tilde leido" title="Leído">✓✓</span>;
  if (estado === "delivered") return <span className="wa-tilde" title="Entregado">✓✓</span>;
  return <span className="wa-tilde" title="Enviado">✓</span>;
}

export function BandejaWhatsapp({ conversaciones, seleccionadaId, vistaSin, mensajes, casos, operadores, herramientas, modoPrueba, miNombre }: {
  conversaciones: Conversacion[]; seleccionadaId: string | null; vistaSin: boolean; mensajes: Mensaje[];
  casos: CasoOpcion[]; operadores: OperadorTel[]; herramientas: CasoHerramientas[]; modoPrueba: boolean; miNombre: string;
}) {
  const router = useRouter();
  const sel = conversaciones.find(c => c.id === seleccionadaId) ?? null;
  const totalPendientes = conversaciones.reduce((a, c) => a + c.pendientes, 0);

  // --- Lista ---
  const [filtro, setFiltro] = useState<"todos" | "noleidos" | "pendientes" | "sinop">("todos");
  const [busquedaLista, setBusquedaLista] = useState("");
  const lista = useMemo(() => {
    const p = normalizar(busquedaLista).split(/\s+/).filter(Boolean);
    return conversaciones.filter(c =>
      (filtro !== "noleidos" || c.no_leidos > 0) &&
      (filtro !== "pendientes" || c.pendientes > 0) &&
      (filtro !== "sinop" || !c.operador) &&
      p.every(x => normalizar(`${nombreConv(c)} ${c.telefono} ${c.operador ?? ""} ${c.ultimo_texto ?? ""}`).includes(x)));
  }, [conversaciones, filtro, busquedaLista]);

  // --- Conversación ---
  const [buscandoChat, setBuscandoChat] = useState(false);
  const [busquedaChat, setBusquedaChat] = useState("");
  const [casoFiltro, setCasoFiltro] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);
  // En pantallas chicas el panel de casos tapa el chat: arranca cerrado.
  useEffect(() => { if (window.innerWidth < 1280) setPanel(false); }, []);
  const [visor, setVisor] = useState<number | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const pegadoAbajo = useRef(true);
  const [verAbajo, setVerAbajo] = useState(false);

  useEffect(() => { setCasoFiltro(null); setBusquedaChat(""); setBuscandoChat(false); }, [seleccionadaId, vistaSin]);

  const visibles = useMemo(() => {
    const p = normalizar(busquedaChat).split(/\s+/).filter(Boolean);
    return mensajes.filter(m =>
      (!casoFiltro || m.siniestro_id === casoFiltro) &&
      p.every(x => normalizar(`${m.texto ?? ""} ${m.media_nombre ?? ""} ${m.caso_nombre ?? ""} ${m.caso_nro ?? ""}`).includes(x)));
  }, [mensajes, casoFiltro, busquedaChat]);
  const fotos = useMemo(() => visibles.filter(m => m.media_url && m.media_mime?.startsWith("image/")), [visibles]);
  // Segmentación en el chat: cuando las pruebas pasan a ser de otro caso, un
  // separador con el color del caso (el mismo color que su etiqueta).
  const separadores = useMemo(() => {
    const mapa = new Map<string, { id: string; texto: string }>();
    let ultimo: string | null = null;
    for (const m of visibles) {
      if (m.direccion !== "entrante" || !m.media_url || m.asignacion !== "asignado" || !m.siniestro_id) continue;
      if (m.siniestro_id !== ultimo) mapa.set(m.id, { id: m.siniestro_id, texto: `${m.caso_nombre ?? "Caso"} #${m.caso_nro ?? "s/n"}` });
      ultimo = m.siniestro_id;
    }
    return mapa;
  }, [visibles]);

  // Nuevos mensajes: se vuelve a pedir la pantalla cada 5 segundos.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  // Siempre anclado abajo, salvo que se esté leyendo más arriba.
  useEffect(() => {
    const el = contRef.current;
    if (el && pegadoAbajo.current) el.scrollTop = el.scrollHeight;
  }, [visibles.length, seleccionadaId]);

  function alDesplazar() {
    const el = contRef.current;
    if (!el) return;
    const abajo = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pegadoAbajo.current = abajo;
    if (abajo === verAbajo) setVerAbajo(!abajo);
  }

  useEffect(() => {
    if (sel && sel.no_leidos > 0) {
      fetch("/api/whatsapp/leido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacionId: sel.id }) }).catch(() => {});
    }
  }, [sel?.id, sel?.no_leidos]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Escribir ---
  const ventanaAbierta = !!sel?.ventana_hasta && new Date(sel.ventana_hasta).getTime() > Date.now();
  const [texto, setTexto] = useState("");
  const [popup, setPopup] = useState<"adjuntar" | "emojis" | "rapidas" | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [previaIdx, setPreviaIdx] = useState(0);
  const [epigrafe, setEpigrafe] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const [catEmoji, setCatEmoji] = useState(0);
  // Mensajes que llegan con el chat abierto: entran con animación.
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    vistos.current = new Set(mensajes.map(m => m.id));
  }, [mensajes]);

  useEffect(() => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texto]);

  const rapidas = useMemo(() => {
    const base = [
      "¿De qué caso es esta foto? Decime el apellido o el N° de siniestro.",
      "Mandame la denuncia policial y la ampliación firmada, por favor.",
      "¿Cómo te fue en la entrevista? Contame lo principal.",
      "Recibido, gracias 👍",
      "Las fotos tienen que verse completas y derechas: DNI, registro y cédula de los dos lados.",
    ];
    const porCaso = herramientas.filter(h => h.faltan.length).slice(0, 4).map(h => textoFaltantes(h));
    return [...porCaso, ...base];
  }, [herramientas]);

  function textoFaltantes(h: CasoHerramientas) {
    return `Para ${h.asegurado ?? "el caso"} (#${h.nro ?? "s/n"}) faltan: ${h.faltan.join(", ")}. ¿Me las mandás?`;
  }

  function insertar(t: string, reemplazar = false) {
    setTexto(prev => (reemplazar || !prev ? t : `${prev}${prev.endsWith(" ") ? "" : " "}${t}`));
    setPopup(null);
    setTimeout(() => campoRef.current?.focus(), 0);
  }

  async function enviarTexto() {
    if (!sel || !texto.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/whatsapp/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacionId: sel.id, texto }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo enviar.");
      setTexto("");
      setPopup(null);
      pegadoAbajo.current = true;
      router.refresh();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  function elegirArchivos(lista: FileList | null) {
    const nuevos = Array.from(lista ?? []);
    if (!nuevos.length) return;
    setArchivos(nuevos);
    setPreviaIdx(0);
    setEpigrafe(texto);
    setPopup(null);
  }

  async function enviarArchivos() {
    if (!sel || !archivos.length) return;
    setEnviando(true);
    try {
      for (let i = 0; i < archivos.length; i++) {
        const fd = new FormData();
        fd.append("conversacionId", sel.id);
        fd.append("archivo", archivos[i]);
        if (i === 0 && epigrafe.trim()) fd.append("texto", epigrafe.trim());
        const res = await fetch("/api/whatsapp/enviar-archivo", { method: "POST", body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `No se pudo enviar ${archivos[i].name}.`);
      }
      setArchivos([]);
      setEpigrafe("");
      setTexto("");
      pegadoAbajo.current = true;
      router.refresh();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const urlsPrevia = useMemo(() => archivos.map(f => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [archivos]);
  useEffect(() => () => urlsPrevia.forEach(u => u && URL.revokeObjectURL(u)), [urlsPrevia]);

  const hayChat = !!sel || vistaSin;
  const conPanel = !!sel && panel;
  const casoElegido = herramientas.find(h => h.id === casoFiltro) ?? null;

  return (
    <div className={`wa-app ${conPanel ? "con-panel" : ""} ${hayChat ? "hay-chat" : ""}`}>
      {/* ---------------- Lista de chats ---------------- */}
      <aside className="wa-lista">
        <div className="wa-lista-cab">
          <div className="wa-fila"><h1>Chats</h1>{modoPrueba && <span className="wa-prueba">Modo prueba</span>}</div>
          <label className="wa-buscador">
            <IconoBuscar size={18} />
            <input value={busquedaLista} onChange={e => setBusquedaLista(e.target.value)} placeholder="Buscar un chat o un operador" />
          </label>
          <div className="wa-chips">
            {([["todos", "Todos"], ["noleidos", "No leídos"], ["pendientes", "Con pruebas por ubicar"], ["sinop", "Sin operador"]] as const).map(([k, t]) => (
              <button key={k} className={`wa-chip ${filtro === k ? "activo" : ""}`} onClick={() => setFiltro(k)}>{t}</button>
            ))}
          </div>
        </div>
        <Link href="/whatsapp?vista=sin" className={`wa-sinasignar ${vistaSin ? "activo" : ""}`}>
          <span className="icono"><IconoBandeja size={24} /></span>
          <span style={{ flex: 1 }}>
            <span className="wa-chat-nombre">Sin asignar</span><br />
            <span className="wa-chat-ultimo">Pruebas que falta ubicar en un caso</span>
          </span>
          {totalPendientes > 0 && <span className="wa-contador ambar" style={{ marginRight: 2 }}>{totalPendientes}</span>}
        </Link>
        <div className="wa-chats">
          {lista.length === 0 && <p style={{ padding: 16, color: "var(--wa-suave)" }}>{conversaciones.length ? "Ningún chat coincide." : "Todavía no llegó ningún WhatsApp. Probá con el simulador de abajo."}</p>}
          {lista.map(c => {
            const nombre = nombreConv(c);
            return (
              <Link key={c.id} href={`/whatsapp?c=${c.id}`} className={`wa-chat ${!vistaSin && c.id === seleccionadaId ? "activo" : ""}`}>
                <span className="wa-avatar" style={{ background: colorPorTexto(c.operador ?? c.telefono) }}>{nombre.replace("+", "").trim()[0]?.toUpperCase()}</span>
                <span className="wa-chat-cuerpo">
                  <span className="wa-fila">
                    <span className="wa-chat-nombre">{nombre}</span>
                    <span className={`wa-chat-hora ${c.no_leidos ? "nueva" : ""}`}>{horaLista(c.ultimo_en)}</span>
                  </span>
                  <span className="wa-fila">
                    <span className="wa-chat-ultimo">
                      {c.ultima_direccion === "saliente" && <Tilde estado={c.ultimo_estado} />}
                      {!c.operador && "⚠️ "}{c.ultimo_texto ?? ""}
                    </span>
                    <span style={{ display: "flex", gap: 4, flex: "none" }}>
                      {c.pendientes > 0 && <span className="wa-contador ambar" title="Pruebas por ubicar">{c.pendientes}</span>}
                      {c.no_leidos > 0 && <span className="wa-contador">{c.no_leidos}</span>}
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <Simulador operadores={operadores} onListo={() => router.refresh()} />
      </aside>

      {/* ---------------- Conversación ---------------- */}
      {vistaSin ? (
        <section className="wa-conv">
          <div className="wa-conv-cab">
            <Link href="/whatsapp" className="wa-icono-btn wa-volver" aria-label="Volver"><IconoVolver /></Link>
            <span className="wa-avatar chico" style={{ background: "#F2C230" }}><IconoBandeja size={20} /></span>
            <div className="datos"><div className="nombre">Sin asignar</div><div className="sub">Elegí el caso y la categoría de cada prueba</div></div>
          </div>
          <div className="wa-mensajes">
            {mensajes.length === 0 && <div className="wa-aviso-sistema">No hay nada pendiente 🎉</div>}
            {mensajes.map(m => (
              <div key={m.id} className="wa-envoltura primera">
                <div className="wa-burbuja entrante cola">
                  <span className="wa-autor">{m.conv_operador ?? "Sin operador"} · {new Date(m.creado_en).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <Contenido m={m} onFoto={() => window.open(m.media_url ?? "", "_blank")} />
                  {m.texto && <span className="wa-texto">{m.texto}</span>}
                  <Asignacion m={m} casos={casos} operador={m.conv_operador} abiertoInicial onListo={() => router.refresh()} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : !sel ? (
        <section className="wa-vacio">
          <div style={{ fontSize: 56 }}>💬</div>
          <h2>WhatsApp de CRMgestion</h2>
          <p style={{ maxWidth: 440 }}>Elegí un chat de la izquierda. Las fotos y documentos que mandan los operadores se guardan solos en la evidencia de cada caso; lo que la IA no puede ubicar queda en Sin asignar.</p>
        </section>
      ) : (
        <section className="wa-conv">
          <div className="wa-conv-cab">
            <Link href="/whatsapp" className="wa-icono-btn wa-volver" aria-label="Volver"><IconoVolver /></Link>
            <span className="wa-avatar chico" style={{ background: colorPorTexto(sel.operador ?? sel.telefono) }}>{nombreConv(sel).replace("+", "").trim()[0]?.toUpperCase()}</span>
            <div className="datos">
              <div className="nombre">{nombreConv(sel)}</div>
              <div className="sub">
                {sel.operador ? `Operador ${sel.operador}${sel.zona_operador ? ` · ${sel.zona_operador}` : ""}` : "Número sin vincular a un operador (cargalo en Usuarios)"} · +{sel.telefono}
              </div>
            </div>
            <button className={`wa-icono-btn ${buscandoChat ? "activo" : ""}`} onClick={() => setBuscandoChat(b => !b)} title="Buscar en el chat" aria-label="Buscar en el chat"><IconoBuscar /></button>
            <button className={`wa-icono-btn ${panel ? "activo" : ""}`} onClick={() => setPanel(p => !p)} title="Casos del operador" aria-label="Casos del operador"><IconoCasos /></button>
          </div>
          {buscandoChat && (
            <div className="wa-busqueda-chat">
              <input autoFocus value={busquedaChat} onChange={e => setBusquedaChat(e.target.value)} placeholder="Buscar mensajes, archivos o casos…" />
              <span style={{ fontSize: 12, color: "var(--wa-suave)" }}>{busquedaChat ? `${visibles.length} resultados` : ""}</span>
            </div>
          )}
          {casoElegido && (
            <div className="wa-filtro-caso">
              <span>Mostrando lo de {casoElegido.asegurado ?? "el caso"} #{casoElegido.nro ?? "s/n"} ({visibles.length})</span>
              <button onClick={() => setCasoFiltro(null)}>Ver todo ✕</button>
            </div>
          )}
          <div className="wa-mensajes" ref={contRef} onScroll={alDesplazar}>
            {visibles.length === 0 && <div className="wa-aviso-sistema">{mensajes.length ? "Nada coincide con el filtro." : "Todavía no hay mensajes."}</div>}
            {visibles.map((m, i) => {
              const ant = visibles[i - 1];
              const separador = separadores.get(m.id);
              const nuevoDia = !ant || new Date(ant.creado_en).toDateString() !== new Date(m.creado_en).toDateString();
              const primera = nuevoDia || ant.direccion !== m.direccion || new Date(m.creado_en).getTime() - new Date(ant.creado_en).getTime() > 5 * 60_000 || ant.autor !== m.autor;
              const esFoto = !!m.media_url && !!m.media_mime?.startsWith("image/") && !m.texto && m.asignacion === null;
              return (
                <Fragment key={m.id}>
                  {nuevoDia && <div className="wa-dia">{etiquetaDia(m.creado_en)}</div>}
                  {separador && (
                    <div className="wa-separador-caso" style={{ ["--color-caso" as string]: colorCaso(separador.id) }}>
                      <span>🗂️ {separador.texto}</span>
                    </div>
                  )}
                  <div className={`wa-envoltura ${m.direccion} ${primera ? "primera" : ""} ${vistos.current && !vistos.current.has(m.id) ? "recien" : ""}`}>
                    <div className={`wa-burbuja ${m.direccion} ${primera ? "cola" : ""} ${m.autor === "Perito IA" ? "perito" : ""} ${busquedaChat && m.texto && normalizar(m.texto).includes(normalizar(busquedaChat)) ? "resaltada" : ""}`}>
                      {m.direccion === "saliente" && primera && m.autor && (
                        <span className={`wa-autor ${m.autor === "Asistente IDR" || m.autor === "Perito IA" ? "ia" : ""}`}>{m.autor === "Asistente IDR" ? "🤖 Asistente IDR" : m.autor === "Perito IA" ? "🕵️ Perito IA" : m.autor === miNombre ? "Vos" : m.autor}</span>
                      )}
                      <Contenido m={m} onFoto={() => setVisor(fotos.findIndex(f => f.id === m.id))} />
                      {m.texto && <span className="wa-texto">{m.texto}</span>}
                      <span className={`wa-meta ${esFoto ? "sobre-foto" : ""}`}>
                        {horaCorta(m.creado_en)}
                        {m.direccion === "saliente" && <Tilde estado={m.estado} />}
                      </span>
                      {m.direccion === "entrante" && m.media_url && (
                        <div style={{ clear: "both" }}>
                          <Asignacion m={m} casos={casos} operador={sel.operador} onListo={() => router.refresh()} onVerCaso={id => setCasoFiltro(id)} />
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
          {verAbajo && <button className="wa-abajo" onClick={() => { const el = contRef.current; if (el) el.scrollTop = el.scrollHeight; }} aria-label="Ir al último mensaje"><IconoAbajo /></button>}

          {ventanaAbierta ? (
            <div className="wa-barra-escribir">
              {popup === "adjuntar" && (
                <div className="wa-popup adjuntar" role="menu">
                  <button role="menuitem" onClick={() => docRef.current?.click()}><span className="circ" style={{ background: "#7F66FF" }}><IconoDocumento /></span>Documento</button>
                  <button role="menuitem" onClick={() => fotoRef.current?.click()}><span className="circ" style={{ background: "#007BFC" }}><IconoFotos /></span>Fotos y videos</button>
                  <button role="menuitem" onClick={() => camaraRef.current?.click()}><span className="circ" style={{ background: "#FF2E74" }}><IconoCamara /></span>Cámara</button>
                  <button role="menuitem" onClick={() => setPopup("rapidas")}><span className="circ" style={{ background: "#FFBC38" }}><IconoRapidas /></span>Respuestas rápidas</button>
                </div>
              )}
              {popup === "emojis" && (
                <div className="wa-popup emojis" role="dialog" aria-label="Emojis">
                  <div className="wa-emoji-tabs">
                    {EMOJIS.map((c, i) => <button key={c.cat} className={i === catEmoji ? "activo" : ""} onClick={() => setCatEmoji(i)} title={c.cat}>{c.icono}</button>)}
                  </div>
                  <div className="wa-emoji-titulo">{EMOJIS[catEmoji].cat}</div>
                  <div className="wa-emoji-grilla">
                    {EMOJIS[catEmoji].lista.map(e => <button key={e} onClick={() => insertar(e)} aria-label={e}>{e}</button>)}
                  </div>
                </div>
              )}
              {popup === "rapidas" && (
                <div className="wa-popup rapidas">
                  {rapidas.map(r => <button key={r} onClick={() => insertar(r, true)}>{r}</button>)}
                </div>
              )}
              <input ref={fotoRef} type="file" accept="image/*,video/*" multiple hidden onChange={e => { elegirArchivos(e.target.files); e.target.value = ""; }} />
              <input ref={docRef} type="file" multiple hidden onChange={e => { elegirArchivos(e.target.files); e.target.value = ""; }} />
              <input ref={camaraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { elegirArchivos(e.target.files); e.target.value = ""; }} />
              <button className={`wa-icono-btn ${popup === "adjuntar" || popup === "rapidas" ? "activo girado" : ""}`} onClick={() => setPopup(p => (p === "adjuntar" || p === "rapidas" ? null : "adjuntar"))} title="Adjuntar" aria-label="Adjuntar"><IconoMas /></button>
              <button className={`wa-icono-btn ${popup === "emojis" ? "activo" : ""}`} onClick={() => setPopup(p => (p === "emojis" ? null : "emojis"))} title="Emojis" aria-label="Emojis"><IconoEmoji /></button>
              <div className="wa-campo">
                <textarea
                  ref={campoRef}
                  rows={1}
                  value={texto}
                  onChange={e => { setTexto(e.target.value); if (e.target.value === "/") setPopup("rapidas"); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarTexto(); } if (e.key === "Escape") setPopup(null); }}
                  onPaste={e => { const fs = e.clipboardData.files; if (fs.length) { e.preventDefault(); elegirArchivos(fs); } }}
                  placeholder="Escribí un mensaje"
                />
              </div>
              <button className="wa-enviar" onClick={enviarTexto} disabled={enviando || !texto.trim()} aria-label="Enviar"><IconoEnviar /></button>
            </div>
          ) : (
            <div className="wa-cerrada">Pasaron más de 24 h desde el último mensaje del operador: WhatsApp no deja escribirle hasta que vuelva a escribir.</div>
          )}

          {archivos.length > 0 && (
            <div className="wa-previa">
              <div className="wa-previa-cab">
                <button className="wa-icono-btn" onClick={() => setArchivos([])} aria-label="Cancelar"><IconoCerrar /></button>
                <span style={{ flex: 1 }}>{archivos[previaIdx]?.name}</span>
              </div>
              <div className="wa-previa-cuerpo">
                {urlsPrevia[previaIdx]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urlsPrevia[previaIdx] ?? ""} alt="Vista previa" />
                  : <div className="wa-doc" style={{ background: "#fff" }}><span className="ico otro">{(archivos[previaIdx]?.name.split(".").pop() ?? "").toUpperCase().slice(0, 4)}</span><span><span className="nom">{archivos[previaIdx]?.name}</span><br /><span className="det">{Math.ceil((archivos[previaIdx]?.size ?? 0) / 1024)} KB</span></span></div>}
              </div>
              <div className="wa-barra-escribir" style={{ background: "transparent", justifyContent: "center" }}>
                <div className="wa-campo" style={{ maxWidth: 640 }}>
                  <textarea rows={1} value={epigrafe} onChange={e => setEpigrafe(e.target.value)} placeholder="Agregá un comentario…" />
                </div>
                <button className="wa-enviar" onClick={enviarArchivos} disabled={enviando} aria-label="Enviar">{enviando ? "…" : <IconoEnviar />}</button>
              </div>
              <div className="wa-previa-miniaturas">
                {archivos.map((f, i) => (
                  <button key={i} className={i === previaIdx ? "activo" : ""} onClick={() => setPreviaIdx(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {urlsPrevia[i] ? <img src={urlsPrevia[i] ?? ""} alt={f.name} /> : f.name.split(".").pop()?.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------- Panel de herramientas ---------------- */}
      {conPanel && sel && (
        <Herramientas
          sel={sel}
          herramientas={herramientas}
          mensajes={mensajes}
          casoFiltro={casoFiltro}
          onCerrar={() => setPanel(false)}
          onFiltrar={id => { setCasoFiltro(id); pegadoAbajo.current = true; }}
          onPedir={h => insertar(textoFaltantes(h), true)}
          onTexto={t => insertar(t, true)}
          onActualizado={() => router.refresh()}
          onFoto={id => { setCasoFiltro(null); setTimeout(() => setVisor(mensajes.filter(m => m.media_url && m.media_mime?.startsWith("image/")).findIndex(f => f.id === id)), 0); }}
          ventanaAbierta={ventanaAbierta}
        />
      )}

      {visor !== null && fotos[visor] && (
        <div className="wa-visor" onClick={() => setVisor(null)}>
          <div className="wa-visor-cab" onClick={e => e.stopPropagation()}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{fotos[visor].media_nombre}</div>
              <div style={{ fontSize: 12, color: "var(--wa-suave)" }}>
                {new Date(fotos[visor].creado_en).toLocaleString("es-AR")}
                {fotos[visor].caso_nro ? ` · ${fotos[visor].caso_nombre ?? ""} #${fotos[visor].caso_nro}` : ""}
                {fotos[visor].categoria ? ` · ${etiquetaCategoriaEvidencia(fotos[visor].categoria, ramoDeTipo(fotos[visor].caso_tipo))}` : ""}
              </div>
            </div>
            <a className="wa-icono-btn" href={fotos[visor].media_url ?? ""} target="_blank" rel="noreferrer" title="Abrir original" aria-label="Abrir original"><IconoDescargar /></a>
            <button className="wa-icono-btn" onClick={() => setVisor(null)} aria-label="Cerrar"><IconoCerrar /></button>
          </div>
          <div className="wa-visor-cuerpo">
            {visor > 0 && <button className="wa-visor-nav" style={{ left: 8 }} onClick={e => { e.stopPropagation(); setVisor(visor - 1); }} aria-label="Anterior"><IconoIzq /></button>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotos[visor].media_url ?? ""} alt={fotos[visor].media_nombre ?? "foto"} onClick={e => e.stopPropagation()} />
            {visor < fotos.length - 1 && <button className="wa-visor-nav" style={{ right: 8 }} onClick={e => { e.stopPropagation(); setVisor(visor + 1); }} aria-label="Siguiente"><IconoDer /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Contenido({ m, onFoto }: { m: Mensaje; onFoto: () => void }) {
  if (!m.media_url) return null;
  if (m.media_mime?.startsWith("image/")) {
    return (
      <button type="button" className="wa-foto" onClick={onFoto} style={{ border: 0, padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.media_url} alt={m.media_nombre ?? "foto"} loading="lazy" />
      </button>
    );
  }
  if (m.media_mime?.startsWith("audio/")) {
    return (
      <>
        <audio controls preload="none" src={m.media_url} />
        {m.transcripcion && <span className="wa-transcripcion">🎤 {m.transcripcion}</span>}
      </>
    );
  }
  if (m.media_mime?.startsWith("video/")) return <video controls preload="none" src={m.media_url} style={{ maxWidth: 330 }} />;
  const ext = (m.media_nombre?.split(".").pop() ?? "").toUpperCase().slice(0, 4);
  return (
    <a className="wa-doc" href={m.media_url} target="_blank" rel="noreferrer">
      <span className={`ico ${ext === "PDF" ? "" : "otro"}`}>{ext || "DOC"}</span>
      <span style={{ minWidth: 0 }}><span className="nom" style={{ display: "block" }}>{m.media_nombre ?? "documento"}</span><span className="det">{ext || "Archivo"}</span></span>
    </a>
  );
}

function Asignacion({ m, casos, operador, abiertoInicial = false, onListo, onVerCaso }: {
  m: Mensaje; casos: CasoOpcion[]; operador: string | null; abiertoInicial?: boolean; onListo: () => void; onVerCaso?: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(abiertoInicial || m.asignacion === "sin_asignar" || m.asignacion === "pregunta");
  const ramo = ramoDeTipo(m.caso_tipo);

  if (!editando) {
    if (m.asignacion === "asignado") {
      return (
        <span style={{ position: "relative", display: "inline-block" }}>
          <button className="wa-caso ok" onClick={() => setMenu(v => !v)} title={m.asignacion_nota ?? undefined} style={{ ["--color-caso" as string]: m.siniestro_id ? colorCaso(m.siniestro_id) : undefined }}>
            ✓ {m.caso_nombre ?? "Caso"} #{m.caso_nro ?? "s/n"}{m.categoria ? ` · ${etiquetaCategoriaEvidencia(m.categoria, ramo)}` : ""} ▾
          </button>
          {menu && (
            <div className="wa-menu" onMouseLeave={() => setMenu(false)}>
              <a href={`/siniestros/${m.siniestro_id}`}>Abrir el caso ↗</a>
              {onVerCaso && m.siniestro_id && <button onClick={() => { onVerCaso(m.siniestro_id as string); setMenu(false); }}>Ver todo lo de este caso en el chat</button>}
              <button onClick={() => { setEditando(true); setMenu(false); }}>Mover a otro caso o cambiar categoría</button>
            </div>
          )}
        </span>
      );
    }
    if (m.asignacion === "pendiente") return <span className="wa-caso pendiente">La IA lo está ubicando…</span>;
    return null;
  }
  return (
    <>
      {m.asignacion === "pregunta" && <span className="wa-caso pregunta" title={m.asignacion_nota ?? undefined}>❓ Se le preguntó al operador de qué caso es</span>}
      {m.asignacion === "sin_asignar" && <span className="wa-caso sin" title={m.asignacion_nota ?? undefined}>Sin asignar{m.asignacion_nota ? ` · ${m.asignacion_nota}` : ""}</span>}
      <Asignador m={m} casos={casos} operador={operador} onListo={onListo} onCancelar={m.asignacion === "asignado" ? () => setEditando(false) : undefined} />
    </>
  );
}

function Asignador({ m, casos, operador, onListo, onCancelar }: { m: Mensaje; casos: CasoOpcion[]; operador: string | null; onListo: () => void; onCancelar?: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [caso, setCaso] = useState(m.siniestro_id ?? "");
  const [categoria, setCategoria] = useState(m.categoria ?? "");
  const [guardando, setGuardando] = useState(false);
  // Primero los casos del operador; buscando, todos.
  const opciones = useMemo(() => {
    const p = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const base = p.length ? casos : casos.filter(c => !operador || c.operador === operador);
    return base.filter(c => p.every(x => normalizar(`${c.nro ?? ""} ${c.asegurado ?? ""} ${c.operador ?? ""}`).includes(x))).slice(0, 40);
  }, [busqueda, casos, operador]);

  async function guardar() {
    if (!caso) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/whatsapp/asignar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensajeId: m.id, siniestroId: caso, categoria }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo asignar.");
      notificar.ok("Guardado en la evidencia del caso.");
      onCancelar?.();
      onListo();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo asignar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="wa-asignador">
      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar caso por apellido o N°…" />
      <div className="fila">
        <select value={caso} onChange={e => setCaso(e.target.value)} aria-label="Caso">
          <option value="">Elegí el caso…</option>
          {opciones.map(c => <option key={c.id} value={c.id}>#{c.nro ?? "s/n"} · {c.asegurado ?? "—"}{c.operador && c.operador !== operador ? ` · ${c.operador}` : ""}</option>)}
        </select>
      </div>
      <div className="fila">
        <select value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoría">
          <option value="">Sin categoría</option>
          {CATEGORIAS_EVIDENCIA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {onCancelar && <button className="wa-btn gris" onClick={onCancelar}>Cancelar</button>}
        <button className="wa-btn" onClick={guardar} disabled={!caso || guardando}>{guardando ? "…" : "Guardar"}</button>
      </div>
    </div>
  );
}

function Herramientas({ sel, herramientas, mensajes, casoFiltro, onCerrar, onFiltrar, onPedir, onTexto, onActualizado, onFoto, ventanaAbierta }: {
  sel: Conversacion; herramientas: CasoHerramientas[]; mensajes: Mensaje[]; casoFiltro: string | null;
  onCerrar: () => void; onFiltrar: (id: string | null) => void; onPedir: (h: CasoHerramientas) => void; onTexto: (t: string) => void;
  onActualizado: () => void; onFoto: (id: string) => void; ventanaAbierta: boolean;
}) {
  const [pestana, setPestana] = useState<"casos" | "pruebas">("casos");
  const [segmento, setSegmento] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  // Segmentos: prioridad y alerta que fijó la IA, y rubro.
  const PESO = { alta: 0, media: 1, baja: 2 } as const;
  const segmentos = useMemo(() => {
    const rubros = Array.from(new Set(herramientas.map(h => h.rubro).filter((r): r is number => !!r))).sort();
    return [
      { k: "todos", t: `Todos (${herramientas.length})` },
      { k: "prioridad", t: `Prioridad alta (${herramientas.filter(h => h.resumen?.segmento.prioridad === "alta").length})` },
      { k: "alerta", t: `Alerta alta (${herramientas.filter(h => h.resumen?.segmento.alerta === "alta").length})` },
      ...rubros.map(r => ({ k: `rubro-${r}`, t: `Rubro ${r} (${herramientas.filter(h => h.rubro === r).length})` })),
    ];
  }, [herramientas]);
  const tarjetas = useMemo(() => herramientas
    .filter(h => enPeriodo(h.ingreso, periodo))
    .filter(h => segmento === "todos" || (segmento === "prioridad" && h.resumen?.segmento.prioridad === "alta") || (segmento === "alerta" && h.resumen?.segmento.alerta === "alta") || (segmento.startsWith("rubro-") && String(h.rubro) === segmento.slice(6)))
    .sort((a, b) => (PESO[a.resumen?.segmento.prioridad ?? "media"] - PESO[b.resumen?.segmento.prioridad ?? "media"]) || (PESO[a.resumen?.segmento.alerta ?? "media"] - PESO[b.resumen?.segmento.alerta ?? "media"])),
    [herramientas, segmento, periodo]); // eslint-disable-line react-hooks/exhaustive-deps
  const media = mensajes.filter(m => m.media_url && m.direccion === "entrante");
  const grupos = useMemo(() => {
    const sinUbicar = media.filter(m => m.asignacion !== "asignado");
    const porCaso = new Map<string, Mensaje[]>();
    for (const m of media.filter(x => x.asignacion === "asignado" && x.siniestro_id)) {
      porCaso.set(m.siniestro_id as string, [...(porCaso.get(m.siniestro_id as string) ?? []), m]);
    }
    return { sinUbicar, porCaso: Array.from(porCaso.entries()) };
  }, [media]);

  return (
    <aside className="wa-panel">
      <div className="wa-panel-cab">
        <button className="wa-icono-btn" onClick={onCerrar} aria-label="Cerrar panel"><IconoCerrar /></button>
        <h2>Casos de {sel.nombre_operador ?? sel.operador ?? "este número"}</h2>
      </div>
      <div className="wa-pestanas">
        <button className={pestana === "casos" ? "activo" : ""} onClick={() => setPestana("casos")}>Casos ({herramientas.length})</button>
        <button className={pestana === "pruebas" ? "activo" : ""} onClick={() => setPestana("pruebas")}>Pruebas recibidas ({media.length})</button>
      </div>
      <div className="wa-panel-cuerpo">
        {pestana === "casos" ? (
          !sel.operador ? (
            <p style={{ color: "var(--wa-suave)", fontSize: 13 }}>Este número no está vinculado a ningún operador. Cargá su WhatsApp en Usuarios para ver sus casos acá.</p>
          ) : herramientas.length === 0 ? (
            <p style={{ color: "var(--wa-suave)", fontSize: 13 }}>No tiene casos abiertos.</p>
          ) : <>
          <div className="wa-chips wa-periodos">
            {PERIODOS.map(x => <button key={x.k} className={`wa-chip ${periodo === x.k ? "activo" : ""}`} onClick={() => setPeriodo(x.k)}>{x.t} ({herramientas.filter(h => enPeriodo(h.ingreso, x.k)).length})</button>)}
          </div>
          <div className="wa-chips">
            {segmentos.map(x => <button key={x.k} className={`wa-chip ${segmento === x.k ? "activo" : ""}`} onClick={() => setSegmento(x.k)}>{x.t}</button>)}
          </div>
          {tarjetas.map(h => (
            <div key={h.id} className={`wa-tarjeta ${casoFiltro === h.id ? "elegida" : ""}`} style={{ borderLeft: `4px solid ${colorCaso(h.id)}` }}>
              <div className="tit"><span className="nro">#{h.nro ?? "s/n"}</span><span style={{ fontSize: 12, color: "var(--wa-suave)" }}>{h.etapa}</span></div>
              <div className="wa-segmento">
                {h.rubro && <span className="seg rubro">Rubro {h.rubro}</span>}
                {h.resumen && <span className={`seg prio-${h.resumen.segmento.prioridad}`}>Prioridad {h.resumen.segmento.prioridad}</span>}
                {h.resumen && <span className={`seg alerta-${h.resumen.segmento.alerta}`}>Alerta {h.resumen.segmento.alerta}</span>}
                {h.resumen?.segmento.etiquetas.map(e => <span key={e} className="seg">{e}</span>)}
              </div>
              <div className="nom">{h.asegurado ?? "—"}</div>
              <div className="det">
                {h.rubro ? `${h.rubro} · ` : ""}{h.tipo ?? "Sin tipo"}{h.dni ? ` · DNI ${h.dni}` : ""}<br />
                {h.domicilio ? <>🏠 {h.domicilio}<br /></> : null}
                {h.lugar ? <>📍 {h.lugar}<br /></> : null}
                {h.entrevista ? <>📅 Entrevista {new Date(h.entrevista).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}<br /></> : null}
                📎 {h.porWhatsapp} prueba{h.porWhatsapp === 1 ? "" : "s"} por WhatsApp
              </div>
              <div>
                <div className="wa-fila" style={{ fontSize: 12, marginBottom: 3 }}><span>Pruebas del ramo</span><span>{h.tiene}/{h.pedidas}</span></div>
                <div className="wa-barra-progreso"><i style={{ width: `${h.pedidas ? (h.tiene / h.pedidas) * 100 : 0}%` }} /></div>
              </div>
              {!h.resumen && h.faltan.length > 0 && <div className="wa-faltan">{h.faltan.map(f => <span key={f}>{f}</span>)}</div>}
              <ResumenIA h={h} onTexto={onTexto} ventanaAbierta={ventanaAbierta} onActualizado={onActualizado} />
              <div className="wa-acciones">
                <button onClick={() => onFiltrar(casoFiltro === h.id ? null : h.id)}>{casoFiltro === h.id ? "Ver todo el chat" : "Ver sus pruebas en el chat"}</button>
                {h.faltan.length > 0 && ventanaAbierta && <button onClick={() => onPedir(h)}>Pedir lo que falta</button>}
                <a href={`/siniestros/${h.id}`}>Abrir caso ↗</a>
              </div>
            </div>
          ))}
          {tarjetas.length === 0 && <p style={{ color: "var(--wa-suave)", fontSize: 13 }}>Ningún caso en este período o segmento.</p>}
          </>
        ) : (
          <>
            {grupos.sinUbicar.length > 0 && (
              <>
                <div className="wa-panel-sub">Por ubicar ({grupos.sinUbicar.length})</div>
                <Galeria lista={grupos.sinUbicar} onFoto={onFoto} />
              </>
            )}
            {grupos.porCaso.map(([id, lista]) => (
              <Fragment key={id}>
                <div className="wa-panel-sub">#{lista[0].caso_nro ?? "s/n"} · {lista[0].caso_nombre ?? "—"} ({lista.length})</div>
                <Galeria lista={lista} onFoto={onFoto} />
              </Fragment>
            ))}
            {media.length === 0 && <p style={{ color: "var(--wa-suave)", fontSize: 13 }}>Todavía no mandó archivos.</p>}
          </>
        )}
      </div>
    </aside>
  );
}

function Galeria({ lista, onFoto }: { lista: Mensaje[]; onFoto: (id: string) => void }) {
  return (
    <div className="wa-galeria">
      {lista.map(m => (
        m.media_mime?.startsWith("image/") ? (
          <button key={m.id} onClick={() => onFoto(m.id)} title={m.media_nombre ?? undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.media_url ?? ""} alt={m.media_nombre ?? "foto"} loading="lazy" />
            {m.categoria && <span className="marca">{etiquetaCategoriaEvidencia(m.categoria, ramoDeTipo(m.caso_tipo)).split(" ")[0]}</span>}
          </button>
        ) : (
          <a key={m.id} href={m.media_url ?? ""} target="_blank" rel="noreferrer" style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wa-barra)", borderRadius: 4, fontSize: 11, color: "var(--wa-suave)", textDecoration: "none", padding: 4, textAlign: "center", overflow: "hidden" }}>
            📄 {m.media_nombre}
          </a>
        )
      ))}
    </div>
  );
}

function Simulador({ operadores, onListo }: { operadores: OperadorTel[]; onListo: () => void }) {
  const conTel = operadores.filter(o => o.telefono);
  const [telefono, setTelefono] = useState(conTel[0]?.telefono ?? "");
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);

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
    <details className="wa-simulador">
      <summary>🧪 Simular un WhatsApp de un operador</summary>
      {conTel.length > 0 && (
        <select value={telefono} onChange={e => setTelefono(e.target.value)} aria-label="Operador">
          {conTel.map(o => <option key={o.operador} value={o.telefono ?? ""}>{o.nombre} ({o.operador})</option>)}
        </select>
      )}
      <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono (ej. 1123456789)" />
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Texto (ej. 'te mando lo de Gómez')" />
      <input type="file" accept="image/*,.pdf,audio/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
      <button className="wa-btn" onClick={mandar} disabled={ocupado || !telefono || (!texto.trim() && !archivo)}>
        {ocupado ? "Procesando (la IA está mirando el archivo)…" : "Mandar como el operador"}
      </button>
    </details>
  );
}

function ResumenIA({ h, onTexto, ventanaAbierta, onActualizado }: { h: CasoHerramientas; onTexto: (t: string) => void; ventanaAbierta: boolean; onActualizado: () => void }) {
  const [generando, setGenerando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const r = h.resumen;

  async function generar() {
    setGenerando(true);
    try {
      const res = await fetch(`/api/casos/${h.id}/resumen`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar el resumen.");
      setAbierto(true);
      onActualizado();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo generar el resumen.");
    } finally {
      setGenerando(false);
    }
  }

  if (!r) {
    return (
      <button className="wa-btn" style={{ justifySelf: "start" }} onClick={generar} disabled={generando}>
        {generando ? "La IA está leyendo el caso…" : "✨ Resumen IA y qué falta"}
      </button>
    );
  }
  return (
    <div className="wa-resumen">
      <div className="wa-fila">
        <strong style={{ fontSize: 13 }}>✨ {r.situacion}</strong>
      </div>
      {h.resumenViejo && <div className="wa-viejo">Llegaron pruebas nuevas después de este resumen.</div>}
      <button className="wa-mas" onClick={() => setAbierto(a => !a)}>{abierto ? "Ver menos ▲" : "Ver resumen, faltantes y próximos pasos ▼"}</button>
      {abierto && (
        <>
          <p className="wa-res-txt">{r.resumen}</p>
          {r.segmento.motivo && <p className="wa-res-motivo">{r.segmento.motivo}</p>}
          {r.alertas.length > 0 && (
            <>
              <div className="wa-panel-sub">⚠️ Alertas</div>
              <ul className="wa-lista-ia alerta">{r.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </>
          )}
          {r.faltan.length > 0 && (
            <>
              <div className="wa-panel-sub">La IA sugiere que falta</div>
              <ul className="wa-lista-ia">{r.faltan.map((f, i) => <li key={i}><b>{f.que}</b>{f.por_que ? ` — ${f.por_que}` : ""}</li>)}</ul>
              {ventanaAbierta && (
                <button className="wa-mas" onClick={() => onTexto(`Para ${h.asegurado ?? "el caso"} (#${h.nro ?? "s/n"}) me falta: ${r.faltan.map(f => f.que).join(", ")}. ¿Me lo mandás?`)}>
                  ✍️ Pedírselo al operador
                </button>
              )}
            </>
          )}
          {r.proximos_pasos.length > 0 && (
            <>
              <div className="wa-panel-sub">Próximos pasos</div>
              <ol className="wa-lista-ia">{r.proximos_pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
            </>
          )}
          {r.preguntas_operador.length > 0 && (
            <>
              <div className="wa-panel-sub">Preguntas para el operador</div>
              <div className="wa-preguntas">
                {r.preguntas_operador.map((q, i) => (
                  <button key={i} disabled={!ventanaAbierta} onClick={() => onTexto(q)} title={ventanaAbierta ? "Ponerla en el mensaje" : "Ventana de 24 h cerrada"}>❓ {q}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <div className="wa-fila" style={{ fontSize: 11, color: "var(--wa-suave)" }}>
        <span>{h.resumenEn ? `Actualizado ${new Date(h.resumenEn).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        <button className="wa-mas" onClick={generar} disabled={generando}>{generando ? "Actualizando…" : "↻ Actualizar"}</button>
      </div>
    </div>
  );
}
