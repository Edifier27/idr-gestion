import { NextRequest, NextResponse } from "next/server";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { obtenerAdjunto } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/gmail/mensajes/:id/adjuntos/:attachmentId?nombre=...&tipo=...
export async function GET(req: NextRequest, { params }: { params: { id: string; attachmentId: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const conexion = conexionGmailDeSesion(session);
  if ("error" in conexion) return NextResponse.json({ error: conexion.error }, { status: 400 });
  try {
    const bytes = await obtenerAdjunto(params.id, params.attachmentId, conexion.conexionId);
    const nombre = (req.nextUrl.searchParams.get("nombre") ?? "adjunto").replace(/[\r\n"]/g, "");
    const tipo = req.nextUrl.searchParams.get("tipo") ?? "application/octet-stream";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al descargar el adjunto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
