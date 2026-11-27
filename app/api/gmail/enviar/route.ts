import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { enviarMail, obtenerMensaje, obtenerAdjunto, type AdjuntoMail } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 24 * 1024 * 1024; // Gmail acepta hasta 25 MB por mail

// POST /api/gmail/enviar (multipart) — redactar, responder, responder a todos
// y reenviar desde la casilla del CRM, como en Gmail.
// Campos: para, cc, asunto, cuerpo, modo (nuevo|responder|responder_todos|reenviar),
// origen (id del mail que se responde o reenvía), con_adjuntos_originales ("1"),
// archivos (uno o varios).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const texto = (k: string) => String(form.get(k) ?? "").trim();
  const para = texto("para"), cc = texto("cc"), asunto = texto("asunto"), cuerpo = String(form.get("cuerpo") ?? "");
  const modo = texto("modo") || "nuevo";
  const origenId = texto("origen");
  if (!para) return NextResponse.json({ error: "Falta a quién mandarlo." }, { status: 400 });
  if (!asunto && !cuerpo.trim()) return NextResponse.json({ error: "El mail está vacío." }, { status: 400 });

  try {
    const adjuntos: AdjuntoMail[] = [];
    let threadId: string | undefined, inReplyTo: string | undefined, references: string | undefined;
    if (origenId && modo !== "nuevo") {
      const origen = await obtenerMensaje(origenId, conexion.conexionId);
      if (modo === "reenviar") {
        if (texto("con_adjuntos_originales") === "1") {
          for (const a of origen.adjuntos) {
            const bytes = await obtenerAdjunto(origenId, a.attachmentId, conexion.conexionId);
            adjuntos.push({ nombre: a.nombre, tipo: a.tipo, bytes: new Uint8Array(bytes) });
          }
        }
      } else {
        threadId = origen.threadId;
        inReplyTo = origen.messageIdHeader || undefined;
        references = [origen.references, origen.messageIdHeader].filter(Boolean).join(" ") || undefined;
      }
    }
    for (const f of form.getAll("archivos")) {
      if (f instanceof File && f.size > 0) adjuntos.push({ nombre: f.name, tipo: f.type || "application/octet-stream", bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    if (adjuntos.reduce((a, x) => a + x.bytes.length, 0) > MAX_BYTES) {
      return NextResponse.json({ error: "Los adjuntos pasan los 25 MB que acepta Gmail." }, { status: 400 });
    }
    await enviarMail({ para, cc, asunto, cuerpo, adjuntos, conexionId: conexion.conexionId, threadId, inReplyTo, references });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo mandar el mail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
