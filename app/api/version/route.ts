import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/version — la versión publicada ahora (para avisar a las pestañas
// abiertas que hay cambios nuevos y pueden actualizar).
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
