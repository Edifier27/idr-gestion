// Junta los últimos errores de JavaScript que vio la pantalla, para
// adjuntarlos cuando un admin reporta un problema (son la pista principal
// para encontrar el bug). Solo en el navegador; se instala una vez.
export type ErrorNavegador = { mensaje: string; donde?: string; cuando: string };

const MAX = 10;
const errores: ErrorNavegador[] = [];
let instalado = false;

function anotar(mensaje: string, donde?: string) {
  errores.push({ mensaje: mensaje.slice(0, 500), donde, cuando: new Date().toISOString() });
  if (errores.length > MAX) errores.shift();
}

export function instalarCapturaErrores() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  window.addEventListener("error", e => anotar(e.message || String(e.error), e.filename ? `${e.filename}:${e.lineno}` : undefined));
  window.addEventListener("unhandledrejection", e => {
    const r = e.reason;
    anotar(r instanceof Error ? `${r.name}: ${r.message}` : String(r));
  });
}

export function erroresRecientes(): ErrorNavegador[] {
  return [...errores];
}
