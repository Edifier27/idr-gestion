// Categorías de evidencia, compartidas entre el selector de subida
// (components/evidencia-panel.tsx) y el armado del expediente en PDF
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
  { value: "fotos", label: "Fotos" },
  { value: "otro", label: "Otro" },
] as const;

export function etiquetaCategoriaEvidencia(cat?: string | null): string {
  if (!cat) return "Sin categoría";
  return CATEGORIAS_EVIDENCIA.find(c => c.value === cat)?.label ?? cat;
}
