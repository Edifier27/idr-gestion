// Link directo para agregar la entrevista a Google Calendar — a Dario se le
// ocurrió que al pactar la entrevista se pueda abrir el calendario en vez
// de solo guardar la fecha en el CRM. No hace falta integración con la API
// de Google (ni permisos ni cuenta conectada): el link "render" de Calendar
// abre la pantalla de "nuevo evento" ya precargada, y quien la mira decide
// si la guarda.
export function googleCalendarUrl(opts: {
  titulo: string;
  inicioLocal: string; // formato del <input type="datetime-local">: "YYYY-MM-DDTHH:mm"
  duracionMin?: number;
  ubicacion?: string | null;
  detalles?: string | null;
}): string | null {
  const m = opts.inicioLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const inicio = `${y}${mo}${d}T${h}${mi}00`;

  // Sin "Z" al final a propósito: así Google Calendar lo interpreta en el
  // huso horario del calendario de quien lo abre (Argentina, en la
  // práctica), en vez de convertir desde UTC y correr el horario.
  const finDate = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi) + (opts.duracionMin ?? 60));
  const pad = (n: number) => String(n).padStart(2, "0");
  const fin = `${finDate.getFullYear()}${pad(finDate.getMonth() + 1)}${pad(finDate.getDate())}T${pad(finDate.getHours())}${pad(finDate.getMinutes())}00`;

  const params = new URLSearchParams({ action: "TEMPLATE", text: opts.titulo, dates: `${inicio}/${fin}` });
  if (opts.ubicacion) params.set("location", opts.ubicacion);
  if (opts.detalles) params.set("details", opts.detalles);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
