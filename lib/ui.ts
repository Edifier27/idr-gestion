// Clases compartidas para look & feel consistente en todo el CRM: botones,
// inputs y tarjetas con la misma tipografía, radios y sombras. Evita que cada
// componente reinvente su propio padding/rounded a mano.
export const boton = {
  primario:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-paper shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secundario:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-ink/30 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate transition hover:bg-line/60 hover:text-ink",
};

export const campo =
  "rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm transition focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10";

export const tarjeta = "rounded-lg border border-line bg-white shadow-sm";

// Tarjeta con más presencia (borde superior de color + sombra al hover), para
// destacar bloques clave (stats del tablero, cabecera de un caso).
export const tarjetaElevada =
  "rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md";

// Pill de estado con puntito de color (bg-current toma el color del texto),
// mismo patrón que Linear/Vercel para "status".
export const badge = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";
export const badgeDot = "h-1.5 w-1.5 shrink-0 rounded-full bg-current";

// Franja de color por resultado del caso — misma paleta que la clasificación
// del expediente PDF (lib/pdf.ts), para que el estado se vea de un vistazo.
export const RESULTADO_ACENTO: Record<string, string> = {
  pendiente: "bg-slate",
  sin_fraude: "bg-ok",
  con_fraude: "bg-fraude",
  posible_fraude: "bg-amber",
  desistido: "bg-ink",
  sin_cobertura: "bg-ink",
};
