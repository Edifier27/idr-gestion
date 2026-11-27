import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { buscarMensajes, conexionActiva } from "@/lib/gmail";
import { getDb } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { asegurarColumnaGmailMensajeId } from "@/lib/db/asegurar-gmail-mensaje-id";
import { asegurarTablasMailAuto } from "@/lib/mail-auto";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/gmail/mensajes — lista los mails de la casilla del usuario que
// pide (la que tiene asignada; el admin sin una asignada ve la conectada más
// recientemente), marcando cuáles ya se usaron para crear un caso.
// Carpetas como las de Gmail (se combinan con lo que se escriba en el buscador).
const CARPETAS: Record<string, string> = {
  recibidos: "in:inbox",
  no_leidos: "in:inbox is:unread",
  destacados: "is:starred",
  adjuntos: "has:attachment",
  enviados: "in:sent",
  todos: "-in:spam -in:trash",
};

// ?q=texto&carpeta=recibidos&pagina=<token> — de a 30, la página siguiente
// trae los más viejos (sin límite de antigüedad).
export async function GET(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });
  try {
    const p = req.nextUrl.searchParams;
    const carpeta = CARPETAS[p.get("carpeta") ?? "recibidos"] ?? CARPETAS.recibidos;
    const q = [carpeta, (p.get("q") ?? "").slice(0, 300)].filter(Boolean).join(" ");
    const { mensajes: mensajesGmail, siguiente, total } = await buscarMensajes({ q, pageToken: p.get("pagina") ?? undefined, max: 30, conexionId: conexion.conexionId });

    await asegurarColumnaGmailMensajeId();
    const ids = mensajesGmail.map(m => m.id);
    const importados = ids.length > 0
      ? await getDb().select({ mensajeId: siniestros.gmailMensajeId, id: siniestros.id, numeroGestion: siniestros.numeroGestion, nroSiniestro: siniestros.nroSiniestro, creadoEn: siniestros.creadoEn, operador: siniestros.operador })
          .from(siniestros).where(inArray(siniestros.gmailMensajeId, ids))
      : [];
    const porMensajeId = new Map(importados.map(i => [i.mensajeId, i]));

    // Lo que revisó la lectura automática (subido solo, duplicado o "no es un caso").
    const auto = new Map<string, { resultado: string; detalle: string | null; procesado_en: string }>();
    if (ids.length) {
      try {
        await asegurarTablasMailAuto();
        const r = await getDb().execute(sql`SELECT mensaje_id, resultado, detalle, procesado_en FROM mail_auto WHERE mensaje_id = ANY(${ids}::text[])`);
        for (const x of r.rows as { mensaje_id: string; resultado: string; detalle: string | null; procesado_en: string }[]) auto.set(x.mensaje_id, x);
      } catch { /* sin lectura automática */ }
    }

    const mensajes = mensajesGmail.map(m => {
      const caso = porMensajeId.get(m.id);
      const a = auto.get(m.id);
      return {
        ...m,
        casoImportado: caso ? { id: caso.id, etiqueta: caso.numeroGestion ?? caso.nroSiniestro ?? "sin número", subidoEn: new Date(caso.creadoEn).toISOString(), operador: caso.operador, automatico: a?.resultado === "importado" } : null,
        lecturaAuto: a && a.resultado !== "importado" ? { resultado: a.resultado, detalle: a.detalle, en: new Date(a.procesado_en).toISOString() } : null,
      };
    });

    const casilla = (await conexionActiva(conexion.conexionId))?.email ?? null;
    return NextResponse.json({ mensajes, siguiente, total, casilla });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer la bandeja.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
