const ESTILOS: Record<string, string> = {
  pendiente: "bg-line text-slate",
  sin_fraude: "bg-ok/15 text-ok",
  con_fraude: "bg-fraude/15 text-fraude",
  posible_fraude: "bg-amber/15 text-amber",
  desistido: "bg-ink/10 text-ink",
  sin_cobertura: "bg-ink/10 text-ink",
};

const ETIQUETAS: Record<string, string> = {
  pendiente: "Pendiente",
  sin_fraude: "Sin fraude",
  con_fraude: "Fraude",
  posible_fraude: "Posible fraude",
  desistido: "Desistido",
  sin_cobertura: "Sin cobertura",
};

export function ResultadoBadge({ resultado }: { resultado: string }) {
  const cls = ESTILOS[resultado] ?? "bg-line text-slate";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {ETIQUETAS[resultado] ?? resultado}
    </span>
  );
}
