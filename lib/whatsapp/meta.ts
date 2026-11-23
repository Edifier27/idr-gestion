import { randomUUID } from "crypto";

// Cliente mínimo de WhatsApp Cloud API (Meta), tomado de AsesorCRM.
// Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID funciona en MODO PRUEBA: no
// sale nada a Meta y devuelve un id simulado (la bandeja y el simulador
// funcionan igual).
const VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";

export const modoPrueba = () => !process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID;

async function enviar(to: string, contenido: Record<string, unknown>): Promise<{ id: string; simulado?: boolean }> {
  if (modoPrueba()) return { id: `sim.${randomUUID()}`, simulado: true };
  const r = await fetch(`https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...contenido }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = (data as { error?: { code?: number; error_user_msg?: string; message?: string } }).error ?? {};
    throw new Error(`${e.code ?? r.status}: ${e.error_user_msg ?? e.message ?? "error de Meta"}`);
  }
  return { id: (data as { messages?: { id: string }[] }).messages?.[0]?.id ?? `sin-id.${randomUUID()}` };
}

export const enviarTexto = (to: string, texto: string) => enviar(to, { type: "text", text: { body: texto, preview_url: false } });

// Botones de respuesta (máximo 3, título de hasta 20 caracteres).
export const enviarBotones = (to: string, texto: string, botones: { id: string; titulo: string }[]) =>
  enviar(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto.slice(0, 1024) },
      action: { buttons: botones.slice(0, 3).map(b => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.titulo.slice(0, 20) } })) },
    },
  });

export async function descargarMedia(mediaId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (modoPrueba() || !mediaId) return null;
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = await fetch(`https://graph.facebook.com/${VERSION}/${mediaId}`, { headers: auth }).then(r => r.json()) as { url?: string; mime_type?: string; error?: { message?: string } };
  if (!meta?.url) throw new Error(`media ${mediaId}: ${meta?.error?.message ?? "sin url"}`);
  const r = await fetch(meta.url, { headers: auth });
  if (!r.ok) throw new Error(`media ${mediaId}: ${r.status}`);
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: meta.mime_type ?? r.headers.get("content-type") ?? "application/octet-stream" };
}

// Teléfono a comparar: solo dígitos, últimos 10 (código de área + número),
// así "+54 9 11 2345-6789", "5491123456789" y "1123456789" coinciden.
export function claveTelefono(t: string | null | undefined): string {
  const d = (t ?? "").replace(/\D/g, "");
  return d.slice(-10);
}
