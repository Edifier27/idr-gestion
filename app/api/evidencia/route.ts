import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, siniestros } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { sesionRequerida, puedeVerCaso } from "@/lib/acceso";
import { clasificarEvidencia } from "@/lib/clasificar-evidencia";
import { put, del } from "@vercel/blob";
import { hayQueNormalizar, normalizarArchivo } from "@/lib/normalizar-archivo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/evidencia — registra en la DB un archivo que el cliente ya subió
// directo a Vercel Blob (ver /api/evidencia/upload).
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const siniestroId = typeof body?.siniestroId === "string" ? body.siniestroId : "";
  let nombre = typeof body?.nombre === "string" ? body.nombre : "";
  let url = typeof body?.url === "string" ? body.url : "";
  let tipo = typeof body?.tipo === "string" ? body.tipo : "application/octet-stream";
  let tamano = typeof body?.tamano === "number" ? body.tamano : null;
  let categoria = typeof body?.categoria === "string" && body.categoria ? body.categoria : null;
  if (!siniestroId || !nombre || !url) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  await asegurarTablaEvidencia();
  const db = getDb();
  const [caso] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!caso || !puedeVerCaso(session, caso.operador)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // Formatos raros (.jfif, .heic de iPhone, .webp, .bmp, .tiff…) se pasan a
  // JPG: se ven en el CRM y en el PDF, y los lee la IA. El original se borra.
  let bytesYaBajados: Uint8Array | null = null;
  if (hayQueNormalizar(nombre, tipo)) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const n = await normalizarArchivo(new Uint8Array(await res.arrayBuffer()), nombre, tipo);
        bytesYaBajados = n.bytes;
        if (n.convertido) {
          const blob = await put(n.nombre, Buffer.from(n.bytes), { access: "public", addRandomSuffix: true, contentType: n.tipo });
          await del(url).catch(() => {});
          url = blob.url; nombre = n.nombre; tipo = n.tipo; tamano = n.bytes.length;
        }
      }
    } catch { /* queda como vino */ }
  }

  // Si no eligió categoría a mano, la IA la infiere mirando el archivo — así
  // el expediente igual se arma en el orden correcto (lib/pdf.ts agrupa por
  // categoría). Si falla por lo que sea, queda sin categoría como antes.
  if (!categoria) {
    try {
      let bytes = bytesYaBajados;
      if (!bytes) {
        const res = await fetch(url);
        if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
      }
      if (bytes) categoria = await clasificarEvidencia(bytes, tipo);
    } catch {
      categoria = null;
    }
  }

  const [row] = await db.insert(evidencia)
    .values({ siniestroId, nombre, url, tipo, tamano, categoria, subidoPor: session.user.username })
    .returning();
  return NextResponse.json({ archivo: row }, { status: 201 });
}
