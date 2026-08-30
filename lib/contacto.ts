// Enlaces directos a Google Maps / WhatsApp / llamada a partir de los datos
// de contacto del caso — Dario pidió poder tocar el domicilio o el teléfono
// y que abra directo en la app correspondiente, sin copiar y pegar a mano.

export function limpiarNumero(v: string): string {
  return v.replace(/\D/g, "");
}

// wa.me necesita el número completo con código de país. Los teléfonos se
// cargan como número local (ej. "11 2345-6789"), así que si no viene ya con
// el 54 de Argentina se le antepone junto con el 9 que WhatsApp pide para
// celulares. Es una heurística pensada para números argentinos (el caso de
// uso real de IDR Gestión) — un número de otro país habría que cargarlo con
// su código de país adelante para que el link salga bien.
export function whatsappUrl(numero: string): string | null {
  const n = limpiarNumero(numero);
  if (!n) return null;
  const conCodigo = n.startsWith("54") ? n : `549${n}`;
  return `https://wa.me/${conCodigo}`;
}

export function telUrl(numero: string): string | null {
  const n = limpiarNumero(numero);
  return n ? `tel:${n}` : null;
}

export function mapsUrl(direccion: string): string | null {
  const d = direccion.trim();
  return d ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d)}` : null;
}
