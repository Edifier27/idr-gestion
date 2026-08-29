import MailComposer from "nodemailer/lib/mail-composer";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { gmailConexion } from "@/lib/db/schema";
import { asegurarTablasGmail } from "@/lib/db/asegurar-gmail";

const REDIRECT_URI = "https://crm-atm.vercel.app/api/gmail/callback";
const SCOPE = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

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

// conexionId puntual (la casilla asignada a ese usuario) o, si no se pasa,
// la conectada más recientemente — así el código viejo (cron de backup, admin
// sin casilla propia asignada) sigue funcionando sin cambios.
export async function conexionActiva(conexionId?: string) {
  await asegurarTablasGmail();
  const db = getDb();
  if (conexionId) {
    const [row] = await db.select().from(gmailConexion).where(eq(gmailConexion.id, conexionId)).limit(1);
    return row ?? null;
  }
  const [row] = await db.select().from(gmailConexion).orderBy(desc(gmailConexion.conectadoEn)).limit(1);
  return row ?? null;
}

// Todas las casillas conectadas (para la pantalla de administración y el
// selector de "casilla asignada" en Usuarios), más nueva primero.
export async function listarConexiones() {
  await asegurarTablasGmail();
  const db = getDb();
  return db.select().from(gmailConexion).orderBy(desc(gmailConexion.conectadoEn));
}

async function accessTokenActivo(conexionId?: string): Promise<string> {
  const conexion = await conexionActiva(conexionId);
  if (!conexion) throw new Error("No hay una casilla de Gmail conectada.");
  return accessTokenDesdeRefresh(conexion.refreshToken);
}

export type AdjuntoMail = { nombre: string; tipo: string; bytes: Uint8Array };

/** Arma el mensaje MIME y lo manda por la API de Gmail, como la casilla conectada. */
export async function enviarMail(opts: {
  para: string;
  asunto: string;
  cuerpo: string;
  adjuntos: AdjuntoMail[];
  conexionId?: string;
}) {
  const conexion = await conexionActiva(opts.conexionId);
  if (!conexion) throw new Error("No hay una casilla de Gmail conectada.");

  const accessToken = await accessTokenActivo(opts.conexionId);

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

type CabeceraGmail = { name: string; value: string };
type ParteMensaje = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: ParteMensaje[];
};

function cabecera(headers: CabeceraGmail[], nombre: string): string {
  return headers.find(h => h.name.toLowerCase() === nombre.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/** Busca el texto plano del mail; si no hay, usa el HTML despojado de tags. */
function extraerTexto(payload?: ParteMensaje): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    const plano = payload.parts.find(p => p.mimeType === "text/plain" && p.body?.data);
    if (plano?.body?.data) return decodeBase64Url(plano.body.data);
    for (const parte of payload.parts) {
      const texto = extraerTexto(parte);
      if (texto) return texto;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Junta todas las partes que son adjuntos (tienen filename y attachmentId). */
function extraerAdjuntos(payload?: ParteMensaje): AdjuntoInfo[] {
  if (!payload) return [];
  const encontrados: AdjuntoInfo[] = [];
  function recorrer(parte: ParteMensaje) {
    if (parte.filename && parte.body?.attachmentId) {
      encontrados.push({
        attachmentId: parte.body.attachmentId,
        nombre: parte.filename,
        tipo: parte.mimeType ?? "application/octet-stream",
        tamano: parte.body.size ?? 0,
      });
    }
    parte.parts?.forEach(recorrer);
  }
  recorrer(payload);
  return encontrados;
}

export type AdjuntoInfo = { attachmentId: string; nombre: string; tipo: string; tamano: number };
export type MensajeResumen = {
  id: string;
  asunto: string;
  de: string;
  fecha: string;
  snippet: string;
  noLeido: boolean;
};
export type MensajeCompleto = MensajeResumen & { cuerpo: string; adjuntos: AdjuntoInfo[] };

/** Lista los últimos mensajes de la bandeja de entrada (más nuevos primero). */
export async function listarMensajes(maxResults = 25, conexionId?: string): Promise<MensajeResumen[]> {
  const accessToken = await accessTokenActivo(conexionId);
  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  if (!listRes.ok) throw new Error(listData?.error?.message ?? "No se pudo listar los mensajes.");
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

  return Promise.all(ids.map(async (id): Promise<MensajeResumen> => {
    const res = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const headers: CabeceraGmail[] = data.payload?.headers ?? [];
    return {
      id,
      asunto: cabecera(headers, "Subject") || "(sin asunto)",
      de: cabecera(headers, "From"),
      fecha: cabecera(headers, "Date"),
      snippet: data.snippet ?? "",
      noLeido: (data.labelIds ?? []).includes("UNREAD"),
    };
  }));
}

/** Trae un mensaje completo, con el cuerpo de texto ya decodificado. */
export async function obtenerMensaje(id: string, conexionId?: string): Promise<MensajeCompleto> {
  const accessToken = await accessTokenActivo(conexionId);
  const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer el mensaje.");
  const headers: CabeceraGmail[] = data.payload?.headers ?? [];
  return {
    id,
    asunto: cabecera(headers, "Subject") || "(sin asunto)",
    de: cabecera(headers, "From"),
    fecha: cabecera(headers, "Date"),
    snippet: data.snippet ?? "",
    noLeido: (data.labelIds ?? []).includes("UNREAD"),
    cuerpo: extraerTexto(data.payload),
    adjuntos: extraerAdjuntos(data.payload),
  };
}

/** Descarga los bytes de un adjunto puntual de un mensaje. */
export async function obtenerAdjunto(mensajeId: string, attachmentId: string, conexionId?: string): Promise<Buffer> {
  const accessToken = await accessTokenActivo(conexionId);
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${mensajeId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo descargar el adjunto.");
  const base64 = (data.data as string).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}
