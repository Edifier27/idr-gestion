import { badge, badgeDot } from "@/lib/ui";
import { etiquetaEtapaContacto, plazoInforme } from "@/lib/etapa-contacto";

const ESTILOS: Record<string, string> = {
  contacto_fallido: "bg-fraude/15 text-fraude",
  contactado: "bg-ok/15 text-ok",
  entrevista_pactada: "bg-amber/15 text-amber",
  informe_enviado: "bg-ok/15 text-ok",
};

// Variante "hero": pill sólida para mostrar sobre el fondo azul de la
// cabecera del caso — un tintado translúcido (bg-amber/15) prácticamente
// desaparece sobre un fondo oscuro, así que acá usa colores sólidos.
const ESTILOS_HERO: Record<string, string> = {
  contacto_fallido: "bg-fraude text-white",
  contactado: "bg-ok text-white",
  entrevista_pactada: "bg-amarillo text-ink",
  informe_enviado: "bg-ok text-white",
};

// No se muestra si no hay etapa cargada (caso recién ingresado, sin
// distinción que aportar todavía). Si la entrevista está vencida/por vencer,
// el color pisa el de la etapa para que la urgencia se note primero.
export function EtapaContactoBadge({ etapaContacto, fechaEntrevista, variante = "pill" }: {
  etapaContacto: string | null;
  fechaEntrevista?: string | Date | null;
  variante?: "pill" | "hero";
}) {
  if (!etapaContacto) return null;
  const plazo = plazoInforme(etapaContacto, fechaEntrevista);
  const mapa = variante === "hero" ? ESTILOS_HERO : ESTILOS;
  const cls = plazo === "vencido" ? (variante === "hero" ? "bg-fraude text-white" : "bg-fraude/15 text-fraude")
    : plazo === "atencion" ? (variante === "hero" ? "bg-amarillo text-ink" : "bg-amber/15 text-amber")
    : mapa[etapaContacto] ?? (variante === "hero" ? "bg-white/20 text-white" : "bg-line text-slate");
  return (
    <span className={`${badge} ${cls}`}>
      <span className={badgeDot} />
      {plazo === "vencido" ? "Informe vencido" : plazo === "atencion" ? "Informe por vencer" : etiquetaEtapaContacto(etapaContacto)}
    </span>
  );
}
