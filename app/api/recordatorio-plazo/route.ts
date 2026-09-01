import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, ne } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, usuarios, bitacora } from "@/lib/db/schema";
import { plazoInforme } from "@/lib/etapa-contacto";
import { enviarMail } from "@/lib/gmail";
import { asegurarColumnaRecordatorioPlazo } from "@/lib/db/asegurar-recordatorio-plazo";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/recordatorio-plazo — mail automático al operador cuando se le
// acerca el vencimiento del informe (24hs desde la entrevista sin informe
// cargado, mismo criterio que ya usa el badge de "por vencer/vencido" en el
// tablero — ver plazoInforme() en lib/etapa-contacto.ts). Antes esto se
// enteraba solo si el operador entraba al caso; ahora le llega avisado.
//
// Disparado por el Cron de vercel.json, una vez por día. Al ser diario (no
// cada hora — Vercel Hobby no deja crons más frecuentes), el aviso no llega
// justo a las 24hs exactas sino en algún momento de ese mismo día una vez
// cruzado ese umbral — igual sirve: la alternativa de hoy es no avisar nada.
// recordatorio_plazo_enviado_en evita mandarlo dos veces por el mismo caso.
//
// Protegido con CRON_SECRET (si está configurada), mismo criterio que
// /api/backup.
export async function GET(req: NextRequest) {
  const secretEsperado = process.env.CRON_SECRET;
  if (secretEsperado) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secretEsperado}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });

  await asegurarColumnaRecordatorioPlazo();
  await asegurarColumnasComunicacion();
  const db = getDb();

  // Candidatos: entrevista pactada, sin informe todavía, sin recordatorio
  // previo, sin cerrar. plazoInforme() decide abajo si ya cruzó el umbral.
  const candidatos = await db.select().from(siniestros).where(
    and(
      eq(siniestros.etapaContacto, "entrevista_pactada"),
      isNull(siniestros.recordatorioPlazoEnviadoEn),
      ne(siniestros.estado, "cerrado"),
    ),
  );

  let enviados = 0;
  let sinMail = 0;
  const errores: string[] = [];

  for (const s of candidatos) {
    const plazo = plazoInforme(s.etapaContacto, s.fechaEntrevista);
    if (plazo !== "atencion" && plazo !== "vencido") continue; // todavía no cruzó las 24hs
    if (!s.operador) continue;

    try {
      const [op] = await db.select({ nombre: usuarios.nombre, email: usuarios.email })
        .from(usuarios)
        .where(and(eq(usuarios.operador, s.operador), eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)));
      if (!op?.email) { sinMail++; continue; }

      const urgencia = plazo === "vencido" ? "VENCIDO" : "por vencer";
      const asunto = `Informe ${urgencia} — ${s.asegurado ?? "caso"} (#${s.nroSiniestro ?? s.numeroGestion ?? "—"})`;
      const cuerpo = [
        `Hola ${op.nombre},`,
        "",
        plazo === "vencido"
          ? "Ya pasaron más de 48hs de la entrevista y todavía no cargaste el informe de este caso:"
          : "Se cumplen 48hs de la entrevista pronto y todavía no cargaste el informe de este caso:",
        "",
        `Asegurado: ${s.asegurado ?? "—"}`,
        `N° Siniestro: ${s.nroSiniestro ?? "—"}`,
        `Entrevista: ${s.fechaEntrevista ? new Date(s.fechaEntrevista).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"}`,
        "",
        `Entrá a cargarlo: https://idrgestion.com.ar/siniestros/${s.id}`,
        "",
        "— IDR Gestión",
      ].join("\n");

      await enviarMail({ para: op.email, asunto, cuerpo, adjuntos: [] });
      await db.update(siniestros).set({ recordatorioPlazoEnviadoEn: new Date() }).where(eq(siniestros.id, s.id));
      await db.insert(bitacora).values({
        siniestroId: s.id, tipo: "mail",
        nota: `Recordatorio automático de plazo (${urgencia}) enviado a ${op.email}.`,
      });
      enviados++;
    } catch (e) {
      errores.push(`${s.id}: ${e instanceof Error ? e.message : "error desconocido"}`);
    }
  }

  return NextResponse.json({ ok: true, revisados: candidatos.length, enviados, sinMail, errores });
}
