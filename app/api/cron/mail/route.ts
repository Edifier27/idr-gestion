import { NextRequest, NextResponse } from "next/server";
import { dbConfigurada } from "@/lib/db";
import { leerMailsNuevos } from "@/lib/mail-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/mail — lo dispara el Cron de Vercel cada 2 minutos: lee los
// mails nuevos y sube como caso los que lo son (lib/mail-auto.ts).
// Protegido con CRON_SECRET (Vercel lo manda solo como Bearer).
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  if (process.env.LECTURA_AUTOMATICA_MAIL === "no") return NextResponse.json({ ok: true, apagada: true });
  try {
    return NextResponse.json({ ok: true, ...(await leerMailsNuevos()) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
