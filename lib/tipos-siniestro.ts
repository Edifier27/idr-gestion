// Tipos de siniestro que maneja ATM, con la sigla que usa Dario en las
// planillas. En la base se guarda el nombre completo (campo "tipo"); la sigla
// sirve para reconocerlo cuando viene abreviado (ej. "RC" en la planilla).
// Ordenados por rubro, como los numera Dario: 1 choque (RC), 2 incendio
// total o parcial, 3 robo total (auto, moto, camioneta), 4 robo parcial
// (rueda, techo, batería), 5 cristales, 6 destrucción total.
// Son la ÚNICA segmentación de los casos (pedido de Dario, 23-nov-2026).
export const RUBROS = [
  { rubro: 1, nombre: "Choque (RC)", detalle: "Choque · responsabilidad civil", emoji: "💥", color: "#D9480F" },
  { rubro: 2, nombre: "Incendio", detalle: "Incendio total o parcial", emoji: "🔥", color: "#C92A2A" },
  { rubro: 3, nombre: "Robo total", detalle: "Robo total de auto, moto o camioneta", emoji: "🚗", color: "#5F3DC4" },
  { rubro: 4, nombre: "Robo parcial", detalle: "Robo parcial: rueda, techo, batería", emoji: "🛞", color: "#1971C2" },
  { rubro: 5, nombre: "Cristales", detalle: "Rotura de cristales", emoji: "🪟", color: "#0C8599" },
  { rubro: 6, nombre: "Destrucción total", detalle: "Destrucción total (DT)", emoji: "🧱", color: "#495057" },
] as const;

export function datosRubro(rubro: number | null | undefined) {
  return RUBROS.find(r => r.rubro === rubro) ?? null;
}

export const TIPOS_SINIESTRO = [
  { codigo: "RC", nombre: "RESPONSABILIDAD CIVIL", rubro: 1 },
  { codigo: "INCT", nombre: "INCENDIO TOTAL", rubro: 2 },
  { codigo: "INCP", nombre: "INCENDIO PARCIAL", rubro: 2 },
  { codigo: "RT", nombre: "ROBO TOTAL", rubro: 3 },
  { codigo: "RA", nombre: "ROBO APARECIDO", rubro: 3 },
  { codigo: "RP", nombre: "ROBO PARCIAL", rubro: 4 },
  { codigo: "CRISTAL", nombre: "VIDRIO", rubro: 5 },
  { codigo: "DT", nombre: "DESTRUCCION TOTAL", rubro: 6 },
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

// Rubro (1 a 6) de un tipo cargado, también para tipos escritos a mano
// ("INCENDIO", "ROBO DE RUEDA"…). null si no se reconoce.
export function rubroDeTipo(tipo: string | null | undefined): number | null {
  if (!tipo) return null;
  const t = limpiar(tipo);
  const hit = TIPOS_SINIESTRO.find(x => x.nombre === t || x.codigo === t);
  if (hit) return hit.rubro;
  if (t.includes("RESPONSABILIDAD") || t.includes("CHOQUE")) return 1;
  if (t.includes("INCENDIO")) return 2;
  if (t.includes("ROBO TOTAL") || t.includes("APARECIDO")) return 3;
  if (t.includes("ROBO PARCIAL") || t.includes("RUEDA") || t.includes("TECHO") || t.includes("BATERIA")) return 4;
  if (t.includes("CRISTAL") || t.includes("VIDRIO")) return 5;
  if (t.includes("DESTRUCCION")) return 6;
  return null;
}

export function etiquetaRubro(rubro: number | null): string {
  const r = RUBROS.find(x => x.rubro === rubro);
  return r ? `${r.rubro} · ${r.nombre}` : "Sin rubro";
}
