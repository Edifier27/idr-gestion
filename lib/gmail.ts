import MailComposer from "nodemailer/lib/mail-composer";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { gmailConexion } from "@/lib/db/schema";
import { asegurarTablasGmail } from "@/lib/db/asegurar-gmail";

const REDIRECT_URI = "https://crm-atm.vercel.app/api/gmail/callback";
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

function credenciales() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Falta GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET en las variables de entorno.");
  return { clientId, clientSecret };
}

export function urlAutorizacion(): string {
  const { clientId } = credenciales();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function intercambiarCodigo(code: string): Promise<{ refreshToken: string; email: string }> {
  const { clientId, clientSecret } = credenciales();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "Error al intercambiar el código con Google.");
  if (!data.refresh_token) throw new Error("Google no devolvió refresh token. Probá reconectar (a veces hace falta revocar el acceso previo en myaccount.google.com/permissions).");

  const perfil = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  }).then(r => r.json());

  return { refreshToken: data.refresh_token, email: perfil.emailAddress ?? "desconocido" };
}

async function accessTokenDesdeRefresh(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = credenciales();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "No se pudo renovar el acceso a Gmail.");
  return data.access_token as string;
}

export async function conexionActiva() {
  await asegurarTablasGmail();
  const db = getDb();
  const [row] = await db.select().from(gmailConexion).orderBy(desc(gmailConexion.conectadoEn)).limit(1);
  return row ?? null;
}

export type AdjuntoMail = { nombre: string; tipo: string; bytes: Uint8Array };

/** Arma el mensaje MIME y lo manda por la API de Gmail, como la casilla conectada. */
export async function enviarMail(opts: {
  para: string;
  asunto: string;
  cuerpo: string;
  adjuntos: AdjuntoMail[];
}) {
  const conexion = await conexionActiva();
  if (!conexion) throw new Error("No hay una casilla de Gmail conectada.");

  const accessToken = await accessTokenDesdeRefresh(conexion.refreshToken);

  const composer = new MailComposer({
    from: conexion.email,
    to: opts.para,
    subject: opts.asunto,
    text: opts.cuerpo,
    attachments: opts.adjuntos.map(a => ({
      filename: a.nombre,
      content: Buffer.from(a.bytes),
      contentType: a.tipo,
    })),
  });
  const raw = await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, message) => err ? reject(err) : resolve(message));
  });
  const rawBase64Url = raw.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rawBase64Url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Gmail rechazó el envío.");
  }
}
