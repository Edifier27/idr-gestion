"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, selectCampo } from "@/lib/ui";
import { SelectShell } from "@/components/select-shell";
import { ETAPAS_CONTACTO, plazoInforme } from "@/lib/etapa-contacto";
import { googleCalendarUrl } from "@/lib/calendario";

// Convierte un ISO string (o Date) a formato "YYYY-MM-DDTHH:mm" para el input
// datetime-local, en hora local del navegador.
function aInputLocal(fecha: string | Date | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EtapaContactoPanel({ siniestroId, etapaContacto, fechaEntrevista, motivoContacto, derivadoAdmin, derivadoEn, denunciante, domicilio }: {
  siniestroId: string;
  etapaContacto: string | null;
  fechaEntrevista: string | Date | null;
  motivoContacto: string | null;
  derivadoAdmin?: boolean;
  derivadoEn?: string | Date | null;
  denunciante?: string | null;
  domicilio?: string | null;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(etapaContacto ?? "");
  // Arranca vacío, no aInputLocal(fechaEntrevista) directo: el server (UTC)
  // y el navegador (hora de Argentina) calculan la hora local distinto, y
  // el link de Google Calendar puede quedar pegado al valor del servidor,
  // desfasado — se carga posta recién en el cliente. Ver el mismo comentario
  // en caso-wizard.tsx.
  const [fecha, setFecha] = useState("");
  useEffect(() => { setFecha(aInputLocal(fechaEntrevista)); }, [fechaEntrevista]);
  const [motivo, setMotivo] = useState(motivoContacto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(patch: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  function cambiarEtapa(v: string) {
    setEtapa(v);
    guardar({ etapa_contacto: v || null });
  }

  const plazo = plazoInforme(etapaContacto, fechaEntrevista);
  const linkCalendario = fecha ? googleCalendarUrl({
    titulo: `Entrevista — ${denunciante ?? "denunciante"}`,
    inicioLocal: fecha,
    ubicacion: domicilio || undefined,
  }) : null;

  return (
    <div className="space-y-3">
      {derivadoAdmin && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-fraude/30 bg-fraude/5 px-3 py-2">
          <p className="text-sm font-medium text-fraude">
            🚩 Derivado por el operador{derivadoEn ? ` · ${new Date(derivadoEn).toLocaleString("es-AR")}` : ""} — no logró contactarlo.
          </p>
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardar({ derivado_admin: false })}
            className="shrink-0 rounded-md border border-fraude/30 bg-white px-2.5 py-1 text-xs font-semibold text-fraude shadow-sm transition hover:bg-fraude/10 disabled:opacity-50"
          >
            ✓ Marcar atendido
          </button>
        </div>
      )}

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate">Etapa</span>
        <SelectShell className="w-48">
          <select value={etapa} disabled={guardando} onChange={e => cambiarEtapa(e.target.value)} className={`w-full ${selectCampo}`}>
            <option value="">Recibido</option>
            {ETAPAS_CONTACTO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </SelectShell>
      </label>

      {etapa === "contacto_fallido" && (
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Motivo (le avisa al admin)</span>
          <div className="flex gap-2">
            <input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: no coincide el DNI, celular incorrecto…"
              className={`w-full ${campo}`}
            />
            <button type="button" disabled={guardando} onClick={() => guardar({ motivo_contacto: motivo })} className={boton.secundario}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {etapa === "entrevista_pactada" && (
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Fecha y hora de la entrevista</span>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className={`w-full ${campo}`}
            />
            <button
              type="button"
              disabled={guardando}
              onClick={() => guardar({ fecha_entrevista: fecha ? new Date(fecha).toISOString() : null })}
              className={boton.secundario}
            >
              Guardar
            </button>
          </div>
          {linkCalendario && (
            <a href={linkCalendario} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-ink hover:underline">
              🗓️ Agregar a Google Calendar
            </a>
          )}
          {plazo && (
            <p className={`mt-1.5 text-xs font-medium ${plazo === "vencido" ? "text-fraude" : plazo === "atencion" ? "text-amber" : "text-slate"}`}>
              {plazo === "vencido" && "⚠ Vencido — pasaron más de 48hs de la entrevista sin informe."}
              {plazo === "atencion" && "⏰ Atención — se cumplen 48hs pronto, todavía sin informe."}
              {plazo === "ok" && "En plazo: tenés 48hs desde la entrevista para cargar el informe."}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-fraude">{error}</p>}
    </div>
  );
}
