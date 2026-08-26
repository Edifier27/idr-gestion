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
