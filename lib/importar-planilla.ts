import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siniestros, bitacora, usuarios } from "@/lib/db/schema";
import { asegurarEsquema } from "@/lib/db/asegurar-esquema";
import { calcularFacturacion } from "@/lib/facturacion";
import { normalizarTipo } from "@/lib/tipos-siniestro";
import { OPERADORES_EQUIPO } from "@/lib/equipo";

// Importación de las planillas de Excel que Dario llevaba a mano antes del
// CRM ("ATM ENVIADO" / "ATM PENDIENTE"): una fila = un caso. Columnas:
// EXPT, Ingresado, Nombre, Telefono, [ESTADO], COMP, Concepto, Elevado,
// Resultado, T Gestion, DOMICILIO, LOCALIDAD, DONDE OCURRE EL HECHO, KM, OPE.
// Sin documentación (no viene en la planilla): solo los datos.

export type FilaPlanilla = {
  hoja: string;
  fila: number;
  enviado: boolean;          // hoja de enviados (ya elevado a la aseguradora)
  nroSiniestro: string;
  fechaIngreso: string | null;
  nombre: string;
  telContacto: string | null;
  celContacto: string | null;
  compania: string;
  tipo: string | null;
  fechaElevado: string | null;
  resultadoTexto: string | null;
  resultado: string;
  estadoPlanilla: string | null;
  etapaContacto: string | null;
  fechaEntrevista: string | null;
  domicilio: string | null;
  lugar: string | null;
  km: number | null;
  operador: string | null;
};

const AUTOR = "Importación planilla";

function texto(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim().replace(/\s+/g, " ");
  return t ? t : null;
}

function clave(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

function pad(n: number) { return String(n).padStart(2, "0"); }

// Fechas de Excel: número de serie (lo normal), Date, o texto dd/mm/aaaa.
function fecha(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null;
}

function esIdem(t: string | null) { return !!t && /^idem\.?$/i.test(t.trim()); }
function esVacio(t: string | null) { return !t || /^[x?\-.]$/i.test(t.trim()); }

const RESULTADOS: Record<string, string> = {
  "SIN FRAUDE": "sin_fraude",
  "CON FRAUDE": "con_fraude",
  "POSIBLE FRAUDE": "posible_fraude",
  "DESISTE": "desistido",
  "DESISTIDO": "desistido",
  "RECHAZO": "rechazo",
  "RECHAZADO": "rechazo",
  "SIN COBERTURA": "sin_cobertura",
};

// Columna ESTADO de pendientes (texto libre) -> etapa de contacto del CRM.
function etapaDesdeEstado(estado: string | null): { etapa: string | null; entrevista: string | null } {
  if (!estado) return { etapa: null, entrevista: null };
  const e = clave(estado);
  const m = e.match(/ENTREVISTA\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  // Sin hora en la planilla: 9 de la mañana (hora argentina).
  if (m) return { etapa: "entrevista_pactada", entrevista: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}T09:00:00-03:00` };
  if (e.includes("BLOQUEO")) return { etapa: "contacto_fallido", entrevista: null };
  return { etapa: "contactado", entrevista: null };
}

export function leerPlanilla(buffer: ArrayBuffer): { filas: FilaPlanilla[]; avisos: string[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const filas: FilaPlanilla[] = [];
  const avisos: string[] = [];

  for (const hoja of wb.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], { header: 1, raw: true, defval: null });
    const iCab = matriz.findIndex(r => Array.isArray(r) && r.some(c => typeof c === "string" && clave(c) === "EXPT"));
    if (iCab < 0) { avisos.push(`Hoja "${hoja}": no tiene la columna EXPT, se saltea.`); continue; }
    const cab = (matriz[iCab] as unknown[]).map(c => (typeof c === "string" ? clave(c) : ""));
    const col = (nombre: string) => cab.indexOf(nombre);
    const c = {
      expt: col("EXPT"), ingresado: col("INGRESADO"), nombre: col("NOMBRE"), tel: col("TELEFONO"),
      estado: col("ESTADO"), comp: col("COMP"), concepto: col("CONCEPTO"), elevado: col("ELEVADO"),
      resultado: col("RESULTADO"), domicilio: col("DOMICILIO"), localidad: col("LOCALIDAD"),
      hecho: col("DONDE OCURRE EL HECHO"), km: col("KM"), ope: col("OPE"),
    };
    const enviado = !clave(hoja).includes("PENDIENTE");
    const val = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

    for (let i = iCab + 1; i < matriz.length; i++) {
      const r = matriz[i] as unknown[];
      const nro = texto(val(r, c.expt));
      if (!nro) continue;
      const nombre = texto(val(r, c.nombre)) ?? "";

      const tels = (texto(val(r, c.tel)) ?? "").split(/[-\/]/).map(t => t.trim()).filter(Boolean);
      const localidad = texto(val(r, c.localidad));
      let dom = texto(val(r, c.domicilio));
      let lugar = texto(val(r, c.hecho));
      if (esIdem(dom) && !esIdem(lugar) && !esVacio(lugar)) dom = lugar;
      if (esIdem(lugar)) lugar = dom;
      if (esVacio(lugar)) lugar = null;
      if (dom && localidad && !clave(dom).includes(clave(localidad))) dom = `${dom}, ${localidad}`;

      const resTxt = texto(val(r, c.resultado));
      const resultado = resTxt ? RESULTADOS[clave(resTxt)] ?? "pendiente" : "pendiente";
      if (resTxt && !RESULTADOS[clave(resTxt)]) avisos.push(`Fila ${i + 1} (${nro}): resultado "${resTxt}" no reconocido, queda pendiente.`);

      const estadoPlanilla = texto(val(r, c.estado));
      const { etapa, entrevista } = enviado
        ? { etapa: "informe_enviado", entrevista: null }
        : etapaDesdeEstado(estadoPlanilla);

      const kmRaw = val(r, c.km);
      const km = typeof kmRaw === "number" ? Math.round(kmRaw) : Number.parseInt(String(kmRaw ?? ""), 10);
      const tipo = normalizarTipo(texto(val(r, c.concepto)));

      filas.push({
        hoja, fila: i + 1, enviado,
        nroSiniestro: nro,
        fechaIngreso: fecha(val(r, c.ingresado)),
        nombre,
        telContacto: tels[0] ?? null,
        celContacto: tels[1] ?? null,
        compania: texto(val(r, c.comp))?.toUpperCase() ?? "ATM",
        tipo,
        fechaElevado: fecha(val(r, c.elevado)),
        resultadoTexto: resTxt,
        resultado,
        estadoPlanilla,
        etapaContacto: etapa,
        fechaEntrevista: entrevista,
        domicilio: dom,
        lugar,
        km: Number.isFinite(km) ? km : null,
        operador: texto(val(r, c.ope))?.toUpperCase() ?? null,
      });
    }
  }
  return { filas, avisos };
}

function claveCaso(compania: string | null, nro: string | null) {
  return `${(compania ?? "").toUpperCase()}|${nro ?? ""}`;
}

// Separa las filas nuevas de las que ya están cargadas (mismo N° de
// siniestro y compañía) o repetidas dentro del mismo archivo.
export async function clasificarFilas(filas: FilaPlanilla[]) {
  const nros = Array.from(new Set(filas.map(f => f.nroSiniestro)));
  const existentes = nros.length
    ? await getDb().select({ nro: siniestros.nroSiniestro, compania: siniestros.compania })
        .from(siniestros).where(inArray(siniestros.nroSiniestro, nros))
    : [];
  const vistos = new Set(existentes.map(e => claveCaso(e.compania, e.nro)));
  const nuevas: FilaPlanilla[] = [];
  const repetidas: FilaPlanilla[] = [];
  for (const f of filas) {
    const k = claveCaso(f.compania, f.nroSiniestro);
    if (vistos.has(k)) { repetidas.push(f); continue; }
    vistos.add(k);
    nuevas.push(f);
  }
  return { nuevas, repetidas };
}

export type CambioOperador = { operador: string; username: string; nombre: string; zona: string; accion: "actualizado" | "creado"; password?: string };

// Deja las cuentas de los operadores del equipo con su nombre completo y su
// zona; crea las que falten con una contraseña provisoria (se muestra una
// sola vez, el admin la cambia o se la pasa al operador).
export async function asegurarOperadoresEquipo(): Promise<CambioOperador[]> {
  const db = getDb();
  const cambios: CambioOperador[] = [];
  for (const op of OPERADORES_EQUIPO) {
    const [existente] = await db.select({ id: usuarios.id, username: usuarios.username })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "vendedor"), or(eq(usuarios.operador, op.operador), eq(usuarios.username, op.username))))
      .limit(1);
    if (existente) {
      await db.update(usuarios).set({ nombre: op.nombre, operador: op.operador, activo: true }).where(eq(usuarios.id, existente.id));
      await db.execute(sql`UPDATE usuarios SET zona = ${op.zona} WHERE id = ${existente.id}`);
      cambios.push({ operador: op.operador, username: existente.username, nombre: op.nombre, zona: op.zona, accion: "actualizado" });
      continue;
    }
    const [ocupado] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.username, op.username)).limit(1);
    const username = ocupado ? `${op.username}.${op.operador.toLowerCase()}` : op.username;
    const password = randomBytes(6).toString("base64url");
    const [creado] = await db.insert(usuarios).values({
      username, passwordHash: await bcrypt.hash(password, 10), nombre: op.nombre,
      rol: "vendedor", operador: op.operador, activo: true,
    }).returning({ id: usuarios.id });
    await db.execute(sql`UPDATE usuarios SET zona = ${op.zona} WHERE id = ${creado.id}`);
    cambios.push({ operador: op.operador, username, nombre: op.nombre, zona: op.zona, accion: "creado", password });
  }
  return cambios;
}

function fechaHora(dia: string | null): Date | undefined {
  return dia ? new Date(`${dia}T12:00:00-03:00`) : undefined;
}

export async function importarFilas(filas: FilaPlanilla[]) {
  await asegurarEsquema();
  const operadores = await asegurarOperadoresEquipo();
  const { nuevas, repetidas } = await clasificarFilas(filas);
  const db = getDb();

  let creados = 0;
  // De a tandas, para no armar un INSERT gigante contra Neon.
  for (let i = 0; i < nuevas.length; i += 25) {
    const tanda = nuevas.slice(i, i + 25);
    const rows = await db.insert(siniestros).values(tanda.map(f => ({
      nroSiniestro: f.nroSiniestro,
      compania: f.compania,
      tipo: f.tipo,
      asegurado: f.nombre || null,
      denunciante: f.nombre || null,
      telContacto: f.telContacto,
      celContacto: f.celContacto,
      domicilio: f.domicilio,
      fechaIngreso: f.fechaIngreso,
      lugarSiniestro: f.lugar ? { calle1: f.lugar } : null,
      // Los enviados ya se elevaron a la aseguradora: quedan cerrados (fuera
      // de las bandejas de trabajo) pero con su km y monto para facturar.
      estado: f.enviado ? "cerrado" : "en_gestion",
      resultado: f.resultado,
      fechaDesistido: f.resultado === "desistido" ? fechaHora(f.fechaElevado) ?? new Date() : null,
      etapaContacto: f.etapaContacto,
      fechaEntrevista: f.fechaEntrevista ? new Date(f.fechaEntrevista) : null,
      motivoContacto: f.etapaContacto === "contacto_fallido" ? f.estadoPlanilla : null,
      derivadoAdmin: f.etapaContacto === "contacto_fallido",
      derivadoEn: f.etapaContacto === "contacto_fallido" ? new Date() : null,
      kmTotal: f.km,
      facturar: calcularFacturacion(f.km),
      operador: f.operador,
      creadoEn: fechaHora(f.fechaIngreso),
    }))).returning({ id: siniestros.id });

    const notas = rows.flatMap((row, j) => {
      const f = tanda[j];
      const base = { siniestroId: row.id, autor: AUTOR, autorEsAdmin: true, leida: true };
      const out = [{ ...base, tipo: "nota", fecha: fechaHora(f.fechaIngreso), nota: `Caso cargado desde la planilla "${f.hoja}" (sin documentación).` }];
      if (f.enviado) {
        out.push({ ...base, tipo: "nota", fecha: fechaHora(f.fechaElevado), nota: `Elevado a ${f.compania}${f.resultadoTexto ? ` — resultado: ${f.resultadoTexto}` : ""}.` });
      } else if (f.estadoPlanilla) {
        out.push({ ...base, tipo: "nota", fecha: undefined, nota: `Estado en la planilla: ${f.estadoPlanilla}` });
      }
      return out;
    });
    if (notas.length) await db.insert(bitacora).values(notas);
    creados += rows.length;
  }

  return { creados, repetidas: repetidas.map(f => f.nroSiniestro), operadores };
}
