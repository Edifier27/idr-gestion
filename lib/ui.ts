// Clases compartidas para look & feel consistente en todo el CRM: botones,
// inputs y tarjetas con la misma tipografía, radios y sombras. Evita que cada
// componente reinvente su propio padding/rounded a mano.
// active:scale-[0.97] en los tres: un "aplastado" breve al click para que se
// sienta táctil, no solo un cambio de color — mismo lenguaje que apps nativas
// pro (Linear, Vercel). focus-visible con anillo propio (no depende del
// outline del navegador) para que la navegación por teclado también se vea
// prolija.
export const boton = {
  primario:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-paper shadow-sm transition duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
  secundario:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition duration-150 hover:border-ink/30 hover:bg-paper active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate transition duration-150 hover:bg-line/60 hover:text-ink active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
  // Verde: para la acción que cierra/confirma algo de punta a punta (ej.
  // "Enviar informe" en el carrusel del operador) — se distingue a propósito
  // del primario (negro, para acciones normales) para que quede claro de un
  // vistazo que esta es LA acción final, no una más.
  exito:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-ok px-3.5 py-2 text-sm font-semibold text-paper shadow-sm transition duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
};

export const campo =
  "rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm transition focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10";

// Select nativo con el mismo lenguaje visual que campo, pero sin la flechita
// de fábrica del navegador/SO (appearance-none) — se usa siempre envuelto en
// <SelectShell> (components/select-shell.tsx), que dibuja una flechita
// propia encima, consistente en todos lados.
// Sin ancho fijo a propósito (cada uso decide si es w-full o de ancho
// automático) — así no queda un w-full peleando por especificidad con un
// ancho puntual pasado aparte.
export const selectCampo =
  "cursor-pointer appearance-none rounded-md border border-line bg-white py-1.5 pl-3 pr-8 text-sm text-ink shadow-sm transition hover:border-ink/30 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-50";

export const tarjeta = "rounded-lg border border-line bg-white shadow-sm";

// Tarjeta con más presencia (borde superior de color + sombra al hover), para
// destacar bloques clave (stats del tablero, cabecera de un caso).
export const tarjetaElevada =
  "rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md";

// Variante de tarjetaElevada para lo que es genuinamente clickeable de punta
// a punta (abrir un caso, aplicar un filtro tocando la tarjeta entera): suma
// un levantamiento sutil al pasar el mouse y un "aplastado" breve al click,
// para que se sienta una acción táctil y no solo una caja con sombra. No usar
// en bloques de contenido estático (ahí, tarjetaElevada solo) — el
// levantamiento implica "esto se puede tocar".
export const tarjetaClickeable =
  "rounded-xl border border-line bg-white shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm";

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
  rechazo: "bg-fraude",
  sin_cobertura: "bg-ink",
};

// Cinta lateral de color en las listas de tarjetas (compañía, operador,
// usuario…): mismo texto siempre da el mismo color, así una entidad nueva
// se distingue sola sin tener que mantener una paleta a mano.
export function colorPorTexto(texto: string): string {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 34%)`;
}

// Cinta vertical reusable: bloque de color angosto con el texto rotado, a la
// izquierda de una tarjeta de lista (fila de caso, operador, usuario…). No
// incluye ancho/padding/tamaño de texto (varían según la tarjeta) para no
// pisar esas utilidades con las del propio uso — cada lugar las suma aparte.
// Sin el rotate-180 extra: así el texto se lee de arriba hacia abajo (Dario
// reportó que con la vuelta de más las letras se veían "dadas vuelta").
// Sin overflow-hidden a propósito: con nombres largos (ATM SEGUROS,
// operadores de 5-6 letras) en filas cortas (ej. la lista de Usuarios), el
// texto vertical no entraba en la altura disponible y el overflow-hidden le
// cortaba la primera letra (Dario reportó "NACHO" viéndose como "IACHO").
// Al sacarlo, si el texto no entra la fila entera crece para que quepa
// (comportamiento normal de flexbox) en vez de recortar contenido.
export const cinta = "flex shrink-0 items-center justify-center font-bold uppercase tracking-wide text-white";
export const cintaTexto = "[writing-mode:vertical-rl] whitespace-nowrap";
