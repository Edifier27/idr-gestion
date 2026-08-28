import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { SiniestroRow, EvidenciaRow, BitacoraRow } from "./db/schema";
import { desgloseFacturacion } from "./facturacion";
import { etiquetaCategoriaEvidencia } from "./categorias-evidencia";

const INK = rgb(0.08, 0.11, 0.18);
const GREY = rgb(0.35, 0.38, 0.42);
const PAPER = rgb(0.965, 0.961, 0.945);
const OK = rgb(0.184, 0.490, 0.357);
const FRAUDE = rgb(0.698, 0.227, 0.227);
const AMBER = rgb(0.788, 0.565, 0.180);
const BLANCO = rgb(1, 1, 1);

async function baseDoc() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, page, font, bold };
}

/** Factura de honorarios + gastos para la aseguradora. */
export async function facturaPDF(s: SiniestroRow): Promise<Uint8Array> {
  const { pdf, page, font, bold } = await baseDoc();
  const d = desgloseFacturacion(s.kmTotal);
  let y = 790;
  const line = (t: string, f = font, size = 11, color = INK) => {
    page.drawText(sanear(t), { x: 50, y, size, font: f, color });
    y -= size + 8;
  };
  line("FACTURA DE HONORARIOS Y GASTOS", bold, 16);
  y -= 6;
  line(`Aseguradora: ${s.compania ?? "-"}`);
  line(`Siniestro: ${s.nroSiniestro ?? "-"}   Gestión: ${s.numeroGestion ?? "-"}`);
  line(`Asegurado: ${s.asegurado ?? "-"}`, font, 11, GREY);
  y -= 10;
  line("Detalle", bold, 12);
  line(`Km recorridos: ${d.kmTotal}  (bonificados: ${d.kmBonificados})`);
  line(`Km facturables: ${d.kmFacturables} x $650 = $${d.montoKm.toLocaleString("es-AR")}`);
  line(`Informe: $${d.montoInforme.toLocaleString("es-AR")}`);
  y -= 6;
  line(`TOTAL: $${d.total.toLocaleString("es-AR")}`, bold, 14);
  return pdf.save();
}

/** Carátula del siniestro con los datos del CRM. */
export async function caratulaPDF(s: SiniestroRow): Promise<Uint8Array> {
  const { pdf, page, font, bold } = await baseDoc();
  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
  let y = 790;
  const row = (k: string, v: string | null) => {
    page.drawText(sanear(k), { x: 50, y, size: 10, font: bold, color: GREY });
    page.drawText(sanear(v ?? "-"), { x: 200, y, size: 10, font, color: INK });
    y -= 20;
  };
  page.drawText("CARÁTULA DE SINIESTRO", { x: 50, y, size: 16, font: bold, color: INK });
  y -= 34;
  row("Cliente / Aseguradora", s.compania);
  row("N° Siniestro", s.nroSiniestro);
  row("N° Gestión", s.numeroGestion);
  row("Tipo", s.tipo);
  row("Póliza", s.poliza);
  row("Asegurado", s.asegurado);
  row("DNI", s.dni);
  row("Domicilio", s.domicilio);
  row("Fecha ocurrencia", s.fechaOcurrencia);
  row("Lugar del hecho", [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" "));
  row("Estado", s.estado);
  return pdf.save();
}

// Las fuentes estándar de pdf-lib (Helvetica) usan WinAnsiEncoding (cp1252):
// cualquier carácter fuera de ese rango — flechas, emojis, tildes "raras",
// símbolos que suele meter la IA en el texto libre (informe, descargo,
// relato) o un nombre de archivo con caracteres poco comunes — hace que
// page.drawText tire un error y rompa TODA la generación del PDF (ya pasó
// antes con "↳" y ahora con "→"). En vez de ir parcheando símbolo por
// símbolo cada vez que aparece uno nuevo, se sanea cualquier texto libre
// antes de dibujarlo: reemplaza los más comunes por su equivalente ASCII, y
// cualquier otro carácter fuera del rango seguro de WinAnsi por "?".
const REEMPLAZOS_TEXTO: Record<string, string> = {
  "→": "->", "←": "<-", "↔": "<->", "⇒": "=>", "↳": ">>", "↓": "v", "↑": "^",
  "✓": "OK", "✔": "OK", "✗": "X", "✘": "X", "★": "*", "…": "...",
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
};
function sanear(texto: string): string {
  let out = texto;
  for (const [k, v] of Object.entries(REEMPLAZOS_TEXTO)) out = out.split(k).join(v);
  // WinAnsi cubre ASCII imprimible (0x20-0x7E) y Latin-1 (0xA0-0xFF: tildes,
  // ñ, °, ¿, ¡, etc.) — cualquier código fuera de esos rangos se reemplaza.
  return Array.from(out).map(ch => {
    const cp = ch.codePointAt(0) ?? 0;
    return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) ? ch : "?";
  }).join("");
}

const A4: [number, number] = [595, 842];

function envolverTexto(texto: string, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, size: number, maxWidth: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && font.widthOfTextAtSize(prueba, size) > maxWidth) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

export type ArchivoConBytes = { row: EvidenciaRow; bytes: Uint8Array | null };

type FontDoc = Awaited<ReturnType<PDFDocument["embedFont"]>>;

// --- Maquetado del informe final: un "cursor" que va escribiendo de arriba
// hacia abajo y agrega página nueva sola cuando se queda sin espacio. Todo el
// texto va con el mismo margen (50px) para que quede prolijo.
type Cursor = { pdf: PDFDocument; page: PDFPage; y: number; font: FontDoc; bold: FontDoc };

const MARGEN = 50;
const ANCHO_UTIL = A4[0] - MARGEN * 2;

function nuevaPagina(c: Cursor) {
  c.page = c.pdf.addPage(A4);
  c.y = 792;
}

function espacio(c: Cursor, alto: number) {
  if (c.y - alto < 50) nuevaPagina(c);
}

function tituloSeccion(c: Cursor, texto: string) {
  espacio(c, 40);
  c.y -= 4;
  c.page.drawRectangle({ x: MARGEN, y: c.y - 4, width: ANCHO_UTIL, height: 1, color: INK });
  c.y -= 16;
  c.page.drawText(texto, { x: MARGEN, y: c.y, size: 13, font: c.bold, color: INK });
  c.y -= 22;
}

function subtitulo(c: Cursor, texto: string) {
  espacio(c, 26);
  c.page.drawText(texto, { x: MARGEN, y: c.y, size: 10.5, font: c.bold, color: GREY });
  c.y -= 17;
}

function parrafo(c: Cursor, texto: string, size = 10) {
  for (const linea of envolverTexto(sanear(texto), c.font, size, ANCHO_UTIL)) {
    espacio(c, size + 4);
    c.page.drawText(linea, { x: MARGEN, y: c.y, size, font: c.font, color: INK });
    c.y -= size + 4;
  }
  c.y -= 8;
}

/** Dos pares campo/valor en la misma fila, para que la ficha resumen no ocupe tanto alto. */
function filaDoble(c: Cursor, a: [string, string | null], b?: [string, string | null]) {
  espacio(c, 15);
  const escribir = (x: number, campo: string, valor: string | null) => {
    c.page.drawText(sanear(campo.toUpperCase()), { x, y: c.y, size: 7.5, font: c.bold, color: GREY });
    c.page.drawText(sanear(valor?.trim() || "—"), { x, y: c.y - 10, size: 9.5, font: c.font, color: INK });
  };
  escribir(MARGEN, a[0], a[1]);
  if (b) escribir(MARGEN + ANCHO_UTIL / 2, b[0], b[1]);
  c.y -= 26;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  ingresado: "Ingresado",
  en_gestion: "En gestión",
  inspeccionado: "Inspeccionado",
  elevado: "Elevado",
  facturado: "Facturado",
  cerrado: "Cerrado",
};

const CIERRE_INFO: Record<string, { label: string; color: ReturnType<typeof rgb> }> = {
  pendiente: { label: "PENDIENTE", color: GREY },
  sin_fraude: { label: "SIN FRAUDE", color: OK },
  con_fraude: { label: "FRAUDE", color: FRAUDE },
  posible_fraude: { label: "POSIBLE FRAUDE", color: AMBER },
  desistido: { label: "DESISTIDO", color: INK },
  sin_cobertura: { label: "SIN COBERTURA", color: INK },
};

function franjaClasificacion(c: Cursor, resultado: string) {
  const info = CIERRE_INFO[resultado] ?? CIERRE_INFO.pendiente;
  const h = 24;
  espacio(c, h + 10);
  c.page.drawRectangle({ x: MARGEN, y: c.y - h + 6, width: ANCHO_UTIL, height: h, color: info.color });
  c.page.drawText(`CLASIFICACIÓN DEL CASO: ${info.label}`, {
    x: MARGEN + 12, y: c.y - h + 14, size: 10, font: c.bold, color: BLANCO,
  });
  c.y -= h + 16;
}

/** Etiqueta de categoría de evidencia como pequeño chip, antes de listar sus archivos. */
function etiquetaGrupo(c: Cursor, texto: string) {
  espacio(c, 22);
  c.page.drawRectangle({ x: MARGEN, y: c.y - 2, width: ANCHO_UTIL, height: 16, color: PAPER });
  c.page.drawText(sanear(texto.toUpperCase()), { x: MARGEN + 6, y: c.y + 2, size: 8.5, font: c.bold, color: INK });
  c.y -= 22;
}

async function incrustarImagen(c: Cursor, row: EvidenciaRow, bytes: Uint8Array) {
  const img = row.tipo === "image/png" ? await c.pdf.embedPng(bytes) : await c.pdf.embedJpg(bytes);
  const maxW = ANCHO_UTIL, maxH = 320;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale, h = img.height * scale;
  espacio(c, h + 20);
  c.page.drawImage(img, { x: MARGEN, y: c.y - h, width: w, height: h });
  c.y -= h + 4;
  c.page.drawText(sanear(row.nombre), { x: MARGEN, y: c.y, size: 7.5, font: c.font, color: GREY });
  c.y -= 16;
}

async function incrustarPDF(c: Cursor, row: EvidenciaRow, bytes: Uint8Array) {
  espacio(c, 16);
  c.page.drawText(sanear(`» ${row.nombre} (PDF adjunto — páginas a continuación)`), {
    x: MARGEN, y: c.y, size: 8.5, font: c.font, color: GREY,
  });
  c.y -= 16;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }).catch(() => null);
  if (!doc) return;
  (await c.pdf.copyPages(doc, doc.getPageIndices())).forEach(p => c.pdf.addPage(p));
  nuevaPagina(c);
}

// Orden en el que se listan las categorías dentro de cada bloque, calcado del
// informe final real (Sección III "Pruebas digitales" primero, después
// "Documentación de los intervinientes").
const ORDEN_PRUEBAS = ["geolocalizacion", "llamadas", "mensajes", "fotos"] as const;
const ORDEN_DOCUMENTACION = ["registro_conducir", "dni", "cedula_vehiculo", "denuncia", "ampliacion", "desiste", "otro"] as const;

async function volcarGrupo(c: Cursor, categoria: string, archivos: ArchivoConBytes[]) {
  const delGrupo = archivos.filter(a => (a.row.categoria ?? "otro") === categoria);
  if (delGrupo.length === 0) return;
  etiquetaGrupo(c, etiquetaCategoriaEvidencia(categoria));
  for (const { row, bytes } of delGrupo) {
    if (!bytes) {
      espacio(c, 14);
      c.page.drawText(sanear(`· ${row.nombre} (no se pudo descargar)`), { x: MARGEN, y: c.y, size: 9, font: c.font, color: GREY });
      c.y -= 16;
      continue;
    }
    if (row.tipo === "image/jpeg" || row.tipo === "image/png") await incrustarImagen(c, row, bytes);
    else if (row.tipo === "application/pdf") await incrustarPDF(c, row, bytes);
    else {
      espacio(c, 14);
      c.page.drawText(sanear(`· ${row.nombre} (descargar desde el CRM)`), { x: MARGEN, y: c.y, size: 9, font: c.font, color: GREY });
      c.y -= 16;
    }
  }
}

/**
 * Informe final del caso, con la misma estructura que usan en los informes
 * reales que se le mandan a la aseguradora: ficha resumen + clasificación,
 * resumen de los hechos denunciados, fundamentación y conclusión (ampliación
 * del operador + bitácora + cotejo con IA), y evidencia agrupada por
 * categoría (pruebas digitales primero, documentación de los intervinientes
 * después). Las fotos se incrustan, los PDF adjuntos se copian página a
 * página; el resto (Word, HEIC, etc.) queda listado para bajar desde el CRM.
 */
export async function expedientePDF(s: SiniestroRow, archivos: ArchivoConBytes[], notas: BitacoraRow[] = []): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const c: Cursor = { pdf, page: pdf.addPage(A4), y: 792, font, bold };

  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
  const lugarTxt = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" ");

  // --- Portada / ficha resumen ---
  c.page.drawText("IDR GESTIÓN", { x: MARGEN, y: c.y, size: 18, font: bold, color: INK });
  c.y -= 16;
  c.page.drawText("Informe final de investigación de siniestro", { x: MARGEN, y: c.y, size: 10, font, color: GREY });
  c.y -= 24;

  franjaClasificacion(c, s.resultado);

  filaDoble(c, ["Aseguradora", s.compania], ["Rama", s.rama]);
  filaDoble(c, ["N° de siniestro", s.nroSiniestro], ["N° de gestión", s.numeroGestion]);
  filaDoble(c, ["Tipo", s.tipo], ["Póliza", s.poliza]);
  filaDoble(c, ["Asegurado", s.asegurado], ["DNI", s.dni]);
  filaDoble(c, ["Domicilio", s.domicilio], ["Contacto", s.telContacto ?? s.celContacto ?? s.emailContacto]);
  filaDoble(c, ["Fecha de ocurrencia", [s.fechaOcurrencia, s.horaOcurrencia].filter(Boolean).join(" ")], ["Lugar del hecho", lugarTxt]);
  filaDoble(c, ["Operador asignado", s.operador], ["Estado actual", ETIQUETAS_ESTADO[s.estado] ?? s.estado]);
  filaDoble(c, ["Vencimiento de gestión", s.fechaLimite], ["Última actualización", new Date(s.actualizadoEn).toLocaleDateString("es-AR")]);

  // --- I. Resumen de los hechos denunciados ---
  tituloSeccion(c, "I. RESUMEN DE LOS HECHOS DENUNCIADOS");
  parrafo(c, s.relatoDenuncia?.trim() || "A completar.");

  // --- II. Fundamentación y conclusión ---
  tituloSeccion(c, "II. FUNDAMENTACIÓN Y CONCLUSIÓN");
  subtitulo(c, "Descargo / ampliación del operador");
  parrafo(c, s.descargo?.trim() || "A completar.");

  if (notas.length > 0) {
    subtitulo(c, "Bitácora de gestiones");
    for (const n of notas) {
      parrafo(c, `${new Date(n.fecha).toLocaleString("es-AR")} · ${n.tipo}: ${n.nota}`, 9);
    }
  }

  subtitulo(c, "Cotejo denuncia vs. relevado (informe técnico-legal)");
  parrafo(c, s.informe?.trim() || "Todavía no se generó el informe con IA.");

  // --- III. Desarrollo: pruebas digitales ---
  const hayPruebas = archivos.some(a => (ORDEN_PRUEBAS as readonly string[]).includes(a.row.categoria ?? "otro"));
  if (hayPruebas) {
    tituloSeccion(c, "III. DESARROLLO — PRUEBAS DIGITALES");
    for (const cat of ORDEN_PRUEBAS) await volcarGrupo(c, cat, archivos);
  }

  // --- Documentación de los intervinientes ---
  // ORDEN_DOCUMENTACION incluye "otro" como catch-all, así que junto con
  // ORDEN_PRUEBAS cubre cualquier valor posible de categoría (incluida null,
  // que volcarGrupo normaliza a "otro") — no queda ningún archivo afuera.
  const hayDocumentacion = archivos.some(a => (ORDEN_DOCUMENTACION as readonly string[]).includes(a.row.categoria ?? "otro"));
  if (hayDocumentacion) {
    tituloSeccion(c, "DOCUMENTACIÓN DE LOS INTERVINIENTES");
    for (const cat of ORDEN_DOCUMENTACION) await volcarGrupo(c, cat, archivos);
  }

  return pdf.save();
}
