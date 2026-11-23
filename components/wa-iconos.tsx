// Íconos de la bandeja de WhatsApp de CRMgestion, dibujados como los de
// WhatsApp Web (trazo fino, color heredado) en lugar de emojis.
type P = { size?: number; className?: string };
const base = (size = 24) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });

export const IconoEmoji = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><circle cx="9" cy="10" r="0.9" fill="currentColor" /><circle cx="15" cy="10" r="0.9" fill="currentColor" /></svg>
);
export const IconoMas = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
export const IconoEnviar = ({ size, className }: P) => (
  <svg {...base(size ?? 22)} className={className} fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" /></svg>
);
export const IconoBuscar = ({ size, className }: P) => (
  <svg {...base(size ?? 20)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
export const IconoVolver = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const IconoCerrar = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconoCasos = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /><path d="M8 13h8M8 16h5" strokeLinecap="round" /></svg>
);
export const IconoRayo = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg>
);
export const IconoAbajo = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
);
export const IconoIzq = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
);
export const IconoDer = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
);
export const IconoDescargar = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
);
export const IconoBandeja = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3.5 13.5L6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><path d="M3.5 13.5h5l1 2h5l1-2h5" /></svg>
);
export const IconoChats = ({ size, className }: P) => (
  <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 18.5l1.2-3.4A7.5 7.5 0 1 1 8.6 18.6z" /></svg>
);
// Íconos del menú de adjuntar (sobre círculos de color, como WhatsApp)
export const IconoDocumento = ({ size, className }: P) => (
  <svg {...base(size ?? 20)} className={className} fill="currentColor"><path d="M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8zm0 1.9L18.1 8H15a1 1 0 0 1-1-1zM8 13h8v1.6H8zm0 3.4h6V18H8z" /></svg>
);
export const IconoFotos = ({ size, className }: P) => (
  <svg {...base(size ?? 20)} className={className} fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1 15H6l3.5-4.5 2.5 3 3.5-4.5zM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" /></svg>
);
export const IconoCamara = ({ size, className }: P) => (
  <svg {...base(size ?? 20)} className={className} fill="currentColor"><path d="M9 3L7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 14.5A4.5 4.5 0 1 1 12 8.5a4.5 4.5 0 0 1 0 9zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg>
);
export const IconoRapidas = ({ size, className }: P) => (
  <svg {...base(size ?? 20)} className={className} fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
);
