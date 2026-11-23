import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { sesionRequerida } from "@/lib/acceso";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/whatsapp/leido { conversacionId } — marca el chat como leído.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session || session.user.rol !== "admin") return NextResponse.json({ error: "Solo el admin." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.conversacionId !== "string") return NextResponse.json({ error: "Falta la conversación." }, { status: 400 });
  await getDb().execute(sql`UPDATE wa_conversacion SET no_leidos = 0 WHERE id = ${body.conversacionId}`);
  return NextResponse.json({ ok: true });
}
