// Tipos de siniestro que maneja ATM, con la sigla que usa Dario en las
// planillas. En la base se guarda el nombre completo (campo "tipo"); la sigla
// sirve para reconocerlo cuando viene abreviado (ej. "RC" en la planilla).
export const TIPOS_SINIESTRO = [
  { codigo: "RT", nombre: "ROBO TOTAL" },
  { codigo: "RP", nombre: "ROBO PARCIAL" },
  { codigo: "RA", nombre: "ROBO APARECIDO" },
  { codigo: "DT", nombre: "DESTRUCCION TOTAL" },
  { codigo: "RC", nombre: "RESPONSABILIDAD CIVIL" },
  { codigo: "INCT", nombre: "INCENDIO TOTAL" },
  { codigo: "INCP", nombre: "INCENDIO PARCIAL" },
  { codigo: "CRISTAL", nombre: "VIDRIO" },
] as const;

function limpiar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

// Sigla o nombre (con o sin tildes) -> nombre del catálogo. Si no coincide
// con ninguno, devuelve el texto tal cual vino (en mayúsculas), para no
// perder el dato.
export function normalizarTipo(texto: string | null | undefined): string | null {
  if (!texto || !texto.trim()) return null;
  const t = limpiar(texto);
  const hit = TIPOS_SINIESTRO.find(x => x.codigo === t || x.nombre === t);
  return hit ? hit.nombre : t;
}

export function siglaTipo(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  return TIPOS_SINIESTRO.find(x => x.nombre === nombre)?.codigo ?? null;
}
