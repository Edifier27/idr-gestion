import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, mailEnviado, bitacora } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { enviarMail, type AdjuntoMail } from "@/lib/gmail";
import { construirExpedientePDF } from "@/lib/expediente";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/enviar { siniestroId, para, asunto, cuerpo, evidenciaIds?, adjuntarExpediente? }
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const siniestroId = typeof body?.siniestroId === "string" ? body.siniestroId : "";
  const para = typeof body?.para === "string" ? body.para.trim() : "";
  const asunto = typeof body?.asunto === "string" ? body.asunto.trim() : "";
  const cuerpo = typeof body?.cuerpo === "string" ? body.cuerpo : "";
  const evidenciaIds: string[] = Array.isArray(body?.evidenciaIds) ? body.evidenciaIds : [];
  const adjuntarExpediente = body?.adjuntarExpediente === true;

  if (!siniestroId || !para || !asunto) {
    return NextResponse.json({ error: "Faltan datos (destinatario o asunto)." }, { status: 400 });
  }

  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!caso) return NextResponse.json({ error: "No existe el caso." }, { status: 404 });
  if (!puedeVerCaso(session, caso.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  try {
    let adjuntos: AdjuntoMail[] = [];
    if (evidenciaIds.length > 0) {
      const filas = await db.select().from(evidencia)
        .where(inArray(evidencia.id, evidenciaIds));
      const propias = filas.filter(f => f.siniestroId === siniestroId);
      adjuntos = await Promise.all(propias.map(async f => {
        const res = await fetch(f.url);
        const bytes = new Uint8Array(await res.arrayBuffer());
        return { nombre: f.nombre, tipo: f.tipo, bytes };
      }));
    }

    if (adjuntarExpediente) {
      const expediente = await construirExpedientePDF(siniestroId);
      if (expediente) {
        adjuntos.push({
          nombre: `expediente-${expediente.siniestro.nroSiniestro ?? siniestroId}.pdf`,
          tipo: "application/pdf",
          bytes: expediente.bytes,
        });
      }
    }

    await enviarMail({ para, asunto, cuerpo, adjuntos });

    await db.insert(mailEnviado).values({ siniestroId, para, asunto, enviadoPor: session.user.username });
    await db.insert(bitacora).values({
      siniestroId, tipo: "mail",
      nota: `Mail a ${para} — "${asunto}"${adjuntos.length ? ` (${adjuntos.length} adjunto${adjuntos.length > 1 ? "s" : ""})` : ""}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar el mail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
