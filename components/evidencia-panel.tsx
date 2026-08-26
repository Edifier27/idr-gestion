"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CATEGORIAS_EVIDENCIA, etiquetaCategoriaEvidencia } from "@/lib/categorias-evidencia";

type Archivo = {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  categoria?: string | null;
  subidoPor: string | null;
  creadoEn: Date | string;
};

const CATEGORIAS = [{ value: "", label: "Sin categoría" }, ...CATEGORIAS_EVIDENCIA];

function etiquetaCategoria(cat?: string | null): string | null {
  return cat ? etiquetaCategoriaEvidencia(cat) : null;
}

export function EvidenciaPanel({ siniestroId, archivosIniciales }: {
  siniestroId: string;
  archivosIniciales: Archivo[];
}) {
  const [archivos, setArchivos] = useState(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function borrar(id: string) {
    if (!window.confirm("¿Borrar este archivo?")) return;
    const res = await fetch(`/api/evidencia/${id}`, { method: "DELETE" });
    if (res.ok) setArchivos(a => a.filter(f => f.id !== id));
    else window.alert("No se pudo borrar el archivo.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink shadow-sm transition focus:border-ink/40 focus:outline-none"
          >
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
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

      {error && <p className="text-xs text-fraude">{error}</p>}

      {archivos.length === 0 ? (
        <p className="text-sm text-slate">Sin evidencia cargada todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {archivos.map(f => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition hover:shadow-md">
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
                onClick={() => borrar(f.id)}
                className="absolute right-1 top-1 hidden rounded bg-fraude/90 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block"
              >
                Borrar
              </button>
              {etiquetaCategoria(f.categoria) && (
                <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[9px] font-medium text-paper">
                  {etiquetaCategoria(f.categoria)}
                </span>
              )}
              <div className="truncate px-1.5 py-1 text-[10px] text-slate">
                {f.subidoPor ?? "—"} · {new Date(f.creadoEn).toLocaleDateString("es-AR")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
