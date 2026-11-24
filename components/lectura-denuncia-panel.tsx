"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton } from "@/lib/ui";
import { notificar } from "@/components/notificaciones";
import type { LecturaDenuncia } from "@/lib/leer-denuncia";
import { Icono } from "@/components/iconos-idr";

// Botón "Leer denuncia y ampliación" + resultado del cotejo denuncia vs.
// siniestro (lo que coincide, lo que no y las alertas). Va arriba del
// relato en el Cotejo; al leer, el relato se rearma solo.
export function LecturaDenunciaPanel({ siniestroId, lecturaInicial }: { siniestroId: string; lecturaInicial: LecturaDenuncia | null }) {
  const router = useRouter();
  const [lectura, setLectura] = useState(lecturaInicial);
  const [leyendo, setLeyendo] = useState(false);
  const [abierto, setAbierto] = useState(false);

  async function leer() {
    setLeyendo(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}/leer-denuncia`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer la denuncia.");
      setLectura(data.lectura);
      setAbierto(true);
      notificar.ok("Denuncia leída: el relato se actualizó.");
      router.refresh();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "No se pudo leer la denuncia.");
    } finally {
      setLeyendo(false);
    }
  }

  const difieren = lectura?.cotejo.filter(c => c.coincide === false) ?? [];

  return (
    <div className="mb-3 space-y-2">
      <button onClick={leer} disabled={leyendo} className={`w-full ${boton.secundario}`}>
        {leyendo ? "Leyendo denuncia…" : lectura ? "Volver a leer denuncia y ampliación" : "Leer denuncia y ampliación con IA"}
      </button>
      {lectura && (
        <div className="rounded-md border border-line bg-paper/60 p-2.5 text-xs">
          <button onClick={() => setAbierto(a => !a)} className="flex w-full items-center justify-between gap-2 text-left font-semibold text-ink">
            <span>
              Denuncia vs. siniestro:{" "}
              {difieren.length
                ? <span className="text-fraude">{difieren.length} dato{difieren.length === 1 ? "" : "s"} no coincide{difieren.length === 1 ? "" : "n"}</span>
                : <span className="text-ok">sin diferencias</span>}
            </span>
            <span className="text-slate">{abierto ? "▲" : "▼"}</span>
          </button>
          {abierto && (
            <div className="mt-2 space-y-2">
              <table className="w-full table-fixed text-left">
                <thead className="text-[10px] uppercase tracking-wide text-slate">
                  <tr><th className="w-1/4 pb-1">Dato</th><th className="pb-1">Siniestro</th><th className="pb-1">Denuncia</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lectura.cotejo.map((c, i) => (
                    <tr key={i} className={c.coincide === false ? "bg-fraude/5" : ""}>
                      <td className="py-1 pr-1 align-top font-medium text-ink">{c.coincide === false ? <Icono n="alerta" size={13} className="mr-1 inline align-[-2px] text-fraude" /> : c.coincide ? "✓ " : ""}{c.dato}</td>
                      <td className="py-1 pr-1 align-top text-slate">{c.siniestro ?? "—"}</td>
                      <td className="py-1 align-top text-slate">{c.denuncia ?? "—"}{c.nota ? <span className="block text-[10px] italic">{c.nota}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lectura.alertas.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-fraude">{lectura.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
              )}
              {lectura.cambios.length > 0 && (
                <p className="text-slate"><span className="font-semibold text-ink">Se actualizó:</span> {lectura.cambios.join(" · ")}</p>
              )}
              <p className="text-[10px] text-slate">Leído el {new Date(lectura.leidoEn).toLocaleString("es-AR")} · {lectura.archivos.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
