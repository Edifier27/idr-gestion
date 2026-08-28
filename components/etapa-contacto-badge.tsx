import { badge, badgeDot } from "@/lib/ui";
import { etiquetaEtapaContacto, plazoInforme } from "@/lib/etapa-contacto";

const ESTILOS: Record<string, string> = {
  contacto_fallido: "bg-fraude/15 text-fraude",
  contactado: "bg-ok/15 text-ok",
  entrevista_pactada: "bg-amber/15 text-amber",
  informe_enviado: "bg-ok/15 text-ok",
};

// No se muestra si no hay etapa cargada (caso recién ingresado, sin
// distinción que aportar todavía). Si la entrevista está vencida/por vencer,
// el color pisa el de la etapa para que la urgencia se note primero.
export function EtapaContactoBadge({ etapaContacto, fechaEntrevista }: {
  etapaContacto: string | null;
  fechaEntrevista?: string | Date | null;
}) {
  if (!etapaContacto) return null;
  const plazo = plazoInforme(etapaContacto, fechaEntrevista);
  const cls = plazo === "vencido" ? "bg-fraude/15 text-fraude"
    : plazo === "atencion" ? "bg-amber/15 text-amber"
    : ESTILOS[etapaContacto] ?? "bg-line text-slate";
  return (
    <span className={`${badge} ${cls}`}>
      <span className={badgeDot} />
      {plazo === "vencido" ? "Informe vencido" : plazo === "atencion" ? "Informe por vencer" : etiquetaEtapaContacto(etapaContacto)}
    </span>
  );
}
