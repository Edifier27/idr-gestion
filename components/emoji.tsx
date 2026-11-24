import { Fragment, type ReactNode } from "react";
import { EMOJI_DISPONIBLES } from "@/lib/emoji-disponibles";

// Emojis del CRM con el diseño Fluent Emoji (Microsoft, MIT) en vez del
// emoji del sistema (que en Android/Windows se ve distinto en cada equipo).
// Si un emoji no está en la selección generada, se muestra el del sistema.

const RX = /\p{Extended_Pictographic}(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic}\u{FE0F}?)*/gu;

export function claveEmoji(e: string) {
  return Array.from(e.replace(/\u{FE0F}/gu, "")).map(c => c.codePointAt(0)!.toString(16)).join("-");
}

export function Emoji({ e, size, className = "" }: { e: string; size?: number; className?: string }) {
  const k = claveEmoji(e);
  if (!EMOJI_DISPONIBLES.has(k)) return <>{e}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/emoji/${k}.svg`} alt={e} draggable={false} loading="lazy" className={`emoji ${className}`}
      style={size ? { width: size, height: size } : undefined} />
  );
}

/** Texto con los emojis reemplazados por los de Fluent (burbujas, mensajes de la IA). */
export function ConEmojis({ children }: { children: string | null | undefined }): ReactNode {
  const texto = children ?? "";
  if (!texto) return null;
  const partes: ReactNode[] = [];
  let ultimo = 0, i = 0;
  for (const m of Array.from(texto.matchAll(RX))) {
    if (m.index! > ultimo) partes.push(<Fragment key={i++}>{texto.slice(ultimo, m.index)}</Fragment>);
    partes.push(<Emoji key={i++} e={m[0]} />);
    ultimo = m.index! + m[0].length;
  }
  if (!partes.length) return texto;
  if (ultimo < texto.length) partes.push(<Fragment key={i++}>{texto.slice(ultimo)}</Fragment>);
  return <>{partes}</>;
}

/** Texto de WhatsApp: *negrita*, _cursiva_ y ~tachado~, con emojis Fluent. */
export function TextoWhatsApp({ children }: { children: string | null | undefined }): ReactNode {
  const texto = children ?? "";
  const partes: ReactNode[] = [];
  const rx = /([*_~])(?=\S)([^\n]*?\S)\1/g;
  let ultimo = 0, i = 0;
  for (const m of Array.from(texto.matchAll(rx))) {
    if (m.index! > ultimo) partes.push(<ConEmojis key={i++}>{texto.slice(ultimo, m.index)}</ConEmojis>);
    const dentro = <ConEmojis>{m[2]}</ConEmojis>;
    partes.push(m[1] === "*" ? <b key={i++}>{dentro}</b> : m[1] === "_" ? <i key={i++}>{dentro}</i> : <s key={i++}>{dentro}</s>);
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < texto.length) partes.push(<ConEmojis key={i++}>{texto.slice(ultimo)}</ConEmojis>);
  return <>{partes}</>;
}
