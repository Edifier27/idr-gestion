"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CATEGORIAS_EVIDENCIA, ORDEN_CATEGORIAS_EVIDENCIA, etiquetaCategoriaEvidencia } from "@/lib/categorias-evidencia";
import { confirmar, notificar } from "@/components/notificaciones";
import { SelectShell } from "@/components/select-shell";
import { selectCampo } from "@/lib/ui";

type Archivo = {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  categoria?: string | null;
  subidoPor: string | null;
  creadoEn: Date | string;
};

const CATEGORIAS = [{ value: "", label: "🤖 Que la IA la sugiera" }, ...CATEGORIAS_EVIDENCIA];

function etiquetaCategoria(cat?: string | null): string | null {
  return cat ? etiquetaCategoriaEvidencia(cat) : null;
}

// onArchivosChange (opcional): avisa hacia afuera cada vez que cambia la
// lista (subida o borrado) — lo usa el carrusel del operador para saber si
// ya hay al menos una prueba cargada antes de dejar avanzar a "Informe".
export function EvidenciaPanel({ siniestroId, archivosIniciales, onArchivosChange }: {
  siniestroId: string;
  archivosIniciales: Archivo[];
  onArchivosChange?: (archivos: Archivo[]) => void;
}) {
  const [archivos, setArchivos] = useState(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Cuenta enter/leave en vez de un booleano simple: al arrastrar sobre un
  // hijo del cuadro, el navegador dispara dragleave del padre + dragenter del
  // hijo — con un booleano solo, eso "parpadea" el resaltado del dropzone.
  const dragCounter = useRef(0);

  useEffect(() => { onArchivosChange?.(archivos); }, [archivos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/evidencia/upload",
          clientPayload: JSON.stringify({ siniestroId }),
        });
        const res = await fetch("/api/evidencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siniestroId, nombre: file.name, url: blob.url,
            tipo: file.type || "application/octet-stream", tamano: file.size,
            categoria: categoria || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el archivo.");
        setArchivos(a => [data.archivo, ...a]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el archivo.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current++;
    setArrastrando(true);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); // obligatorio para que el navegador permita soltar acá
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setArrastrando(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setArrastrando(false);
    if (!subiendo) onFiles(e.dataTransfer.files);
  }

  async function borrar(id: string) {
    const ok = await confirmar("¿Borrar este archivo?", { textoConfirmar: "Borrar", peligroso: true });
    if (!ok) return;
    const res = await fetch(`/api/evidencia/${id}`, { method: "DELETE" });
    if (res.ok) setArchivos(a => a.filter(f => f.id !== id));
    else notificar.error("No se pudo borrar el archivo.");
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative space-y-3 rounded-lg transition ${arrastrando ? "ring-2 ring-ink/30 ring-offset-2" : ""}`}
    >
      {arrastrando && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-ink/40 bg-paper/95 backdrop-blur-sm">
          <p className="text-sm font-semibold text-ink">📥 Soltá los archivos acá para subirlos</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SelectShell className="w-56">
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className={`w-full ${selectCampo} py-1.5 text-xs`}
            >
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </SelectShell>
          <label className="cursor-pointer rounded-md border border-ink/20 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-ink hover:text-paper">
            {subiendo ? "Subiendo…" : "+ Subir archivos"}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              disabled={subiendo}
              onChange={e => onFiles(e.target.files)}
            />
          </label>
        </div>
        <span className="text-xs text-slate">{archivos.length} archivo{archivos.length === 1 ? "" : "s"}</span>
      </div>

      <p className="text-[11px] text-slate">O arrastrá y soltá los archivos en cualquier parte de este cuadro.</p>

      {error && <p className="text-xs text-fraude">{error}</p>}

      {archivos.length === 0 ? (
        <p className="text-sm text-slate">Sin evidencia cargada todavía.</p>
      ) : (
        <div className="space-y-4">
          {agruparPorCategoria(archivos).map(grupo => (
            <div key={grupo.categoria}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate">
                {etiquetaCategoria(grupo.categoria) ?? "Sin categoría"} <span className="text-slate/50">({grupo.archivos.length})</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {grupo.archivos.map(f => <TarjetaArchivo key={f.id} f={f} onBorrar={borrar} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Agrupa los archivos en el mismo orden en el que después se arman en el
// expediente PDF (lib/pdf.ts) — así lo que el operador ve mientras carga
// evidencia es exactamente el orden en el que le va a llegar al admin. Lo
// sin categorizar (todavía sin clasificar por IA, o clasificación fallida)
// queda al final, aparte.
function agruparPorCategoria(archivos: Archivo[]): { categoria: string | null; archivos: Archivo[] }[] {
  const grupos: { categoria: string | null; archivos: Archivo[] }[] = [];
  for (const cat of ORDEN_CATEGORIAS_EVIDENCIA) {
    const delGrupo = archivos.filter(a => a.categoria === cat);
    if (delGrupo.length > 0) grupos.push({ categoria: cat, archivos: delGrupo });
  }
  const sinCategoria = archivos.filter(a => !a.categoria || !(ORDEN_CATEGORIAS_EVIDENCIA as readonly string[]).includes(a.categoria));
  if (sinCategoria.length > 0) grupos.push({ categoria: null, archivos: sinCategoria });
  return grupos;
}

function TarjetaArchivo({ f, onBorrar }: { f: Archivo; onBorrar: (id: string) => void }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition hover:shadow-md">
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
        {f.tipo.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.nombre} className="h-24 w-full object-cover" />
        ) : (
          <div className="flex h-24 w-full flex-col items-center justify-center gap-1 text-slate">
            <span className="text-2xl">📄</span>
            <span className="px-1 text-center text-[10px] leading-tight">{f.nombre}</span>
          </div>
        )}
      </a>
      <button
        onClick={() => onBorrar(f.id)}
        className="absolute right-1 top-1 hidden rounded bg-fraude/90 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block"
      >
        Borrar
      </button>
      <div className="truncate px-1.5 py-1 text-[10px] text-slate">
        {f.subidoPor ?? "—"} · {new Date(f.creadoEn).toLocaleDateString("es-AR")}
      </div>
    </div>
  );
}
