import Anthropic from "@anthropic-ai/sdk";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, bitacora, datoExtra, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaLecturaDenuncia } from "@/lib/db/asegurar-lectura-denuncia";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";

// Lectura con IA de la denuncia policial (o administrativa) y de la
// ampliación del asegurado que se subieron como evidencia. Con eso:
// 1) se arma el "Relato de la denuncia" = ampliación del asegurado contada
//    en orden cronológico + denuncia policial del día del hecho (si no hay
//    ampliación, esa parte queda vacía — pedido de Dario);
// 2) se cotejan los datos de la denuncia contra los del siniestro (fecha,
//    hora, lugar, vehículo, titular…);
// 3) se aplica la prioridad de la denuncia: si está a nombre del asegurado,
//    su teléfono y domicilio pasan a ser los del caso; si la hizo un
//    conductor, sus datos quedan como "Conductor" en los datos adicionales.

export type CotejoDato = { dato: string; siniestro: string | null; denuncia: string | null; coincide: boolean | null; nota?: string | null };
export type LecturaDenuncia = {
  ampliacion: string | null;
  denuncia: string | null;
  tipo_denuncia: "policial" | "administrativa" | null;
  denunciante: { nombre: string | null; dni: string | null; rol: "asegurado" | "conductor" | "otro" | null; telefono: string | null; domicilio: string | null } | null;
  cotejo: CotejoDato[];
  alertas: string[];
  archivos: string[];
  cambios: string[];
  leidoEn: string;
};

const SISTEMA = `Sos perito liquidador de siniestros de seguros en Argentina. Te paso la denuncia policial (o
administrativa) y, si existe, la ampliación del asegurado (declaración manuscrita o firmada), junto con los
datos del siniestro que cargó la aseguradora. Leé TODO con cuidado (los manuscritos también) y devolvé SOLO un
JSON válido, sin backticks ni texto alrededor, con esta forma:

{
  "ampliacion": "relato de la AMPLIACIÓN del asegurado, contado en orden cronológico y con todo el detalle que da (horarios, recorrido, lugares, personas). null si no hay ampliación entre los archivos",
  "denuncia": "relato de lo que dice la DENUNCIA policial/administrativa del día del hecho, fiel al documento. null si no hay denuncia",
  "tipo_denuncia": "policial" | "administrativa" | null,
  "denunciante": { "nombre": null, "dni": null, "rol": "asegurado" | "conductor" | "otro" | null, "telefono": null, "domicilio": null },
  "cotejo": [ { "dato": "Fecha del hecho", "siniestro": "...", "denuncia": "...", "coincide": true | false | null, "nota": "breve, solo si hace falta" } ],
  "alertas": [ "inconsistencias o puntos a verificar, en frases cortas" ]
}

Reglas: en "cotejo" compará al menos fecha, hora, lugar del hecho, vehículo/patente, titular/asegurado y la
mecánica del hecho, más cualquier otro dato que difiera. "rol" es "asegurado" si quien denuncia es el asegurado,
"conductor" si es otra persona que manejaba el vehículo. No inventes nada: lo que no figure va null.
Español rioplatense formal.`;

const TIPOS_LEGIBLES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

function textoRelato(l: Pick<LecturaDenuncia, "ampliacion" | "denuncia" | "tipo_denuncia">): string {
  const partes: string[] = [];
  if (l.ampliacion?.trim()) partes.push(`AMPLIACIÓN DEL ASEGURADO\n${l.ampliacion.trim()}`);
  if (l.denuncia?.trim()) partes.push(`DENUNCIA ${l.tipo_denuncia === "administrativa" ? "ADMINISTRATIVA" : "POLICIAL"} (día del hecho)\n${l.denuncia.trim()}`);
  return partes.join("\n\n");
}

export async function leerLecturaDenuncia(siniestroId: string): Promise<LecturaDenuncia | null> {
  try {
    await asegurarTablaLecturaDenuncia();
    const res = await getDb().execute(sql`SELECT datos FROM lectura_denuncia WHERE siniestro_id = ${siniestroId}`);
    const fila = (res.rows as { datos: LecturaDenuncia }[])[0];
    return fila?.datos ?? null;
  } catch {
    return null;
  }
}

async function ponerDatoExtra(siniestroId: string, etiqueta: string, valor: string | null) {
  if (!valor?.trim()) return;
  const db = getDb();
  await db.delete(datoExtra).where(and(eq(datoExtra.siniestroId, siniestroId), eq(datoExtra.etiqueta, etiqueta)));
  await db.insert(datoExtra).values({ siniestroId, etiqueta, valor: valor.trim() });
}

export async function leerDenuncia(s: SiniestroRow, autor: string | null): Promise<LecturaDenuncia> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const db = getDb();

  const filas = await db.select().from(evidencia)
    .where(and(eq(evidencia.siniestroId, s.id), inArray(evidencia.categoria, ["denuncia", "ampliacion"])))
    .orderBy(evidencia.creadoEn);
  const legibles = filas.filter(f => TIPOS_LEGIBLES.includes(f.tipo)).slice(0, 15);
  if (legibles.length === 0) {
    throw new Error("No hay denuncia ni ampliación cargadas como evidencia (fotos o PDF). Subilas en Evidencia → Denuncia / Ampliación.");
  }

  const contenido: Anthropic.Messages.ContentBlockParam[] = [];
  for (const f of legibles) {
    const r = await fetch(f.url);
    if (!r.ok) continue;
    const data = Buffer.from(await r.arrayBuffer()).toString("base64");
    contenido.push({ type: "text", text: `Archivo "${f.nombre}" — cargado como ${f.categoria === "ampliacion" ? "AMPLIACIÓN del asegurado" : "DENUNCIA"}:` });
    if (f.tipo === "application/pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else contenido.push({ type: "image", source: { type: "base64", media_type: f.tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } });
  }
  if (contenido.length === 0) throw new Error("No se pudieron descargar los archivos de la denuncia.");

  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
  contenido.push({
    type: "text",
    text: `Datos del siniestro según la aseguradora:\n${JSON.stringify({
      nroSiniestro: s.nroSiniestro, tipo: s.tipo, asegurado: s.asegurado, dni: s.dni, denunciante: s.denunciante,
      fechaOcurrencia: s.fechaOcurrencia, horaOcurrencia: s.horaOcurrencia,
      lugarHecho: [lugar.calle1, lugar.altura1, lugar.calle2, lugar.localidad, lugar.provincia].filter(Boolean).join(" "),
      domicilioAsegurado: s.domicilio, telefono: s.telContacto ?? s.celContacto, rama: s.rama, poliza: s.poliza,
    }, null, 2)}`,
  });

  const msg = await new Anthropic({ apiKey }).messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 4000,
    system: SISTEMA,
    messages: [{ role: "user", content: contenido }],
  });
  const crudo = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("").trim();
  const json = crudo.slice(crudo.indexOf("{"), crudo.lastIndexOf("}") + 1);
  let leido: Omit<LecturaDenuncia, "archivos" | "cambios" | "leidoEn">;
  try {
    leido = JSON.parse(json);
  } catch {
    throw new Error("La IA no devolvió una lectura válida. Probá de nuevo.");
  }

  // Prioridad de la denuncia (Dario): a nombre del asegurado manda sobre la
  // carátula; si la hizo un conductor, sus datos quedan aparte.
  const cambios: string[] = [];
  const patch: Partial<SiniestroRow> = {};
  const relato = textoRelato(leido);
  if (relato) patch.relatoDenuncia = relato;
  const d = leido.denunciante;
  await asegurarTablaDatoExtra();
  if (d?.rol === "asegurado") {
    if (d.telefono && d.telefono !== s.telContacto) {
      cambios.push(`Teléfono: ${s.telContacto ?? "—"} → ${d.telefono} (de la denuncia)`);
      if (s.telContacto) await ponerDatoExtra(s.id, "Teléfono según carátula", s.telContacto);
      patch.telContacto = d.telefono;
    }
    if (d.domicilio && d.domicilio !== s.domicilio) {
      cambios.push(`Domicilio: ${s.domicilio ?? "—"} → ${d.domicilio} (de la denuncia)`);
      if (s.domicilio) await ponerDatoExtra(s.id, "Domicilio según carátula", s.domicilio);
      patch.domicilio = d.domicilio;
    }
  } else if (d?.rol === "conductor") {
    await ponerDatoExtra(s.id, "Conductor", d.nombre);
    await ponerDatoExtra(s.id, "DNI conductor", d.dni);
    await ponerDatoExtra(s.id, "Teléfono conductor", d.telefono);
    await ponerDatoExtra(s.id, "Domicilio conductor", d.domicilio);
    cambios.push(`Denuncia hecha por el conductor${d.nombre ? ` (${d.nombre})` : ""}: sus datos quedaron en Datos adicionales.`);
  }
  if (Object.keys(patch).length) {
    await db.update(siniestros).set({ ...patch, actualizadoEn: new Date() }).where(eq(siniestros.id, s.id));
  }

  const lectura: LecturaDenuncia = {
    ...leido,
    cotejo: Array.isArray(leido.cotejo) ? leido.cotejo : [],
    alertas: Array.isArray(leido.alertas) ? leido.alertas : [],
    archivos: legibles.map(f => f.nombre),
    cambios,
    leidoEn: new Date().toISOString(),
  };
  await asegurarTablaLecturaDenuncia();
  await db.execute(sql`
    INSERT INTO lectura_denuncia (siniestro_id, datos, leido_en) VALUES (${s.id}, ${JSON.stringify(lectura)}::jsonb, now())
    ON CONFLICT (siniestro_id) DO UPDATE SET datos = EXCLUDED.datos, leido_en = now()
  `);

  const difieren = lectura.cotejo.filter(c => c.coincide === false).length;
  await db.insert(bitacora).values({
    siniestroId: s.id, tipo: "nota", autor, autorEsAdmin: null, leida: true,
    nota: `La IA leyó la denuncia${leido.ampliacion ? " y la ampliación" : ""} (${legibles.length} archivo${legibles.length === 1 ? "" : "s"}). ` +
      `${difieren ? `${difieren} dato${difieren === 1 ? "" : "s"} no coincide${difieren === 1 ? "" : "n"} con el siniestro.` : "Sin diferencias con el siniestro."}` +
      (cambios.length ? ` Cambios: ${cambios.join("; ")}` : ""),
  });
  return lectura;
}
