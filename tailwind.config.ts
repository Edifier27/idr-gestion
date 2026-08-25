import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
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
