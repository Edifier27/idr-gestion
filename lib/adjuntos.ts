// Gmail no siempre marca los PDF como "application/pdf": según quién lo
// manda (o si es un reenvío) llegan como "application/octet-stream" o
// "application/x-pdf". Se reconocen también por la extensión del nombre.
export function esPdf(adjunto: { tipo: string; nombre: string }): boolean {
  return adjunto.tipo.toLowerCase().includes("pdf") || adjunto.nombre.toLowerCase().endsWith(".pdf");
}
