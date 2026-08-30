import type { Config } from "tailwindcss";

const config: Config = {
  // "./lib/**" también: lib/ui.ts define clases de Tailwind como strings
  // (incluida la de texto vertical, [writing-mode:vertical-rl]) que no
  // aparecen literalmente en ningún archivo de app/ ni components/ — solo
  // se usan ahí por referencia al import. Sin este glob, el scanner nunca
  // las veía y esas clases nunca se compilaban al CSS final (bug de raíz
  // detrás de que la cinta vertical de compañía/operador jamás se vio
  // realmente vertical, por más que "cintaTexto" se haya reescrito varias
  // veces creyendo que el problema era otro).
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141b2e",       // navy profundo (seriedad legal/seguros)
        slate: "#3a4358",
        paper: "#f6f5f1",     // fondo papel expediente
        line: "#e2e0d8",
        amber: "#c9902e",     // acento: "acción requerida"
        fraude: "#b23a3a",    // rojo dictamen fraude
        ok: "#2f7d5b",        // verde facturado / sin fraude
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
