import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { gzipSync } from "zlib";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora, evidencia, usuarios, mailEnviado } from "@/lib/db/schema";
import { enviarMail, conexionActiva } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/backup — copia de seguridad completa de los datos del CRM, aparte
// de Neon: junta todas las tablas de "trabajo real" (siniestros con sus
// informes/descargo/relato, bitácora, metadata de evidencia, usuarios, mails
// enviados), las comprime y las guarda en dos lugares independientes de
// Neon: Vercel Blob y, si hay BACKUP_EMAIL configurado y una casilla de
// Gmail conectada, también por mail — así queda una copia en una bandeja de
// entrada, fuera de Vercel/Neon del todo.
//
// No incluye contraseñas (passwordHash) ni el refresh token de Gmail: son
// datos que se pueden rehacer (resetear contraseña, reconectar Gmail); lo
// que no se puede rehacer es el contenido de los casos, y eso es lo que
// respalda este backup.
//
// No respalda los archivos de evidencia en sí (fotos/PDFs en Vercel Blob),
// solo su metadata (nombre, categoría, quién lo subió) — eso queda pendiente
// como un paso aparte si hace falta.
//
// Pensado para correr solo, disparado por el Cron de vercel.json. Protegido
// con CRON_SECRET (si está configurada) para que no lo dispare cualquiera
// que encuentre la URL.
export async function GET(req: NextRequest) {
  const secretEsperado = process.env.CRON_SECRET;
  if (secretEsperado) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secretEsperado}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }
  if (!dbConfigurada()) return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });

  const db = getDb();
  const [todosSiniestros, todaBitacora, todaEvidencia, todosUsuarios, todoMail] = await Promise.all([
    db.select().from(siniestros),
    db.select().from(bitacora),
    db.select().from(evidencia),
    db.select().from(usuarios),
    db.select().from(mailEnviado),
  ]);

  const usuariosSinPassword = todosUsuarios.map(({ passwordHash: _passwordHash, ...resto }) => resto);

  const backup = {
    generadoEn: new Date().toISOString(),
    version: 1,
    tablas: {
      siniestros: todosSiniestros,
      bitacora: todaBitacora,
      evidencia: todaEvidencia,
      usuarios: usuariosSinPassword,
      mailEnviado: todoMail,
    },
  };

  const json = JSON.stringify(backup);
  const comprimido = gzipSync(Buffer.from(json, "utf-8"));
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `backup-idr-gestion-${fecha}.json.gz`;

  const blob = await put(nombreArchivo, comprimido, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/gzip",
  });

  let mailOk = false;
  let mailError: string | null = null;
  const destinatario = process.env.BACKUP_EMAIL;
  if (destinatario) {
    try {
      const conexion = await conexionActiva();
      if (conexion) {
        await enviarMail({
          para: destinatario,
          asunto: `Backup IDR Gestión — ${fecha}`,
          cuerpo:
            `Backup automático del ${fecha}.\n\n` +
            `Siniestros: ${todosSiniestros.length}\n` +
            `Bitácora: ${todaBitacora.length}\n` +
            `Evidencia (metadata): ${todaEvidencia.length}\n` +
            `Usuarios: ${todosUsuarios.length}\n` +
            `Mails registrados: ${todoMail.length}\n\n` +
            `También queda guardado en: ${blob.url}`,
          adjuntos: [{ nombre: nombreArchivo, tipo: "application/gzip", bytes: comprimido }],
        });
        mailOk = true;
      } else {
        mailError = "No hay casilla de Gmail conectada; se guardó solo en Blob.";
      }
    } catch (e) {
      mailError = e instanceof Error ? e.message : "Error al mandar el mail de backup.";
    }
  }

  return NextResponse.json({
    ok: true,
    blobUrl: blob.url,
    filas: {
      siniestros: todosSiniestros.length,
      bitacora: todaBitacora.length,
      evidencia: todaEvidencia.length,
      usuarios: todosUsuarios.length,
      mailEnviado: todoMail.length,
    },
    mailEnviado: mailOk,
    mailError,
  });
}
