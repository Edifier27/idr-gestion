// Puntito rojo que "titila" (efecto ping clásico: un anillo que se expande
// y se desvanece, sobre un punto fijo) — para marcar visualmente lo urgente
// sin depender de texto. Se usa en la pestaña "Hoy" y en los avisos más
// críticos del tablero.
export function PuntoUrgente({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 shrink-0 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fraude opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fraude" />
    </span>
  );
}
