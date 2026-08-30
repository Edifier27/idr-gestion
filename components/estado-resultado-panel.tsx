"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { selectCampo } from "@/lib/ui";
import { SelectShell } from "@/components/select-shell";

const ESTADOS = [
  { value: "ingresado", label: "Ingresado" },
  { value: "en_gestion", label: "En gestión" },
  { value: "inspeccionado", label: "Inspeccionado" },
  { value: "elevado", label: "Elevado" },
  { value: "facturado", label: "Facturado" },
  { value: "cerrado", label: "Cerrado" },
];

const RESULTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "sin_fraude", label: "Sin fraude" },
  { value: "con_fraude", label: "Fraude" },
  { value: "posible_fraude", label: "Posible fraude" },
  { value: "desistido", label: "Desistido" },
  { value: "rechazo", label: "Rechazo" },
  { value: "sin_cobertura", label: "Sin cobertura" },
];

const COBROS = [
  { value: "no_facturado", label: "Sin facturar" },
  { value: "facturado", label: "Facturado" },
  { value: "presentado", label: "Presentado" },
  { value: "cobrado", label: "Cobrado" },
  { value: "rechazado", label: "Rechazado" },
];

export function EstadoResultadoPanel({ siniestroId, estado, resultado, estadoCobro, verFacturacion }: {
  siniestroId: string;
  estado: string;
  resultado: string;
  estadoCobro: string | null;
  verFacturacion: boolean;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function actualizar(campo: string, valor: string) {
    setGuardando(campo);
    setError(null);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo actualizar.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="space-y-3">
      <CampoSelect
        label="Estado"
        valor={estado}
        opciones={ESTADOS}
        disabled={guardando === "estado"}
        onChange={v => actualizar("estado", v)}
      />
      <CampoSelect
        label="Resultado"
        valor={resultado}
        opciones={RESULTADOS}
        disabled={guardando === "resultado"}
        onChange={v => actualizar("resultado", v)}
      />
      {verFacturacion && (
        <CampoSelect
          label="Cobro"
          valor={estadoCobro ?? "no_facturado"}
          opciones={COBROS}
          disabled={guardando === "estado_cobro"}
          onChange={v => actualizar("estado_cobro", v)}
        />
      )}
      {error && <p className="text-xs text-fraude">{error}</p>}
    </div>
  );
}

function CampoSelect({ label, valor, opciones, disabled, onChange }: {
  label: string;
  valor: string;
  opciones: { value: string; label: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate">{label}</span>
      <SelectShell className="w-44">
        <select
          value={valor}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className={`w-full ${selectCampo}`}
        >
          {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </SelectShell>
    </label>
  );
}
