import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { listarMensajes } from "@/lib/gmail";
import { getDb } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { asegurarColumnaGmailMensajeId } from "@/lib/db/asegurar-gmail-mensaje-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/gmail/mensajes — lista los últimos mails de la bandeja del usuario
// que pide (la casilla que tiene asignada; el admin sin una asignada ve la
// conectada más recientemente), marcando cuáles ya se usaron para crear un
// caso (para no perder de vista cuáles todavía quedan por cargar, aunque
// Gmail ya los muestre como leídos).
export async function GET() {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });
  try {
    const mensajesGmail = await listarMensajes(25, conexion.conexionId);

    await asegurarColumnaGmailMensajeId();
    const ids = mensajesGmail.map(m => m.id);
    const importados = ids.length > 0
      ? await getDb().select({ mensajeId: siniestros.gmailMensajeId, id: siniestros.id, numeroGestion: siniestros.numeroGestion, nroSiniestro: siniestros.nroSiniestro })
          .from(siniestros).where(inArray(siniestros.gmailMensajeId, ids))
      : [];
    const porMensajeId = new Map(importados.map(i => [i.mensajeId, i]));

    const mensajes = mensajesGmail.map(m => {
      const caso = porMensajeId.get(m.id);
      return { ...m, casoImportado: caso ? { id: caso.id, etiqueta: caso.numeroGestion ?? caso.nroSiniestro ?? "sin número" } : null };
    });

    return NextResponse.json({ mensajes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer la bandeja.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
