import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidencia, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaPrioridad } from "@/lib/db/asegurar-prioridad";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarTablaLecturaDenuncia } from "@/lib/db/asegurar-lectura-denuncia";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente } from "@/lib/categorias-evidencia";

// Lo que el admin tendría que preguntarle o pedirle al operador en cada
// caso abierto (Panel de operadores): sale solo de cómo está el caso —
// etapa, fechas, pruebas que pide el ramo y diferencias de la denuncia —,
// como el "plan de trabajo" por caso de los sistemas de siniestros.

export type Pendiente = { tipo: "urgente" | "atencion" | "info"; texto: string; pregunta: string };

const DIA = 86_400_000;

function nombre(s: SiniestroRow) {
  return s.asegurado ?? s.denunciante ?? `el caso ${s.nroSiniestro ?? ""}`.trim();
}

export function pendientesDeCaso(
  s: SiniestroRow,
  categoriasCargadas: Set<string>,
  diferenciasDenuncia: number,
  ahora = Date.now(),
): Pendiente[] {
  const out: Pendiente[] = [];
  const dias = (d: Date | string | null | undefined) => (d ? (ahora - new Date(d).getTime()) / DIA : 0);
  const n = nombre(s);

  if (!s.etapaContacto && dias(s.creadoEn) >= 1) {
    out.push({ tipo: dias(s.creadoEn) >= 3 ? "urgente" : "atencion", texto: `Sin contactar hace ${Math.floor(dias(s.creadoEn))} días`, pregunta: `¿Pudiste contactar a ${n}? ¿Qué pasó?` });
  }
  if (s.etapaContacto === "contacto_fallido") {
    out.push({ tipo: "urgente", texto: `Contacto fallido${s.motivoContacto ? `: ${s.motivoContacto}` : ""}`, pregunta: `Con ${n}: ¿probaste otro teléfono, WhatsApp o ir al domicilio?` });
  }
  if (s.etapaContacto === "contactado" && dias(s.actualizadoEn) >= 2) {
    out.push({ tipo: "atencion", texto: "Contactado, sin entrevista pactada", pregunta: `¿Para cuándo queda la entrevista con ${n}?` });
  }
  if (s.etapaContacto === "entrevista_pactada" && s.fechaEntrevista && new Date(s.fechaEntrevista).getTime() < ahora) {
    const d = Math.floor(dias(s.fechaEntrevista));
    out.push({ tipo: d >= 2 ? "urgente" : "atencion", texto: `Entrevista hecha hace ${d} día${d === 1 ? "" : "s"}, sin informe`, pregunta: `¿Cómo te fue en la entrevista con ${n}? ¿Cuándo mandás el informe?` });
    if (!s.descargo?.trim()) out.push({ tipo: "atencion", texto: "Falta el descargo", pregunta: `Cargá el descargo de la entrevista con ${n}.` });
  }
  if (s.fechaLimite) {
    const faltan = Math.ceil((new Date(s.fechaLimite).getTime() - ahora) / DIA);
    if (faltan <= 2) out.push({ tipo: faltan < 0 ? "urgente" : "atencion", texto: faltan < 0 ? `Vencido hace ${-faltan} días` : `Vence en ${faltan} días`, pregunta: `El caso de ${n} ${faltan < 0 ? "está vencido" : "vence pronto"}: ¿qué falta para cerrarlo?` });
  }
  if (diferenciasDenuncia > 0) {
    out.push({ tipo: "atencion", texto: `${diferenciasDenuncia} diferencia${diferenciasDenuncia === 1 ? "" : "s"} entre denuncia y carátula`, pregunta: `En el caso de ${n} la denuncia no coincide con la carátula: preguntale al asegurado por esa diferencia.` });
  }
  // Pruebas que pide el ramo y todavía no están (solo una vez contactado:
  // antes no tiene sentido pedirlas).
  if (s.etapaContacto && s.etapaContacto !== "contacto_fallido") {
    const ramo = ramoDeTipo(s.tipo);
    const pedidas = seccionesExpediente(ramo).filter(x => ["denuncia", "documentacion", "digitales"].includes(x.id)).flatMap(x => x.categorias);
    const faltan = pedidas.filter(c => !categoriasCargadas.has(c));
    if (faltan.length) {
      const nombres = faltan.map(c => etiquetaCategoriaEvidencia(c, ramo));
      out.push({ tipo: "info", texto: `Faltan ${faltan.length} pruebas: ${nombres.slice(0, 4).join(", ")}${faltan.length > 4 ? "…" : ""}`, pregunta: `Para ${n} falta: ${nombres.join(", ")}. ¿Las podés conseguir?` });
    }
  }
  return out;
}

export async function datosParaPendientes(ids: string[]) {
  const categorias = new Map<string, Set<string>>();
  const diferencias = new Map<string, number>();
  const orden = new Map<string, number>();
  if (ids.length === 0) return { categorias, diferencias, orden };
  const db = getDb();
  try {
    await asegurarTablaEvidencia();
    const filas = await db.select({ id: evidencia.siniestroId, categoria: evidencia.categoria }).from(evidencia);
    for (const f of filas) {
      if (!f.categoria) continue;
      if (!categorias.has(f.id)) categorias.set(f.id, new Set());
      categorias.get(f.id)!.add(f.categoria);
    }
  } catch { /* sin evidencia: no se marcan faltantes */ }
  try {
    await asegurarTablaLecturaDenuncia();
    const res = await db.execute(sql`SELECT siniestro_id, datos FROM lectura_denuncia`);
    for (const r of res.rows as { siniestro_id: string; datos: { cotejo?: { coincide: boolean | null }[] } }[]) {
      diferencias.set(r.siniestro_id, (r.datos.cotejo ?? []).filter(c => c.coincide === false).length);
    }
  } catch { /* sin lecturas */ }
  try {
    await asegurarTablaPrioridad();
    const res = await db.execute(sql`SELECT siniestro_id, orden FROM prioridad_caso`);
    for (const r of res.rows as { siniestro_id: string; orden: number }[]) orden.set(r.siniestro_id, r.orden);
  } catch { /* sin prioridades */ }
  return { categorias, diferencias, orden };
}

// Solo el orden del admin (para el tablero del operador).
export async function ordenAdmin(): Promise<Record<string, number>> {
  try {
    await asegurarTablaPrioridad();
    const res = await getDb().execute(sql`SELECT siniestro_id, orden FROM prioridad_caso`);
    return Object.fromEntries((res.rows as { siniestro_id: string; orden: number }[]).map(r => [r.siniestro_id, r.orden]));
  } catch {
    return {};
  }
}
