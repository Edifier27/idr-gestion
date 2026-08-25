import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDb } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";

export const runtime = "nodejs";

const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// POST /api/evidencia/upload — genera el token para que el navegador suba el
// archivo directo a Vercel Blob (no pasa por esta función, así no hay límite
// de tamaño de la lambda). El registro en la DB lo hace el cliente después,
// contra /api/evidencia, una vez que confirma que la subida terminó.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { siniestroId } = JSON.parse(clientPayload ?? "{}") as { siniestroId?: string };
        if (!siniestroId) throw new Error("Falta siniestroId.");
        const db = getDb();
        const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
        if (!caso || !puedeVerCaso(session, caso.operador)) throw new Error("No autorizado para este caso.");

        return {
          allowedContentTypes: TIPOS_PERMITIDOS,
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {}, // el alta en la DB la hace el cliente contra /api/evidencia
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir el archivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
