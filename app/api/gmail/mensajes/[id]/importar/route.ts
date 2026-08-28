import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { put } from "@vercel/blob";
import { sesionRequerida } from "@/lib/acceso";
import { obtenerMensaje, obtenerAdjunto } from "@/lib/gmail";
import { extraerCaratula } from "@/lib/extraction";
import { crearSiniestro } from "@/lib/siniestros";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarColumnaGmailMensajeId } from "@/lib/db/asegurar-gmail-mensaje-id";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/gmail/mensajes/:id/importar — arma el legajo entero a partir de
// un mail de la bandeja: busca el PDF de carátula entre los adjuntos, lo lee
// con IA para crear el caso, y apila TODOS los adjuntos del mail como
// evidencia del caso recién creado. Admin-only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const operador = typeof body?.operador === "string" ? body.operador.trim().toUpperCase() : "";
  const forzar = body?.forzar === true;
  if (!operador) return NextResponse.json({ error: "Elegí a qué operador se le asigna el caso." }, { status: 400 });

  try {
    await asegurarColumnaGmailMensajeId();
    const db = getDb();

    // Este mismo mail ya se usó para crear un caso — no lo volvemos a hacer
    // aunque no se fuerce, porque sería literal el mismo mail dos veces.
    const [yaImportadoDeEsteMail] = await db.select().from(siniestros).where(eq(siniestros.gmailMensajeId, params.id));
    if (yaImportadoDeEsteMail) {
      return NextResponse.json({
        duplicado: true,
        existente: { id: yaImportadoDeEsteMail.id, numeroGestion: yaImportadoDeEsteMail.numeroGestion, nroSiniestro: yaImportadoDeEsteMail.nroSiniestro, asegurado: yaImportadoDeEsteMail.asegurado },
        mensaje: "Este mail ya se usó para crear un caso.",
      }, { status: 409 });
    }

    const mensaje = await obtenerMensaje(params.id);
    const pdfAdjunto = mensaje.adjuntos.find(a => a.tipo === "application/pdf");
    if (!pdfAdjunto) {
      return NextResponse.json({ error: "Este mail no tiene ningún PDF adjunto para leer los datos del caso." }, { status: 400 });
    }

    const pdfBytes = await obtenerAdjunto(params.id, pdfAdjunto.attachmentId);
    const datos = await extraerCaratula(pdfBytes.toString("base64"));

    // Además, si el número de siniestro/gestión ya existe en otro caso (se
    // importó por otra vía, o el operador lo tocó dos veces), avisamos antes
    // de crear un duplicado — salvo que venga forzado ("crear igual").
    if (!forzar && (datos.nro_siniestro || datos.numero_gestion)) {
      const condiciones = [];
      if (datos.nro_siniestro) condiciones.push(eq(siniestros.nroSiniestro, datos.nro_siniestro));
      if (datos.numero_gestion) condiciones.push(eq(siniestros.numeroGestion, datos.numero_gestion));
      const [existente] = await db.select().from(siniestros).where(or(...condiciones));
      if (existente) {
        return NextResponse.json({
          duplicado: true,
          existente: { id: existente.id, numeroGestion: existente.numeroGestion, nroSiniestro: existente.nroSiniestro, asegurado: existente.asegurado },
          mensaje: "Ya existe un caso con este número de siniestro/gestión.",
        }, { status: 409 });
      }
    }

    const siniestro = await crearSiniestro(datos, operador, params.id);

    await asegurarTablaEvidencia();
    let archivosImportados = 0;
    for (const adjunto of mensaje.adjuntos) {
      try {
        const bytes = adjunto.attachmentId === pdfAdjunto.attachmentId ? pdfBytes : await obtenerAdjunto(params.id, adjunto.attachmentId);
        const blob = await put(adjunto.nombre, bytes, { access: "public", addRandomSuffix: true, contentType: adjunto.tipo });
        await db.insert(evidencia).values({
          siniestroId: siniestro.id,
          nombre: adjunto.nombre,
          url: blob.url,
          tipo: adjunto.tipo,
          tamano: adjunto.tamano || bytes.length,
          subidoPor: session.user.username,
        });
        archivosImportados++;
      } catch {
        // si un adjunto puntual falla, seguimos con el resto — el caso ya está creado
      }
    }

    return NextResponse.json({ siniestro, archivosImportados }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al importar el caso desde el mail.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 501 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
