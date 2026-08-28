// Seguimiento operativo día a día de un caso (contacto → entrevista →
// informe), separado del "estado" administrativo/facturación. null =
// todavía sin iniciar (recién ingresado).
export const ETAPAS_CONTACTO = [
  { value: "contacto_fallido", label: "Contactado (sin respuesta)" },
  { value: "contactado", label: "Contactado (OK)" },
  { value: "entrevista_pactada", label: "Entrevista pactada" },
  { value: "informe_enviado", label: "Informe enviado" },
] as const;

export function etiquetaEtapaContacto(etapa?: string | null): string {
  if (!etapa) return "Recibido";
  return ETAPAS_CONTACTO.find(e => e.value === etapa)?.label ?? etapa;
}

export type EstadoPlazo = "ok" | "atencion" | "vencido";

// Plazo de 48hs desde la entrevista para cargar el informe: a las 24hs sin
// informe pasa a "atención" (ámbar), a las 48hs a "vencido" (rojo) — mismo
// criterio visual que el vencimiento general del caso. Solo aplica mientras
// la etapa siga en "entrevista_pactada" (una vez que se manda el informe,
// deja de contar).
export function plazoInforme(etapaContacto: string | null | undefined, fechaEntrevista: Date | string | null | undefined): EstadoPlazo | null {
  if (etapaContacto !== "entrevista_pactada" || !fechaEntrevista) return null;
  const horas = (Date.now() - new Date(fechaEntrevista).getTime()) / 3_600_000;
  if (horas >= 48) return "vencido";
  if (horas >= 24) return "atencion";
  return "ok";
}
