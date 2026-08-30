// Envoltorio puramente visual para un <select> nativo: dibuja una flechita
// propia encima (el select real va adentro con appearance-none, que le saca
// la de fábrica del navegador/SO) para que se vea igual en todos lados en
// vez del desplegable "normal" por defecto — y la flechita gira al enfocar
// el select, mismo lenguaje que el resto de los toggles del CRM. No es un
// componente de estado: el <select> hijo mantiene su propio value/onChange
// sin cambios, esto solo lo decora.
export function SelectShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`group/select relative inline-block ${className}`}>
      {children}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate transition-transform duration-150 group-focus-within/select:rotate-180"
      >
        <path d="M5.5 8L10 12.5L14.5 8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
