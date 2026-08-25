// Parámetros de facturación del liquidador.
// Los primeros 30 km están bonificados; después se cobra $650/km,
// más un valor fijo de informe de $50.000.
export const PARAMETROS = {
  KM_BONIFICADOS: 30,
  VALOR_KM: 650,
  VALOR_INFORME: 50000,
} as const;

/**
 * Calcula el monto a facturar a la aseguradora.
 * FACTURAR = MAX(0, km - 30) * 650 + 50.000
 *
 * @param kmTotal recorrido total base->domicilio->hecho->regreso (Maps API)
 */
export function calcularFacturacion(kmTotal: number | null): number | null {
  if (kmTotal == null || Number.isNaN(kmTotal)) return null;
  const kmFacturables = Math.max(0, kmTotal - PARAMETROS.KM_BONIFICADOS);
  return kmFacturables * PARAMETROS.VALOR_KM + PARAMETROS.VALOR_INFORME;
}

/** Desglose para mostrar en el detalle del siniestro. */
export function desgloseFacturacion(kmTotal: number | null) {
  const kmFacturables = kmTotal == null ? 0 : Math.max(0, kmTotal - PARAMETROS.KM_BONIFICADOS);
  return {
    kmTotal: kmTotal ?? 0,
    kmBonificados: PARAMETROS.KM_BONIFICADOS,
    kmFacturables,
    montoKm: kmFacturables * PARAMETROS.VALOR_KM,
    montoInforme: PARAMETROS.VALOR_INFORME,
    total: calcularFacturacion(kmTotal) ?? 0,
  };
}

const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
export const formatARS = (n: number | null) => (n == null ? "—" : fmt.format(n));
