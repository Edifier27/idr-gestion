// Categorías de evidencia, compartidas entre el selector de subida
// (components/evidencia-panel.tsx), la clasificación automática por IA
// (lib/clasificar-evidencia.ts) y el armado del expediente en PDF
// (lib/pdf.ts) — una sola fuente de verdad para los value/label.
// Los value viejos no se cambian (hay archivos ya guardados con ellos);
// algunos cambiaron de nombre visible para seguir el orden que pidió Dario.
export const CATEGORIAS_EVIDENCIA = [
  { value: "denuncia", label: "Denuncia policial / administrativa" },
  { value: "ampliacion", label: "Ampliación del asegurado" },
  { value: "foto_lugar", label: "Domicilio / lugar del hecho (fotos)" },
  { value: "foto_siniestro", label: "Inspección del vehículo" },
  { value: "dni", label: "DNI asegurado" },
  { value: "dni_conductor", label: "DNI conductor" },
  { value: "registro_conducir", label: "Registro de conducir" },
  { value: "cedula_vehiculo", label: "Cédula del vehículo" },
  { value: "geolocalizacion", label: "Geolocalización" },
  { value: "llamadas", label: "Registro de llamadas" },
  { value: "mensajes", label: "Conversaciones del hecho" },
  { value: "palabras_clave", label: "Filtro de palabras clave (WhatsApp)" },
  { value: "foto_momento", label: "Fotos del momento del hecho" },
  { value: "foto_previa", label: "Foto previa del vehículo" },
  { value: "llave", label: "Llaves del vehículo" },
  { value: "vtv", label: "VTV" },
  { value: "recibo_sueldo", label: "Recibo de sueldo" },
  { value: "desiste", label: "Desistimiento firmado" },
  { value: "fotos", label: "Otras fotos" },
  { value: "otro", label: "Otro" },
] as const;

export function etiquetaCategoriaEvidencia(cat?: string | null, ramo?: Ramo | null): string {
  if (!cat) return "Sin categoría";
  // En choques las conversaciones son "entre las partes", no "del hecho".
  if (cat === "mensajes" && ramo === "rc") return "Conversación entre las partes";
  return CATEGORIAS_EVIDENCIA.find(c => c.value === cat)?.label ?? cat;
}

// Ramos (rubros) según el tipo de siniestro, como los agrupa Dario:
// 1 choque (RC), 2 incendio total o parcial, 3 robo total (auto, moto,
// camioneta), 4 robo parcial (rueda, techo, batería…), 5 cristales, 6 DT.
export type Ramo = "rc" | "incendio" | "rt" | "rp" | "cristal" | "dt";

export function ramoDeTipo(tipo?: string | null): Ramo | null {
  const t = (tipo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (!t) return null;
  if (t.includes("RESPONSABILIDAD") || t.includes("CHOQUE") || t === "RC") return "rc";
  if (t.includes("INCENDIO")) return "incendio";
  if (t.includes("ROBO TOTAL") || t.includes("ROBO APARECIDO") || t === "RT" || t === "RA") return "rt";
  if (t.includes("ROBO PARCIAL") || t.includes("RUEDA") || t === "RP") return "rp";
  if (t.includes("VIDRIO") || t.includes("CRISTAL")) return "cristal";
  if (t.includes("DESTRUCCION") || t === "DT") return "dt";
  return null;
}

// Pruebas digitales que corresponden a cada ramo, en el orden en que van en
// el expediente (planilla de Dario, 23-nov-2026). DT no vino especificado:
// es un choque con pérdida total, va como choque.
const DIGITALES: Record<Ramo, string[]> = {
  rt: ["geolocalizacion", "llamadas", "mensajes", "palabras_clave", "foto_previa", "llave", "vtv", "recibo_sueldo"],
  rp: ["geolocalizacion", "llamadas", "mensajes", "palabras_clave", "foto_momento"],
  cristal: ["geolocalizacion", "llamadas", "mensajes", "palabras_clave", "foto_momento"],
  rc: ["geolocalizacion", "mensajes", "foto_momento", "foto_previa"],
  dt: ["geolocalizacion", "mensajes", "foto_momento", "foto_previa"],
  incendio: ["geolocalizacion", "llamadas", "mensajes", "palabras_clave", "foto_momento", "vtv"],
};
const DIGITALES_SIN_RAMO = ["geolocalizacion", "llamadas", "mensajes", "palabras_clave", "foto_momento", "foto_previa", "llave", "vtv", "recibo_sueldo"];

export type SeccionExpediente = { id: string; titulo: string; categorias: string[] };

// Orden del expediente: denuncia policial, siniestro, domicilio del
// asegurado, lugar del hecho, inspección del vehículo (todas menos robo
// total), documentación y pruebas digitales según el ramo. Lo que no entra
// en ninguna sección cae en "Otros" para que nunca quede un archivo afuera.
export function seccionesExpediente(ramo: Ramo | null): SeccionExpediente[] {
  const digitales = ramo ? DIGITALES[ramo] : DIGITALES_SIN_RAMO;
  const secciones: SeccionExpediente[] = [
    { id: "denuncia", titulo: "Denuncia policial", categorias: ["denuncia", "ampliacion"] },
    { id: "lugar", titulo: "Domicilio y lugar del hecho", categorias: ["foto_lugar"] },
  ];
  if (ramo !== "rt") secciones.push({ id: "inspeccion", titulo: "Inspección del vehículo", categorias: ["foto_siniestro"] });
  secciones.push(
    { id: "documentacion", titulo: "Documentación del asegurado", categorias: ["dni", "dni_conductor", "registro_conducir", "cedula_vehiculo"] },
    { id: "digitales", titulo: "Pruebas digitales", categorias: digitales },
  );
  const usadas = new Set(secciones.flatMap(s => s.categorias));
  const resto = CATEGORIAS_EVIDENCIA.map(c => c.value as string).filter(v => !usadas.has(v));
  secciones.push({ id: "otros", titulo: "Otros", categorias: resto });
  return secciones;
}

// Orden plano de categorías para un ramo (vista agrupada del panel de
// evidencia = mismo orden que el PDF).
export function ordenCategorias(ramo: Ramo | null): string[] {
  return seccionesExpediente(ramo).flatMap(s => s.categorias);
}
