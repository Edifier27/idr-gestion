"use client";

import { useEffect, useRef, useState } from "react";
import { boton, campo as campoInput } from "@/lib/ui";

// Editor genérico de un campo de texto libre del caso (descargo, relato_denuncia,
// etc.), guardado vía PATCH /api/siniestros/[id]. Reusado donde haga falta cargar
// o corregir a mano un texto que normalmente viene de la extracción con IA.
//
// Autoguarda 2s después de que dejás de tipear (como Notion/Docs), además del
// botón manual para guardar al toque. El nombre del campo llega como prop
// "campo" (nombreCampo acá adentro, para no taparse con el `campo` de
// lib/ui.ts que son las clases del input — antes se tapaban entre sí y el
// textarea quedaba sin el estilo real).
export function TextoPanel({ siniestroId, campo: nombreCampo, valorInicial, placeholder, etiquetaGuardar, plantilla }: {
  siniestroId: string;
  campo: string;
  valorInicial: string | null;
  placeholder: string;
  etiquetaGuardar: string;
  plantilla?: string;
}) {
  const [texto, setTexto] = useState(valorInicial ?? plantilla ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimoGuardado = useRef(valorInicial ?? "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function guardar(valor: string) {
    if (valor === ultimoGuardado.current) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [nombreCampo]: valor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo guardar.");
      }
      ultimoGuardado.current = valor;
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  // Autoguardado: 2s de inactividad después de tipear. Se cancela si el
  // usuario sigue escribiendo o si guarda a mano antes de que se cumpla.
  useEffect(() => {
    if (texto === ultimoGuardado.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => guardar(texto), 2000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function guardarAhora() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    guardar(texto);
  }

  const cambio = texto !== ultimoGuardado.current;

  return (
    <div className="space-y-2">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={6}
        placeholder={placeholder}
        className={`w-full resize-y ${campoInput}`}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={guardarAhora}
          disabled={guardando || !cambio}
          className={boton.primario}
        >
          {guardando ? "Guardando…" : etiquetaGuardar}
        </button>
        {guardando ? (
          <span className="text-xs text-slate">Guardando…</span>
        ) : guardado ? (
          <span className="text-xs text-ok">✓ Guardado</span>
        ) : cambio ? (
          <span className="text-xs text-amber">Cambios sin guardar — se guarda solo en un momento</span>
        ) : null}
        {error && <span className="text-xs text-fraude">{error}</span>}
      </div>
    </div>
  );
}
