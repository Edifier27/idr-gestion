"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Marca el caso como cerrado (estado = "cerrado") y lo saca de las bandejas
// de trabajo activas — pasa a verse solo en la pestaña "Cerrados" del
// tablero. Mismo campo "estado" que ya existía, solo que ahora hay un botón
// directo en vez de tener que ir a buscarlo en el select.
export function CerrarCasoBoton({ siniestroId, yaClosed }: { siniestroId: string; yaClosed: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function cerrar() {
    if (!window.confirm("¿Cerrar este caso? Va a salir de las bandejas de trabajo activas (Hoy, Todos, etc.) y va a quedar solo en \"Cerrados\".")) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cerrado" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo cerrar el caso.");
      }
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al cerrar el caso.");
    } finally {
      setEnviando(false);
    }
  }

  if (yaClosed) {
    return (
      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-paper px-3.5 py-2 text-sm font-medium text-slate">
        🔒 Caso cerrado
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={cerrar}
      disabled={enviando}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-fraude/30 bg-fraude/5 px-3.5 py-2 text-sm font-medium text-fraude shadow-sm transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {enviando ? "Cerrando…" : "🔒 Cerrar caso"}
    </button>
  );
}
