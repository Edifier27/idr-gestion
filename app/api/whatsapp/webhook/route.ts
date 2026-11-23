import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { getDb } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { procesarEvento } from "@/lib/whatsapp/procesar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Webhook de WhatsApp Cloud API (Meta). Público (fuera del login, ver
// middleware): GET verifica el webhook con WHATSAPP_VERIFY_TOKEN; POST
// valida la firma con WHATSAPP_APP_SECRET, guarda el evento crudo ANTES de
// procesarlo (si falla, 500 y Meta reintenta), contesta 200 y procesa después.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function firmaValida(cuerpo: string, header: string | null) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || !header?.startsWith("sha256=")) return false;
  const recibida = header.slice(7);
  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");
  return recibida.length === esperada.length && timingSafeEqual(Buffer.from(recibida, "hex"), Buffer.from(esperada, "hex"));
}

export async function POST(req: NextRequest) {
  const cuerpo = await req.text();
  if (!firmaValida(cuerpo, req.headers.get("x-hub-signature-256"))) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(cuerpo); } catch { return new Response("Bad Request", { status: 400 }); }

  let eventoId: string;
  try {
    await asegurarTablasWhatsapp();
    const res = await getDb().execute(sql`INSERT INTO wa_evento (payload) VALUES (${JSON.stringify(body)}::jsonb) RETURNING id`);
    eventoId = (res.rows as { id: string }[])[0].id;
  } catch {
    return new Response("Error", { status: 500 });
  }

  waitUntil((async () => {
    try {
      await procesarEvento(body);
      await getDb().execute(sql`UPDATE wa_evento SET procesado_en = now() WHERE id = ${eventoId}`);
    } catch (e) {
      await getDb().execute(sql`UPDATE wa_evento SET error = ${String(e instanceof Error ? e.message : e)} WHERE id = ${eventoId}`);
    }
  })());
  return new Response("OK", { status: 200 });
}
