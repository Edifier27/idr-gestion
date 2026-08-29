// Categorías de evidencia, compartidas entre el selector de subida
// (components/evidencia-panel.tsx), la clasificación automática por IA
// (lib/clasificar-evidencia.ts) y el armado del expediente en PDF
// (lib/pdf.ts) — una sola fuente de verdad para los value/label.
export const CATEGORIAS_EVIDENCIA = [
  { value: "dni", label: "DNI asegurado" },
  { value: "registro_conducir", label: "Registro de conducir" },
  { value: "cedula_vehiculo", label: "Cédula del vehículo" },
  { value: "denuncia", label: "Denuncia penal/ciudadana" },
  { value: "ampliacion", label: "Ampliación (manuscrita)" },
  { value: "desiste", label: "Desistimiento firmado" },
  { value: "geolocalizacion", label: "Geolocalización" },
  { value: "llamadas", label: "Registro de llamadas" },
  { value: "mensajes", label: "Mensajes / chats" },
  { value: "foto_siniestro", label: "Foto del siniestro (vehículo/bien)" },
  { value: "foto_lugar", label: "Foto del lugar del hecho" },
  { value: "fotos", label: "Otras fotos" },
  { value: "otro", label: "Otro" },
] as const;

export function etiquetaCategoriaEvidencia(cat?: string | null): string {
  if (!cat) return "Sin categoría";
  return CATEGORIAS_EVIDENCIA.find(c => c.value === cat)?.label ?? cat;
}

// Orden real en el que se arma el expediente/informe final — calcado del
// informe real de referencia que mandó Dario (Estudio IGD): pruebas
// digitales primero (geolocalización, llamadas, mensajes, fotos), después
// documentación de los intervinientes (registro de conducir, DNI, cédula,
// denuncia, ampliación, desiste). Una sola fuente de verdad para que el PDF
// (lib/pdf.ts) y la vista agrupada del panel de evidencia se vean siempre
// igual — así lo que el operador ve mientras carga fotos en el carrusel es
// exactamente el orden en el que le va a llegar al admin.
export const ORDEN_PRUEBAS = ["geolocalizacion", "llamadas", "mensajes", "foto_siniestro", "foto_lugar", "fotos"] as const;
export const ORDEN_DOCUMENTACION = ["registro_conducir", "dni", "cedula_vehiculo", "denuncia", "ampliacion", "desiste", "otro"] as const;
export const ORDEN_CATEGORIAS_EVIDENCIA = [...ORDEN_PRUEBAS, ...ORDEN_DOCUMENTACION] as const;
