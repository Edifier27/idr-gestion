"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Visor de pruebas en ventana emergente (sin abrir otra pestaña): zoom con la
// ruedita o los botones, doble clic para acercar donde se toca, arrastrar
// para moverse, lupa que agranda donde pasa el mouse, flechas para pasar de
// prueba y, al lado, el "Texto según la IA" (la transcripción de la ampliación
// manuscrita, la denuncia, formularios o capturas).

export type PruebaVisor = { id: string; nombre: string; url: string; tipo: string; categoria?: string | null; etiqueta?: string };

// En estas se lee sola al abrir (suelen ser manuscritas o con mucho texto).
const LEER_SOLA = ["ampliacion", "denuncia", "desiste"];

export function esImagen(p: { tipo: string; nombre: string }) {
  return p.tipo.startsWith("image/") || /\.(jpe?g|jfif|png|webp|gif|heic)$/i.test(p.nombre);
}
const esPdf = (p: { tipo: string; nombre: string }) => p.tipo === "application/pdf" || /\.pdf$/i.test(p.nombre);

function Zoomable({ url, alt }: { url: string; alt: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [lupa, setLupa] = useState(false);
  const [puntero, setPuntero] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => { setEscala(1); setPos({ x: 0, y: 0 }); }, [url]);

  // Zoom hacia el punto (cx, cy) de la caja: ese punto queda quieto en pantalla.
  const zoomEn = useCallback((nueva: number, cx: number, cy: number) => {
    const e = Math.min(8, Math.max(1, nueva));
    setPos(p => {
      if (e === 1) return { x: 0, y: 0 };
      const k = e / escala;
      return { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k };
    });
    setEscala(e);
  }, [escala]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      zoomEn(escala * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), ev.clientX - r.left - r.width / 2, ev.clientY - r.top - r.height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [escala, zoomEn]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="absolute left-3 top-3 z-20 flex gap-1 rounded-lg bg-black/60 p-1 text-white backdrop-blur">
        <button onClick={() => zoomEn(escala / 1.4, 0, 0)} className="h-8 w-8 rounded hover:bg-white/20" aria-label="Alejar">−</button>
        <span className="flex w-12 items-center justify-center text-xs tabular-nums">{Math.round(escala * 100)}%</span>
        <button onClick={() => zoomEn(escala * 1.4, 0, 0)} className="h-8 w-8 rounded hover:bg-white/20" aria-label="Acercar">+</button>
        <button onClick={() => { setEscala(1); setPos({ x: 0, y: 0 }); }} className="rounded px-2 text-xs hover:bg-white/20">Ajustar</button>
        <button onClick={() => setLupa(l => !l)} className={`rounded px-2 text-xs ${lupa ? "bg-white text-ink" : "hover:bg-white/20"}`} title="Lupa: agranda donde pasás el mouse">🔍 Lupa</button>
      </div>
      <div
        ref={caja}
        className={`relative flex-1 select-none overflow-hidden ${lupa ? "cursor-none" : escala > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        onDoubleClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
          if (escala > 1) { setEscala(1); setPos({ x: 0, y: 0 }); } else zoomEn(2.5, cx, cy);
        }}
        onPointerDown={e => { if (lupa || escala === 1) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); arrastre.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          if (lupa) setPuntero({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
          const a = arrastre.current;
          if (a) setPos({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y });
        }}
        onPointerUp={() => { arrastre.current = null; }}
        onPointerLeave={() => { arrastre.current = null; setPuntero(null); }}
      >
        <Escena url={url} alt={alt} pos={pos} escala={escala} animar={!arrastre.current} />
        {lupa && puntero && (
          // La lupa repite la misma escena, 3 veces más grande, centrada en el puntero.
          <div className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-4 border-white bg-black shadow-2xl"
            style={{ width: LUPA, height: LUPA, left: puntero.x - LUPA / 2, top: puntero.y - LUPA / 2 }}>
            <div className="absolute left-0 top-0" style={{ width: puntero.w, height: puntero.h, transformOrigin: "0 0", transform: `translate(${LUPA / 2 - puntero.x * 3}px, ${LUPA / 2 - puntero.y * 3}px) scale(3)` }}>
              <Escena url={url} alt="" pos={pos} escala={escala} animar={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LUPA = 240;

function Escena({ url, alt, pos, escala, animar }: { url: string; alt: string; pos: { x: number; y: number }; escala: number; animar: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`, transition: animar ? "transform 120ms ease-out" : "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} draggable={false} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function VisorPrueba({ pruebas, inicial, onCerrar }: { pruebas: PruebaVisor[]; inicial: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicial);
  const p = pruebas[i];
  const [texto, setTexto] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);

  const ir = useCallback((d: number) => setI(x => (x + d + pruebas.length) % pruebas.length), [pruebas.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [ir, onCerrar]);

  const leer = useCallback(async (id: string) => {
    setLeyendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidencia/${id}/transcripcion`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo leer la prueba.");
      setTexto(data.transcripcion.texto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la prueba.");
    } finally {
      setLeyendo(false);
    }
  }, []);

  // Al cambiar de prueba: si ya se leyó, se muestra; si es manuscrita o un documento, se lee sola.
  useEffect(() => {
    if (!p) return;
    let vigente = true;
    setTexto(null);
    setError(null);
    fetch(`/api/evidencia/${p.id}/transcripcion`).then(r => r.json()).then(d => {
      if (!vigente) return;
      if (d?.transcripcion?.texto) setTexto(d.transcripcion.texto);
      else if (p.categoria && LEER_SOLA.includes(p.categoria)) leer(p.id);
    }).catch(() => {});
    return () => { vigente = false; };
  }, [p, leer]);

  if (!p) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm" role="dialog" aria-label={`Prueba ${p.nombre}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.etiqueta ?? p.nombre}</p>
          <p className="truncate text-xs text-white/60">{p.nombre} · {i + 1} de {pruebas.length}</p>
        </div>
        <button onClick={() => setPanel(v => !v)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${panel ? "bg-white text-ink" : "bg-white/15 hover:bg-white/25"}`}>Texto según la IA</button>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="rounded-md bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25">Descargar</a>
        <button onClick={onCerrar} className="rounded-md bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25" aria-label="Cerrar">✕</button>
      </div>
      <div className={`grid min-h-0 flex-1 gap-0 ${panel ? "lg:grid-cols-[minmax(0,1fr)_420px] grid-rows-[minmax(0,1fr)_minmax(0,40%)] lg:grid-rows-1" : ""}`}>
        <div className="relative min-h-0">
          {pruebas.length > 1 && (
            <>
              <button onClick={() => ir(-1)} className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/30" aria-label="Anterior">‹</button>
              <button onClick={() => ir(1)} className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/30" aria-label="Siguiente">›</button>
            </>
          )}
          {esImagen(p) ? <Zoomable url={p.url} alt={p.nombre} />
            : esPdf(p) ? <iframe src={p.url} title={p.nombre} className="h-full w-full bg-white" />
            : <div className="flex h-full items-center justify-center text-sm text-white/70">Este archivo no se puede ver acá. Usá Descargar.</div>}
        </div>
        {panel && (
          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-white lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Texto según la IA</p>
              <div className="flex gap-1.5">
                {texto && <button onClick={() => { navigator.clipboard?.writeText(texto); }} className="rounded px-2 py-1 text-xs text-slate hover:bg-paper hover:text-ink">Copiar</button>}
                <button onClick={() => leer(p.id)} disabled={leyendo} className="rounded bg-azul px-2.5 py-1 text-xs font-semibold text-paper disabled:opacity-50">
                  {leyendo ? "Leyendo…" : texto ? "Volver a leer" : "Leer con IA"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {leyendo && !texto && (
                <p className="flex items-center gap-2 text-sm text-slate"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-azul/30 border-t-azul" />La IA está leyendo la prueba…</p>
              )}
              {error && <p className="text-sm text-fraude">{error}</p>}
              {texto ? <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink">{texto}</pre>
                : !leyendo && !error && <p className="text-sm text-slate">Tocá "Leer con IA" para ver lo que dice esta prueba en texto (sirve para manuscritos, denuncias, formularios y capturas). Queda guardado.</p>}
              {texto && <p className="mt-3 border-t border-line pt-2 text-[11px] text-slate">Transcripción automática: ante la duda, manda la imagen.</p>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
