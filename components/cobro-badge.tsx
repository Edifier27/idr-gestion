import { badge, badgeDot } from "@/lib/ui";

const ESTILOS: Record<string,string> = {
  no_facturado: "bg-line text-slate",
  facturado: "bg-amber/15 text-amber",
  presentado: "bg-ink/10 text-ink",
  cobrado: "bg-ok/15 text-ok",
  rechazado: "bg-fraude/15 text-fraude",
};
const LABELS: Record<string,string> = {
  no_facturado: "Sin facturar",
  facturado: "Facturado",
  presentado: "Presentado",
  cobrado: "Cobrado",
  rechazado: "Rechazado",
};
export function CobroBadge({ estado }: { estado: string | null }) {
  const k = estado ?? "no_facturado";
  return (
    <span className={`${badge} ${ESTILOS[k] ?? "bg-line text-slate"}`}>
      <span className={badgeDot} />
      {LABELS[k] ?? k}
    </span>
  );
}
