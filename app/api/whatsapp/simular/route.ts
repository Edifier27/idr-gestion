import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sesionRequerida } from "@/lib/acceso";
import { procesarEntrante } from "@/lib/whatsapp/procesar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/whatsapp/simular — solo admin. Hace de cuenta que un operador
// mandó un WhatsApp (texto y/o archivo) y lo pasa por el mismo circuito que
// un mensaje real: sirve para probar todo sin el número de Meta conectado.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const telefono = String(form?.get("telefono") ?? "").replace(/\D/g, "");
  const texto = String(form?.get("texto") ?? "").trim() || null;
  const archivo = form?.get("archivo");
  if (!telefono) return NextResponse.json({ error: "Falta el teléfono del operador." }, { status: 400 });
  if (!texto && !(archivo instanceof File)) return NextResponse.json({ error: "Escribí algo o adjuntá un archivo." }, { status: 400 });
  try {
    await procesarEntrante({
      waId: `simulado.${randomUUID()}`, telefono, nombre: null,
      tipo: archivo instanceof File ? (archivo.type.startsWith("image/") ? "image" : archivo.type.startsWith("audio/") ? "audio" : "document") : "text",
      texto,
      archivo: archivo instanceof File ? { buffer: Buffer.from(await archivo.arrayBuffer()), mime: archivo.type || "application/octet-stream", nombre: archivo.name } : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo simular." }, { status: 500 });
  }
}
