import { badge, badgeDot } from "@/lib/ui";

const ESTILOS: Record<string, string> = {
  ingresado: "bg-line text-slate",
  en_gestion: "bg-amber/15 text-amber",
  inspeccionado: "bg-amber/15 text-amber",
  elevado: "bg-ink/10 text-ink",
  facturado: "bg-ok/15 text-ok",
  cerrado: "bg-ok/15 text-ok",
};

const ETIQUETAS: Record<string, string> = {
  ingresado: "Ingresado",
  en_gestion: "En gestión",
  inspeccionado: "Inspeccionado",
  elevado: "Elevado",
  facturado: "Facturado",
  cerrado: "Cerrado",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const cls = ESTILOS[estado] ?? "bg-line text-slate";
  return (
    <span className={`${badge} ${cls}`}>
      <span className={badgeDot} />
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
