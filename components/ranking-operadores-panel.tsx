"use client";

import { useMemo, useRef, useState } from "react";
import { boton, selectCampo, tarjetaElevada, colorPorTexto } from "@/lib/ui";
import { SelectShell } from "@/components/select-shell";
import { notificar } from "@/components/notificaciones";

export type StatOperador = { nombre: string; total: number; resueltos: number };
export type EventoDesistido = { operador: string; fecha: string }; // fecha: ISO string

const COLOR = {
  ink: "#141b2e",
  slate: "#3a4358",
  paper: "#f6f5f1",
  line: "#e2e0d8",
  amber: "#c9902e",
  ok: "#2f7d5b",
  white: "#ffffff",
};

const MEDALLA = ["🥇", "🥈", "🥉"];
const FUENTE = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const TODOS = "all";

function etiquetaMes(clave: string): string {
  if (clave === TODOS) return "Todo el historial";
  const [anio, mes] = clave.split("-").map(Number);
  const txt = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// Panel de ranking de operadores por cantidad de casos desistidos — Dario
// pidió algo para "motivar" al equipo (ej. "Lucía va dos desiste versus
// Nacho que va uno"), con la posibilidad de verlo por mes, y poder mandar
// una imagen con el resultado (mismo patrón de "copiar imagen" que ya
// usaron en otro proyecto). El filtro por mes se resuelve acá mismo, del
// lado del cliente, agrupando los eventos de desistimiento que manda el
// server — cambiar de mes no pega contra la base de nuevo.
export function RankingOperadoresPanel({ stats, eventos, fecha }: { stats: StatOperador[]; eventos: EventoDesistido[]; fecha: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generando, setGenerando] = useState(false);
  const [mes, setMes] = useState(TODOS);

  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) set.add(e.fecha.slice(0, 7)); // "YYYY-MM"
    return [TODOS, ...Array.from(set).sort().reverse()];
  }, [eventos]);

  const desistidosPorOperador = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const e of eventos) {
      if (mes !== TODOS && !e.fecha.startsWith(mes)) continue;
      mapa.set(e.operador, (mapa.get(e.operador) ?? 0) + 1);
    }
    return mapa;
  }, [eventos, mes]);

  const statsOrdenados = useMemo(
    () => stats
      .map(s => ({ ...s, desistidos: desistidosPorOperador.get(s.nombre) ?? 0 }))
      .sort((a, b) => b.desistidos - a.desistidos || b.total - a.total),
    [stats, desistidosPorOperador]
  );

  const maxDesistidos = Math.max(1, ...statsOrdenados.map(s => s.desistidos));
  const tituloMes = etiquetaMes(mes);

  function dibujarCanvas(): HTMLCanvasElement {
    const ancho = 1080;
    const altoHeader = 260;
    const altoFila = 168;
    const altoFooter = 90;
    const alto = altoHeader + statsOrdenados.length * altoFila + altoFooter;

    const canvas = canvasRef.current ?? document.createElement("canvas");
    const escala = 2; // nitidez tipo retina, para que se vea bien al pegarlo en un chat
    canvas.width = ancho * escala;
    canvas.height = alto * escala;
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(escala, escala);

    // Fondo
    ctx.fillStyle = COLOR.paper;
    ctx.fillRect(0, 0, ancho, alto);

    // Header
    ctx.fillStyle = COLOR.ink;
    ctx.fillRect(0, 0, ancho, altoHeader);
    ctx.fillStyle = COLOR.amber;
    ctx.fillRect(0, altoHeader - 6, ancho, 6);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 30px ${FUENTE}`;
    ctx.fillText("IDR GESTIÓN", 56, 74);
    ctx.font = `800 50px ${FUENTE}`;
    ctx.fillText("🏆 Ranking de desistidos", 56, 148);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `500 24px ${FUENTE}`;
    ctx.fillText(`${tituloMes} · generado el ${fecha}`, 56, 192);

    // Filas
    statsOrdenados.forEach((s, i) => {
      const filaY = altoHeader + i * altoFila;
      ctx.fillStyle = i % 2 === 0 ? COLOR.white : "#faf9f6";
      ctx.fillRect(0, filaY, ancho, altoFila);
      if (i < 3 && s.desistidos > 0) {
        ctx.fillStyle = COLOR.amber;
        ctx.fillRect(0, filaY, 8, altoFila);
      }

      const cy = filaY + altoFila / 2;

      // Puesto / medalla
      ctx.textAlign = "center";
      ctx.fillStyle = COLOR.ink;
      ctx.font = i < 3 && s.desistidos > 0 ? `44px ${FUENTE}` : `700 34px ${FUENTE}`;
      ctx.fillText(i < 3 && s.desistidos > 0 ? MEDALLA[i] : String(i + 1), 130, cy + 14);

      // Avatar
      const avatarX = 230;
      ctx.beginPath();
      ctx.arc(avatarX, cy, 40, 0, Math.PI * 2);
      ctx.fillStyle = colorPorTexto(s.nombre);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 32px ${FUENTE}`;
      ctx.fillText((s.nombre.trim()[0] ?? "?").toUpperCase(), avatarX, cy + 12);

      // Nombre + detalle
      ctx.textAlign = "left";
      const textoX = 300;
      ctx.fillStyle = COLOR.ink;
      ctx.font = `800 34px ${FUENTE}`;
      ctx.fillText(s.nombre.toUpperCase(), textoX, cy - 6);
      ctx.fillStyle = COLOR.slate;
      ctx.font = `500 22px ${FUENTE}`;
      ctx.fillText(
        `${s.total} caso${s.total === 1 ? "" : "s"} gestionado${s.total === 1 ? "" : "s"} en total · ${s.resueltos} resuelto${s.resueltos === 1 ? "" : "s"}`,
        textoX, cy + 28
      );

      // Barra proporcional al líder
      const barraAncho = 480;
      ctx.fillStyle = COLOR.line;
      ctx.fillRect(textoX, cy + 44, barraAncho, 10);
      ctx.fillStyle = i === 0 && s.desistidos > 0 ? COLOR.amber : COLOR.ok;
      ctx.fillRect(textoX, cy + 44, barraAncho * (s.desistidos / maxDesistidos), 10);

      // Número grande de desistidos
      ctx.textAlign = "right";
      ctx.fillStyle = COLOR.ink;
      ctx.font = `800 64px ${FUENTE}`;
      ctx.fillText(String(s.desistidos), ancho - 60, cy + 18);
      ctx.fillStyle = COLOR.slate;
      ctx.font = `600 20px ${FUENTE}`;
      ctx.fillText("DESISTIDOS", ancho - 60, cy + 42);
      ctx.textAlign = "left";
    });

    // Footer
    const footerY = altoHeader + statsOrdenados.length * altoFila;
    ctx.fillStyle = COLOR.line;
    ctx.fillRect(0, footerY, ancho, 1);
    ctx.fillStyle = COLOR.slate;
    ctx.font = `500 20px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillText("Generado desde el CRM · idrgestion.com.ar", ancho / 2, footerY + altoFooter / 2 + 7);
    ctx.textAlign = "left";

    return canvas;
  }

  function descargarBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking-desistidos-${mes === TODOS ? "historial" : mes}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiarImagen() {
    if (statsOrdenados.length === 0) return;
    setGenerando(true);
    try {
      const canvas = dibujarCanvas();
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) { notificar.error("No se pudo generar la imagen."); return; }

      try {
        if (navigator.clipboard && typeof window !== "undefined" && "ClipboardItem" in window) {
          const Ctor = (window as unknown as { ClipboardItem: new (items: Record<string, Blob>) => ClipboardItem }).ClipboardItem;
          await navigator.clipboard.write([new Ctor({ "image/png": blob })]);
          notificar.ok("Imagen copiada — pegala donde quieras mandarla (WhatsApp, mail…).");
          return;
        }
      } catch {
        // este navegador no dejó copiar la imagen — sigue al fallback de descarga
      }
      descargarBlob(blob);
      notificar.ok("Se descargó la imagen (este navegador no permite copiarla directo).");
    } finally {
      setGenerando(false);
    }
  }

  if (statsOrdenados.length === 0) {
    return (
      <div className={`p-8 text-center ${tarjetaElevada}`}>
        <p className="text-sm text-slate">
          Todavía no hay operadores activos para armar un ranking. Creá usuarios en{" "}
          <a href="/admin/usuarios" className="font-medium text-ink underline">Usuarios</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectShell>
          <select value={mes} onChange={e => setMes(e.target.value)} className={`w-48 ${selectCampo}`}>
            {meses.map(m => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
          </select>
        </SelectShell>
        <button onClick={copiarImagen} disabled={generando} className={boton.primario}>
          {generando ? "Generando…" : "📋 Copiar imagen"}
        </button>
      </div>

      <div className={`overflow-hidden ${tarjetaElevada}`}>
        {statsOrdenados.map((s, i) => (
          <div key={s.nombre} className={`flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 ${i < 3 && s.desistidos > 0 ? "bg-amber/5" : ""}`}>
            <span className="flex w-9 shrink-0 items-center justify-center text-2xl">
              {i < 3 && s.desistidos > 0 ? MEDALLA[i] : <span className="text-sm font-bold text-slate">{i + 1}</span>}
            </span>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: colorPorTexto(s.nombre) }}
            >
              {(s.nombre.trim()[0] ?? "?").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold uppercase tracking-wide text-ink">{s.nombre}</p>
              <p className="text-xs text-slate">
                {s.total} caso{s.total === 1 ? "" : "s"} gestionado{s.total === 1 ? "" : "s"} en total · {s.resueltos} resuelto{s.resueltos === 1 ? "" : "s"}
              </p>
              <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${i === 0 && s.desistidos > 0 ? "bg-amber" : "bg-ok"}`}
                  style={{ width: `${Math.max(4, (s.desistidos / maxDesistidos) * 100)}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-2xl font-extrabold text-ink">{s.desistidos}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate">desistidos</p>
            </div>
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
