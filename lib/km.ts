// Calcula el km total del recorrido: base -> domicilio -> lugar del hecho -> base.
// Usa Google Distance Matrix. La base fija sale de BASE_ORIGEN.
const BASE = process.env.BASE_ORIGEN ?? "General Deheza 527, Avellaneda, Buenos Aires, Argentina";

async function tramoKm(origen: string, destino: string, key: string): Promise<number> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origen);
  url.searchParams.set("destinations", destino);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  const json = await res.json();
  const metros = json?.rows?.[0]?.elements?.[0]?.distance?.value;
  if (typeof metros !== "number") {
    throw new Error("No se pudo calcular la distancia (revisá las direcciones o la API key de Maps).");
  }
  return metros / 1000;
}

/**
 * Recorrido base -> domicilio -> hecho -> base. Devuelve km totales redondeados.
 */
export async function calcularKmRecorrido(domicilio: string, lugarHecho: string): Promise<number> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY no está configurada.");
  const ida = await tramoKm(BASE, domicilio, key);
  const medio = await tramoKm(domicilio, lugarHecho, key);
  const vuelta = await tramoKm(lugarHecho, BASE, key);
  return Math.round(ida + medio + vuelta);
}
