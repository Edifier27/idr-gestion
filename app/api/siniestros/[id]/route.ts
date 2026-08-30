import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, usuarios, bitacora } from "@/lib/db/schema";
import { calcularFacturacion } from "@/lib/facturacion";
import { sesionRequerida, puedeVerCaso, puedeVerFacturacion, ocultarFacturacion, conexionGmailDeSesion } from "@/lib/acceso";
import { enviarMail } from "@/lib/gmail";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [row] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, row.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const siniestro = puedeVerFacturacion(session) ? row : ocultarFacturacion(row);
  return NextResponse.json({ siniestro });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  const db = getDb();
  const [actual] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!actual) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!puedeVerCaso(session, actual.operador)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const body = await req.json();
  const verFacturacion = puedeVerFacturacion(session);

  const patch: Record<string, unknown> = { actualizadoEn: new Date() };
  const camposComunes = [
    "estado","resultado","operador","fecha_limite","informe","descargo","relato_denuncia",
    "etapa_contacto","fecha_entrevista","motivo_contacto","derivado_admin",
    // Datos del siniestro extraídos por la IA del PDF: el admin los puede
    // corregir a mano desde "Datos del siniestro" si la extracción se
    // equivocó o vino incompleta.
    "dni","poliza","denunciante","domicilio","fecha_ocurrencia","tel_contacto","cel_contacto",
    "email_contacto","lugar_siniestro",
  ];
  const campos = verFacturacion
    ? [...camposComunes, "numero_fc","gasto_fijo","km_total","estado_cobro","informe_final"]
    : camposComunes;
  const colMap: Record<string,string> = {
    estado:"estado", resultado:"resultado", numero_fc:"numeroFc",
    gasto_fijo:"gastoFijo", operador:"operador", km_total:"kmTotal",
    fecha_limite:"fechaLimite", estado_cobro:"estadoCobro", informe:"informe",
    informe_final:"informeFinal", descargo:"descargo", relato_denuncia:"relatoDenuncia",
    etapa_contacto:"etapaContacto", fecha_entrevista:"fechaEntrevista", motivo_contacto:"motivoContacto",
    derivado_admin:"derivadoAdmin",
    dni:"dni", poliza:"poliza", denunciante:"denunciante", domicilio:"domicilio",
    fecha_ocurrencia:"fechaOcurrencia", tel_contacto:"telContacto", cel_contacto:"celContacto",
    email_contacto:"emailContacto", lugar_siniestro:"lugarSiniestro",
  };
  for (const k of campos) {
    if (!(k in body)) continue;
    if (k === "fecha_entrevista") patch.fechaEntrevista = body[k] ? new Date(body[k]) : null;
    else patch[colMap[k]] = body[k];
  }
  if (verFacturacion && "km_total" in body) patch.facturar = calcularFacturacion(body.km_total);

  // El operador deriva el caso al admin cuando no lo puede contactar: marca
  // la hora de la derivación. Y si el contacto se termina logrando (etapa
  // pasa a "contactado" o más adelante, ya sea por el operador o por el
  // admin) se limpia sola, sin que nadie tenga que acordarse de "atenderla".
  if (patch.derivadoAdmin === true) patch.derivadoEn = new Date();
  if (!("derivado_admin" in body) && typeof patch.etapaContacto === "string" && patch.etapaContacto !== "contacto_fallido") {
    patch.derivadoAdmin = false;
    patch.derivadoEn = null;
  }

  // Marca el momento exacto en que el caso pasa a "desistido" (para el
  // ranking mensual de operadores) — y lo limpia si el resultado se corrige
  // para otro lado, para no dejar una fecha vieja colgada de un desistido
  // que ya no es tal.
  if (patch.resultado === "desistido" && actual.resultado !== "desistido") {
    patch.fechaDesistido = new Date();
  } else if (typeof patch.resultado === "string" && patch.resultado !== "desistido" && actual.resultado === "desistido") {
    patch.fechaDesistido = null;
  }

  const [row] = await db.update(siniestros).set(patch).where(eq(siniestros.id, params.id)).returning();
  if (!row) return NextResponse.json({ error: "No existe." }, { status: 404 });

  // Aviso automático por mail al operador cuando se le asigna (o reasigna)
  // el caso — antes esto se enteraba solo si entraba al tablero. No
  // bloquea la respuesta si falla (mail no conectado, operador sin mail
  // cargado, etc.): la asignación en sí ya se guardó arriba.
  if (verFacturacion && typeof patch.operador === "string" && patch.operador && patch.operador !== actual.operador) {
    try {
      await asegurarColumnasComunicacion();
      const [op] = await db.select({ nombre: usuarios.nombre, email: usuarios.email })
        .from(usuarios)
        .where(and(eq(usuarios.operador, patch.operador), eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)));
      if (op?.email) {
        const conexion = conexionGmailDeSesion(session);
        if (!("error" in conexion)) {
          const asunto = `Nuevo caso asignado — ${row.asegurado ?? "sin nombre"}`;
          const cuerpo = [
            `Hola ${op.nombre},`,
            "",
            "Te asignaron un caso nuevo en IDR Gestión:",
            "",
            `Asegurado: ${row.asegurado ?? "—"}`,
            `DNI: ${row.dni ?? "—"}`,
            `N° Siniestro: ${row.nroSiniestro ?? "—"}`,
            `Compañía: ${row.compania ?? "—"}`,
            "",
            `Entrá a verlo: https://idrgestion.com.ar/siniestros/${row.id}`,
            "",
            "— IDR Gestión",
          ].join("\n");
          await enviarMail({ para: op.email, asunto, cuerpo, adjuntos: [], conexionId: conexion.conexionId });
          await db.insert(bitacora).values({
            siniestroId: row.id, tipo: "mail",
            nota: `Aviso automático de asignación enviado a ${op.email}.`,
          });
        }
      }
    } catch {
      // no bloquea la asignación si el mail falla
    }
  }

  const siniestro = verFacturacion ? row : ocultarFacturacion(row);
  return NextResponse.json({ siniestro });
}
