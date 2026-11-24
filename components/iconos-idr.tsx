import type { CSSProperties, ReactNode } from "react";

// Iconos propios de IDR / CRMgestion, dibujados para el sistema (no son los
// emojis del teléfono). Criterios de diseño:
// - grilla de 24 × 24 con 2 de aire, trazo de 1,7 con puntas y uniones redondas;
// - estilo "duotono": el contorno en el color del texto y un relleno suave
//   (16 % del mismo color) que le da cuerpo sin ensuciar;
// - siluetas simples y reconocibles a 16 px, con un detalle que las distingue
//   (el rayo del choque, la línea punteada del robo total, la grieta del cristal…).
// Uso: <Icono n="denuncia" />, <Icono n="incendio" size={20} />, o en mosaico
// de color con <IconoMosaico n="choque" color="#D9480F" />.

const R = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;

// Auto visto de costado (base de varios iconos de rubro).
const AUTO = "M3 16.5V13a2 2 0 0 1 1.2-1.8L6 10.4l1.8-3.3A2 2 0 0 1 9.6 6h4.9a2 2 0 0 1 1.6.8l2.7 3.6 1.6.6a2 2 0 0 1 1.3 1.9v3.6";
const AUTO_RELLENO = `${AUTO}V17H3Z`;
const Ruedas = () => <><circle cx="6.8" cy="17" r="1.9" /><circle cx="17.2" cy="17" r="1.9" /><path d="M8.7 17h6.6" /></>;

const DIBUJOS: Record<string, ReactNode> = {
  // ——— Rubros ———
  choque: <>
    <path {...R} d={AUTO_RELLENO} transform="translate(-1 1)" />
    <g transform="translate(-1 1)"><path d={AUTO} /><Ruedas /><path d="M7 10.4h11.6" /></g>
    <path d="M21.5 3.5l-1.6 2.2M23 7.5l-2.5.3M18 2.5l-.2 2.5" />
  </>,
  incendio: <>
    <path {...R} d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.2-2-5.3-3.4-7.1-.5 1.6-1.4 2.6-2.6 3C12.9 7.5 11.6 4.6 9 3c.2 2.9-1.4 4.6-2.7 6.3a8 8 0 0 0-.8 5.4C5.5 18.4 8.1 21 12 21Z" />
    <path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.2-2-5.3-3.4-7.1-.5 1.6-1.4 2.6-2.6 3C12.9 7.5 11.6 4.6 9 3c.2 2.9-1.4 4.6-2.7 6.3A8 8 0 0 0 5.5 14.7C5.5 18.4 8.1 21 12 21Z" />
    <path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.8 1.4-2.7 2.1-4 .9 1 3.5 2.2 3.5 4 0 1.6-1.1 2.8-2.8 2.8Z" />
  </>,
  robo_total: <>
    <g transform="translate(1.2 0)"><path d={AUTO} strokeDasharray="2.2 2.2" /><circle cx="6.8" cy="17" r="1.9" strokeDasharray="2 1.6" /><circle cx="17.2" cy="17" r="1.9" strokeDasharray="2 1.6" /></g>
    <path d="M1 11h3M2 14h2.5M1.5 8h2" />
  </>,
  robo_parcial: <>
    <circle {...R} cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.5" />
    <path d="M12 6.8v3.7M12 13.5v3.7M7 12h3.5M13.5 12H17" />
  </>,
  cristales: <>
    <path {...R} d="M4 8.5C6.5 7 9.2 6.3 12 6.3s5.5.7 8 2.2l-1.6 8.3a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2Z" />
    <path d="M4 8.5C6.5 7 9.2 6.3 12 6.3s5.5.7 8 2.2l-1.6 8.3a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2Z" />
    <path d="M12.6 8.6l-1.7 2.7 2.3 1.4-1.9 3.4M11.6 11.6l-2.4.6M13.2 12.7l2.4-.2" />
  </>,
  destruccion: <>
    <path {...R} d="M3 17v-3.6l2.9-1.4 1.5-3.5 2.4 1.7 2-2.6 2 2.2 2.4-1.3 2.2 3.7 2.4.7c.6.2 1.1.8 1.1 1.4V17Z" />
    <path d="M3 16.5v-3.1l2.9-1.4 1.5-3.5 2.4 1.7 2-2.6 2 2.2 2.4-1.3 2.2 3.7 2.4.7c.6.2 1.1.8 1.1 1.4v2.2" />
    <circle cx="6.8" cy="17.3" r="1.9" /><ellipse cx="17.4" cy="17.6" rx="1.5" ry="1.9" transform="rotate(-20 17.4 17.6)" /><path d="M8.7 17.3h7.1" />
    <path d="M9 3.5c.8.7.8 1.6 0 2.3M12.5 3c.8.7.8 1.6 0 2.3" />
  </>,

  // ——— Evidencia ———
  denuncia: <>
    <path {...R} d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" />
    <path d="M12 10l2.8 1.1v2.1c0 1.8-1.2 3-2.8 3.6-1.6-.6-2.8-1.8-2.8-3.6v-2.1Z" />
  </>,
  ampliacion: <>
    <path {...R} d="M6 3h7l4 4v4.5L11.3 17l-.6 3H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M17 10V7l-4-4H6a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h4" /><path d="M13 3v4h4M8 9h4M8 12h5" />
    <path d="M13.2 20.5l.6-2.7 6-6a1.4 1.4 0 0 1 2 2l-6 6Z" />
  </>,
  lugar: <>
    <path {...R} d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" />
    <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.4" />
  </>,
  inspeccion: <>
    <circle {...R} cx="10.5" cy="10.5" r="6.5" />
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3L21 21" />
    <path d="M6.8 12.2v-1.3l1-.5.9-1.6h3.3l1.2 1.6.8.4v1.4M8.5 12.2h4" />
  </>,
  dni: <>
    <rect {...R} x="2.5" y="5" width="19" height="14" rx="2.2" />
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" /><circle cx="8.5" cy="10.6" r="1.9" />
    <path d="M5.6 15.6c.4-1.5 1.6-2.4 2.9-2.4s2.5.9 2.9 2.4M14 10h4.5M14 13h3.5" />
  </>,
  dni_conductor: <>
    <rect {...R} x="2.5" y="5" width="19" height="14" rx="2.2" />
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" /><circle cx="8.5" cy="12" r="3" /><circle cx="8.5" cy="12" r=".7" />
    <path d="M5.6 11.3h5.8M8.5 12.7V15M14 10h4.5M14 13h3.5" />
  </>,
  registro: <>
    <rect {...R} x="2.5" y="5" width="19" height="14" rx="2.2" />
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M2.5 9h19M6 12.5h5M6 15.3h3.5" />
    <path d="M13.5 16v-1.4l.9-.4.9-1.7h2.6l1.1 1.6.6.3V16M14.5 16h4" />
  </>,
  cedula: <>
    <rect {...R} x="2.5" y="5" width="19" height="14" rx="2.2" />
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M6 10h5M6 13h4M6 16h5.5" />
    <rect x="14" y="9.5" width="4.5" height="4.5" rx=".6" /><path d="M15.8 11.4h.9M14 16.5h4.5" />
  </>,
  geo: <>
    <path {...R} d="M3 6.5l5.5-2.5 7 2.5 5.5-2.5v13.5l-5.5 2.5-7-2.5L3 20Z" />
    <path d="M3 6.5l5.5-2.5 7 2.5 5.5-2.5v13.5l-5.5 2.5-7-2.5L3 20Z" /><path d="M8.5 4v13.5M15.5 6.5V20" />
  </>,
  llamadas: <>
    <path {...R} d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
    <path d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
    <path d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.5 2.5 0 0 1 2 2" />
  </>,
  mensajes: <>
    <path {...R} d="M4 4.5h11A1.5 1.5 0 0 1 16.5 6v6.5A1.5 1.5 0 0 1 15 14H9l-3.5 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" />
    <path d="M4 4.5h11A1.5 1.5 0 0 1 16.5 6v6.5A1.5 1.5 0 0 1 15 14H9l-3.5 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" />
    <path d="M19 9h1A1.5 1.5 0 0 1 21.5 10.5V17a1.5 1.5 0 0 1-1.5 1.5h-1v2.5L16 18.5h-4.5A1.5 1.5 0 0 1 10 17v-.5" />
  </>,
  palabras: <>
    <circle {...R} cx="10.5" cy="10.5" r="6.5" />
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3L21 21M7.6 9h5.8M7.6 12h3.8" />
  </>,
  camara: <>
    <path {...R} d="M4 7.5h3L8.6 5h6.8L17 7.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
    <path d="M4 7.5h3L8.6 5h6.8L17 7.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.4" /><path d="M17.8 10.2h.1" />
  </>,
  foto_previa: <>
    <rect {...R} x="2.5" y="5" width="15" height="14" rx="2" />
    <path d="M17.5 12.5V7a2 2 0 0 0-2-2h-11a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" /><path d="M2.8 16l4.4-4.4 3.3 3.3 1.6-1.6" />
    <circle cx="17.5" cy="17" r="4" /><path d="M17.5 15v2.2l1.4.9" />
  </>,
  llave: <>
    <circle {...R} cx="8" cy="15" r="4.6" />
    <circle cx="8" cy="15" r="4.6" /><circle cx="8" cy="15" r="1.3" /><path d="M11.3 11.7L19.5 3.5M16 7l2.3 2.3M13.8 9.2l1.8 1.8" />
  </>,
  vtv: <>
    <circle {...R} cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6.6" strokeDasharray="1.4 1.6" /><path d="M8.8 12.3l2.2 2.2 4.3-4.6" />
  </>,
  recibo: <>
    <path {...R} d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21Z" />
    <path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21Z" /><path d="M9 7.5h6M9 11h6M9 14.5h3.5" />
  </>,
  firma: <>
    <path {...R} d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 9h4" />
    <path d="M8.5 16.5c1-1.8 2-2.6 2.6-1.6.5.9-.6 2.4.4 2.3.8 0 1.4-1.4 2.2-1.4.6 0 .7.8 1.6.8" />
  </>,
  fotos: <>
    <rect {...R} x="5.5" y="3" width="15.5" height="13" rx="2" />
    <rect x="5.5" y="3" width="15.5" height="13" rx="2" /><path d="M3 7.5v10.5a2 2 0 0 0 2 2h12.5" />
    <path d="M5.8 13.5l4-4 3 3 2-2 5.7 5.5" /><circle cx="16.3" cy="7" r="1.3" />
  </>,
  documento: <>
    <path {...R} d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 11h6M9 14h6M9 17h3.5" />
  </>,

  // ——— Interfaz ———
  carpeta: <>
    <path {...R} d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2h8.8A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2h8.8A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" /><path d="M3 11h18" />
  </>,
  clip: <path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3" />,
  casa: <>
    <path {...R} d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
    <path d="M3 11.3L12 4l9 7.3M5 9.8V19a1 1 0 0 0 1 1h3.5v-5.5h5V20H18a1 1 0 0 0 1-1V9.8" />
  </>,
  calendario: <>
    <rect {...R} x="3" y="5" width="18" height="16" rx="2.2" />
    <rect x="3" y="5" width="18" height="16" rx="2.2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.3h2M11 17.3h2" />
  </>,
  reloj: <>
    <circle {...R} cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5.3l3.3 2" />
  </>,
  alerta: <>
    <path {...R} d="M10.3 4.3a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3Z" />
    <path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3Z" /><path d="M12 9.5v4M12 16.8h.01" />
  </>,
  ok: <>
    <circle {...R} cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7L16 9.5" />
  </>,
  bandera: <>
    <path {...R} d="M5 4h11.5l-2.2 4 2.2 4H5Z" />
    <path d="M5 21V4h11.5l-2.2 4 2.2 4H5" />
  </>,
  urgente: <>
    <path {...R} d="M13 2.5L5 13.5h6L10 21.5l8-11h-6Z" />
    <path d="M13 2.5L5 13.5h6L10 21.5l8-11h-6Z" />
  </>,
  ia: <>
    <path {...R} d="M10 3.5l1.6 4.4a2 2 0 0 0 1.2 1.2L17.2 11l-4.4 1.6a2 2 0 0 0-1.2 1.2L10 18.2l-1.6-4.4a2 2 0 0 0-1.2-1.2L2.8 11l4.4-1.6a2 2 0 0 0 1.2-1.2Z" />
    <path d="M10 3.5l1.6 4.4a2 2 0 0 0 1.2 1.2L17.2 11l-4.4 1.6a2 2 0 0 0-1.2 1.2L10 18.2l-1.6-4.4a2 2 0 0 0-1.2-1.2L2.8 11l4.4-1.6a2 2 0 0 0 1.2-1.2Z" />
    <path d="M18.5 2.5v3.5M16.8 4.2h3.5M18.5 16.5v4M16.5 18.5h4" />
  </>,
  perito: <>
    <circle {...R} cx="10" cy="13" r="5.5" />
    <path d="M3.5 7.5h13M6 7.5l1-4h6l1 4" /><circle cx="10" cy="13" r="5.5" /><path d="M14 17l5.5 4" /><path d="M8 12.2a2.5 2.5 0 0 1 2-1.7" />
  </>,
  robot: <>
    <rect {...R} x="4" y="7" width="16" height="12" rx="3" />
    <rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 7V3.8M10.5 3.5h3M2 12v3M22 12v3" />
    <circle cx="9" cy="12.5" r="1.2" /><circle cx="15" cy="12.5" r="1.2" /><path d="M9.5 16h5" />
  </>,
  probeta: <>
    <path {...R} d="M7 14h10l2.6 4.6A1.6 1.6 0 0 1 18.2 21H5.8a1.6 1.6 0 0 1-1.4-2.4Z" />
    <path d="M9.5 3h5M10 3v6.2l-5.6 9.4A1.6 1.6 0 0 0 5.8 21h12.4a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3M7 14h10" />
  </>,
  mail: <>
    <rect {...R} x="3" y="5" width="18" height="14" rx="2.2" />
    <rect x="3" y="5" width="18" height="14" rx="2.2" /><path d="M3.8 6.5l8.2 6.3 8.2-6.3" />
  </>,
  telefono: <>
    <path {...R} d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
    <path d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
  </>,
  sin_contacto: <>
    <path {...R} d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
    <path d="M5 3.8h3l1.6 4.1-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3 5.9a2 2 0 0 1 2-2.1Z" />
    <path d="M15 3.5l6 6M21 3.5l-6 6" />
  </>,
  lapiz: <>
    <path {...R} d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z" />
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z" /><path d="M13.5 7l3 3" />
  </>,
  enviar: <>
    <path {...R} d="M21 3L3 10.5l7 2.6 2.6 7Z" />
    <path d="M21 3L3 10.5l7 2.6 2.6 7Z" /><path d="M21 3L10 13.1" />
  </>,
  entrada: <>
    <path {...R} d="M3.5 13.5L6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
    <path d="M3.5 13.5L6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" /><path d="M3.5 13.5h5l1 2h5l1-2h5" />
  </>,
  ojo: <>
    <path {...R} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" />
  </>,
  trofeo: <>
    <path {...R} d="M7 3.5h10v5a5 5 0 0 1-10 0Z" />
    <path d="M7 3.5h10v5a5 5 0 0 1-10 0Z" /><path d="M7 5H4.5v1.5A3 3 0 0 0 7.5 9.5M17 5h2.5v1.5a3 3 0 0 1-3 3M12 13.5V17M8.5 20.5h7M9.5 17h5l.5 3.5h-6Z" />
  </>,
  microfono: <>
    <rect {...R} x="9" y="3" width="6" height="11" rx="3" />
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </>,
  etiqueta: <>
    <path {...R} d="M3 4.5V11l9.5 9.5a1.5 1.5 0 0 0 2.1 0l5.9-5.9a1.5 1.5 0 0 0 0-2.1L11 3H4.5A1.5 1.5 0 0 0 3 4.5Z" />
    <path d="M3 4.5V11l9.5 9.5a1.5 1.5 0 0 0 2.1 0l5.9-5.9a1.5 1.5 0 0 0 0-2.1L11 3H4.5A1.5 1.5 0 0 0 3 4.5Z" /><circle cx="7.5" cy="7.5" r="1.3" />
  </>,
  pregunta: <>
    <circle {...R} cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.9h.01" />
  </>,
  herramienta: <>
    <path {...R} d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3Z" />
    <path d="M14.7 3.4a4.5 4.5 0 0 0-1.2 5.2L3.9 18.2a2.1 2.1 0 0 0 3 3l9.6-9.6a4.5 4.5 0 0 0 5.2-1.2l-2.9-.6-.6-2.9 2.6-2.6Z" />
  </>,
  fiesta: <>
    <path {...R} d="M3.5 20.5L8 8l8 8Z" />
    <path d="M3.5 20.5L8 8l8 8ZM6 14l4 4" /><path d="M14 4.5c0 1.5 1 2.5 2.5 2.5M18.5 3v1.5M20.5 9.5H22M12 3.5V2M17 12c1.2-.9 2.7-.9 4 0" />
  </>,
  candado: <>
    <rect {...R} x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" />
  </>,
};

export type NombreIcono = keyof typeof DIBUJOS;
export const NOMBRES_ICONOS = Object.keys(DIBUJOS);

export function Icono({ n, size = 18, className = "", style, titulo }: { n: string; size?: number; className?: string; style?: CSSProperties; titulo?: string }) {
  const dibujo = DIBUJOS[n] ?? DIBUJOS.documento;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`} style={style}
      aria-hidden={titulo ? undefined : true} role={titulo ? "img" : undefined}>
      {titulo && <title>{titulo}</title>}
      {dibujo}
    </svg>
  );
}

// Mosaico: el icono en blanco sobre un cuadradito redondeado con degradé del
// color (para rubros y categorías de evidencia).
export function IconoMosaico({ n, color, size = 28, className = "", titulo }: { n: string; color: string; size?: number; className?: string; titulo?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-white ${className}`} title={titulo}
      style={{ width: size, height: size, borderRadius: size * 0.3, background: `linear-gradient(145deg, ${color}CC, ${color})`, boxShadow: `0 1px 2px ${color}55, inset 0 1px 0 #ffffff33` }}>
      <Icono n={n} size={Math.round(size * 0.64)} />
    </span>
  );
}

// Ícono de cada categoría de evidencia (lib/categorias-evidencia.ts).
export const ICONO_CATEGORIA: Record<string, string> = {
  denuncia: "denuncia", ampliacion: "ampliacion", foto_lugar: "lugar", foto_siniestro: "inspeccion",
  dni: "dni", dni_conductor: "dni_conductor", registro_conducir: "registro", cedula_vehiculo: "cedula",
  geolocalizacion: "geo", llamadas: "llamadas", mensajes: "mensajes", palabras_clave: "palabras",
  foto_momento: "camara", foto_previa: "foto_previa", llave: "llave", vtv: "vtv", recibo_sueldo: "recibo",
  desiste: "firma", fotos: "fotos", otro: "documento",
};
// Color por sección del expediente (mosaicos de "Qué adjuntar" y de subida).
export const COLOR_SECCION: Record<string, string> = {
  denuncia: "#1971C2", lugar: "#E03131", inspeccion: "#E8590C", documentacion: "#7048E8", digitales: "#0C8599", otros: "#495057",
};
