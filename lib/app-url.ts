// Dirección pública del CRM para los links de los mails (aviso de caso
// asignado, recordatorio de vencimiento). IDR Gestión usa la de siempre;
// CRMgestion la define con APP_URL en Vercel.
export const APP_URL = (process.env.APP_URL || "https://idrgestion.com.ar").replace(/\/$/, "");
