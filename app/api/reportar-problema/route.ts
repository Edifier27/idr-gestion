import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { sesionRequerida, conexionGmailDeSesion } from "@/lib/acceso";
import { getDb, dbConfigurada } from "@/lib/db";
import { reporteProblema } from "@/lib/db/schema";
import { asegurarTablaReporteProblema } from "@/lib/db/asegurar-reporte-problema";
import { conexionActiva, enviarMail } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SISTEMA = `Sos el soporte técnico del CRM de IDR Gestión (investigación de siniestros para la aseguradora ATM).
Te escribe un administrador que encontró un problema. Contestá en español rioplatense (voseo), breve y concreto:
1) qué es lo más probable que esté pasando, en palabras simples;
2) qué puede hacer ahora para seguir trabajando (si hay algo);
3) si parece un error del sistema, decile que el reporte ya quedó enviado por mail para que lo arreglen.
No inventes funciones que no conocés. Si no sabés, decilo.

Cómo es el CRM: Tablero con bandejas (Hoy, Todos, Pendientes, Sin informe, Vencidos, Cerrados, Derivados); cada caso tiene
4 pasos (Datos del caso, Contactar al denunciante, Entrevista, Pruebas e informe), Datos del siniestro editables, km y
facturación ((km-30)*650+50000), evidencia (fotos/documentos), informe técnico-legal con IA, resolución final (solo admin),
chat admin-operador y envío de mails. Menú admin: Ranking, Usuarios (operadores con código CARLOS/JULIAN/NACHO/MANUEL,
contraseña, mail, zona), Mail (Gmail conectado: bandeja y "Crear legajo desde este mail"), Importar caso (PDF de carátula),
Importar planilla (Excel). Los operadores solo ven sus casos. Si Gmail dice "Venció la conexión", se reconecta desde Mail.`;

async function respuestaIa(descripcion: string, pagina: string, errores: unknown[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const msg = await new Anthropic({ apiKey }).messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 700,
      system: SISTEMA,
      messages: [{
        role: "user",
        content: `Pantalla: ${pagina || "—"}\n\nProblema:\n${descripcion}\n\nErrores técnicos que vio el navegador:\n${errores.length ? JSON.stringify(errores, null, 1) : "ninguno"}`,
      }],
    });
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("\n").trim() || null;
  } catch {
    return null;
  }
}

// POST /api/reportar-problema — solo admin. Guarda el reporte, le pide a la
// IA una primera respuesta y manda todo por mail (a REPORTES_MAIL, o a la
// casilla de Gmail conectada del que reporta) para pasárselo a Claude Code.
export async function POST(req: NextRequest) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (session.user.rol !== "admin") return NextResponse.json({ error: "Solo para administradores." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim().slice(0, 4000) : "";
  if (!descripcion) return NextResponse.json({ error: "Contá qué pasó." }, { status: 400 });
  const pagina = typeof body?.pagina === "string" ? body.pagina.slice(0, 300) : "";
  const errores = Array.isArray(body?.errores) ? body.errores.slice(0, 10) : [];
  const navegador = req.headers.get("user-agent") ?? "";
  const autor = session.user.name ?? session.user.username ?? "admin";

  const respuesta = await respuestaIa(descripcion, pagina, errores);

  let id: string | null = null;
  if (dbConfigurada()) {
    try {
      await asegurarTablaReporteProblema();
      const [row] = await getDb().insert(reporteProblema).values({
        autor, pagina, descripcion, contexto: { navegador, errores }, respuestaIa: respuesta,
      }).returning({ id: reporteProblema.id });
      id = row.id;
    } catch {
      // si no se pudo guardar, igual sigue el mail: es lo que importa
    }
  }

  let mailA: string | null = null;
  try {
    const conexion = conexionGmailDeSesion(session);
    if (!("error" in conexion)) {
      const casilla = await conexionActiva(conexion.conexionId);
      const para = process.env.REPORTES_MAIL || casilla?.email;
      if (casilla && para) {
        const cuerpo = [
          "Pegale este mail a Claude Code (repo idr-gestion) para que lo revise y lo arregle.",
          "",
          `Reportó: ${autor}`,
          `Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`,
          `Pantalla: ${pagina || "—"}`,
          id ? `Reporte N°: ${id}` : "",
          "",
          "QUÉ PASÓ",
          descripcion,
          "",
          "ERRORES TÉCNICOS DEL NAVEGADOR",
          errores.length ? JSON.stringify(errores, null, 2) : "ninguno",
          "",
          `Navegador: ${navegador}`,
          "",
          "PRIMERA RESPUESTA DE LA IA",
          respuesta ?? "(no hubo respuesta)",
        ].join("\n");
        await enviarMail({ para, asunto: `[CRM] Problema reportado: ${descripcion.slice(0, 60)}`, cuerpo, adjuntos: [], conexionId: conexion.conexionId });
        mailA = para;
        if (id) await getDb().update(reporteProblema).set({ mailEnviadoA: para }).where(eq(reporteProblema.id, id));
      }
    }
  } catch {
    // sin Gmail conectado (o vencido) el reporte queda igual guardado
  }

  return NextResponse.json({ respuesta, mailA });
}
