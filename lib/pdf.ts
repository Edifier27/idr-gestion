import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import type { SiniestroRow, EvidenciaRow, BitacoraRow } from "./db/schema";
import { desgloseFacturacion } from "./facturacion";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente, type Ramo } from "./categorias-evidencia";
import type { LecturaDenuncia } from "./leer-denuncia";

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
  espacio(c, 90); // que el título no quede solo al pie de la página
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
  // Respeta los saltos de línea del texto (el relato viene en bloques:
  // ampliación / denuncia); cada renglón se envuelve por separado.
  for (const renglon of texto.split(/\r?\n/)) {
    if (!renglon.trim()) { c.y -= size * 0.6; continue; }
    for (const linea of envolverTexto(sanear(renglon), c.font, size, ANCHO_UTIL)) {
      espacio(c, size + 4);
      c.page.drawText(linea, { x: MARGEN, y: c.y, size, font: c.font, color: INK });
      c.y -= size + 4;
    }
  }
  c.y -= 8;
}

// Texto del informe final: las líneas en MAYÚSCULAS (títulos de sección) van
// en negrita; el resto como párrafo.
function textoInforme(c: Cursor, texto: string) {
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t) { c.y -= 5; continue; }
    const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
    const esTitulo = letras.length > 3 && letras === letras.toUpperCase() && t.length < 160;
    if (esTitulo) {
      espacio(c, 40);
      for (const l of envolverTexto(sanear(t), c.bold, 10.5, ANCHO_UTIL)) {
        espacio(c, 15);
        c.page.drawText(l, { x: MARGEN, y: c.y, size: 10.5, font: c.bold, color: INK });
        c.y -= 15;
      }
      c.y -= 3;
    } else {
      parrafo(c, t, 10);
      c.y += 4;
    }
  }
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
  rechazo: { label: "RECHAZO", color: FRAUDE },
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

// Orientación EXIF de un JPEG (1 = derecha, 3 = 180°, 6 = girar 90° a la
// derecha, 8 = girar 90° a la izquierda). Las fotos del celular guardan los
// píxeles "acostados" y marcan acá cómo mostrarlas; pdf-lib no lo lee, por
// eso salían invertidas en el expediente.
function orientacionExif(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) return 1;
    const marca = bytes[i + 1];
    const largo = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marca === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
      const t = i + 10; // inicio del encabezado TIFF
      const le = bytes[t] === 0x49; // "II" = little endian
      const u16 = (o: number) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) => (le ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return 1;
    }
    if (marca === 0xda) return 1; // empieza la imagen: no hay EXIF
    i += 2 + largo;
  }
  return 1;
}

async function incrustarImagen(c: Cursor, row: EvidenciaRow, bytes: Uint8Array, maxH = 320) {
  const esPng = row.tipo === "image/png";
  const img = esPng ? await c.pdf.embedPng(bytes) : await c.pdf.embedJpg(bytes);
  const ori = esPng ? 1 : orientacionExif(bytes);
  const acostada = ori >= 5 && ori <= 8; // 5-8: el ancho y el alto se invierten al mostrarla
  const anchoVisto = acostada ? img.height : img.width;
  const altoVisto = acostada ? img.width : img.height;
  const scale = Math.min(ANCHO_UTIL / anchoVisto, maxH / altoVisto, 1);
  const dw = anchoVisto * scale, dh = altoVisto * scale; // caja tal como se ve
  const w = img.width * scale, h = img.height * scale;   // imagen sin girar
  espacio(c, dh + 20);
  const bx = MARGEN + (ANCHO_UTIL - dw) / 2; // centrada
  const by = c.y - dh;
  if (ori === 6 || ori === 5) c.page.drawImage(img, { x: bx, y: by + dh, width: w, height: h, rotate: degrees(-90) });
  else if (ori === 8 || ori === 7) c.page.drawImage(img, { x: bx + dw, y: by, width: w, height: h, rotate: degrees(90) });
  else if (ori === 3 || ori === 4) c.page.drawImage(img, { x: bx + dw, y: by + dh, width: w, height: h, rotate: degrees(180) });
  else c.page.drawImage(img, { x: bx, y: by, width: w, height: h });
  c.y = by - 4;
  const pie = sanear(row.nombre);
  const anchoPie = c.font.widthOfTextAtSize(pie, 7.5);
  c.page.drawText(pie, { x: MARGEN + Math.max(0, (ANCHO_UTIL - anchoPie) / 2), y: c.y - 6, size: 7.5, font: c.font, color: GREY });
  c.y -= 22;
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

async function volcarGrupo(c: Cursor, categoria: string, archivos: ArchivoConBytes[], ramo: Ramo | null) {
  const delGrupo = archivos.filter(a => (a.row.categoria ?? "otro") === categoria);
  if (delGrupo.length === 0) return;
  espacio(c, 200); // la etiqueta del grupo va en la misma hoja que su primera foto
  etiquetaGrupo(c, etiquetaCategoriaEvidencia(categoria, ramo));
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

// Mapita de una dirección (Google Static Maps, misma clave que el cálculo de
// km). Si la API no está habilitada o falla, el expediente sale igual, solo
// con la dirección escrita.
async function mapaDe(direccion: string): Promise<Uint8Array | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !direccion.trim()) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
    url.searchParams.set("center", direccion);
    url.searchParams.set("zoom", "16");
    url.searchParams.set("size", "640x320");
    url.searchParams.set("scale", "2");
    url.searchParams.set("markers", `color:red|${direccion}`);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/png")) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function bloqueDireccion(c: Cursor, titulo: string, direccion: string | null) {
  if (!direccion?.trim()) return;
  subtitulo(c, titulo);
  parrafo(c, direccion);
  const png = await mapaDe(direccion);
  if (png) {
    const fake = { nombre: direccion, tipo: "image/png" } as EvidenciaRow;
    await incrustarImagen(c, fake, png, 240).catch(() => {});
  }
}

/**
 * Expediente final del caso, en el orden que pidió Dario (23-nov-2026):
 * denuncia policial, siniestro (relato = ampliación + denuncia, descargo del
 * operador y cotejo), domicilio del asegurado y lugar del hecho con mapa,
 * inspección del vehículo (todas menos robo total), documentación del
 * asegurado y pruebas digitales según el ramo. Las fotos van centradas y
 * derechas, en el orden en que se subieron; los PDF adjuntos se copian
 * página a página; el resto (Word, HEIC, etc.) queda listado.
 */
export async function expedientePDF(s: SiniestroRow, archivosSinOrden: ArchivoConBytes[], notas: BitacoraRow[] = [], lectura: LecturaDenuncia | null = null, conInformeFinal = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const c: Cursor = { pdf, page: pdf.addPage(A4), y: 792, font, bold };
  const archivos = [...archivosSinOrden].sort((x, y) => new Date(x.row.creadoEn).getTime() - new Date(y.row.creadoEn).getTime());
  const ramo = ramoDeTipo(s.tipo);
  const secciones = seccionesExpediente(ramo);
  const tiene = (cats: string[]) => archivos.some(a => cats.includes(a.row.categoria ?? "otro"));
  const archivosDe = (id: string) => secciones.find(x => x.id === id)?.categorias ?? [];

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

  let n = 0;
  const titulo = (t: string) => tituloSeccion(c, `${++n}. ${t.toUpperCase()}`);

  // Con informe final (versión para la aseguradora, como el informe modelo
  // de Dario): va el informe y después las pruebas, sin las notas internas
  // (cotejo, bitácora, descargo en borrador).
  const informeFinal = conInformeFinal ? s.informeFinal?.trim() : null;
  if (informeFinal) {
    titulo("Informe de investigación");
    textoInforme(c, informeFinal);
  }

  // --- 1. Denuncia policial (y ampliación) ---
  if (tiene(archivosDe("denuncia")) || (lectura?.denuncia && !informeFinal)) {
    titulo("Denuncia policial");
    if (lectura?.denuncia && !informeFinal) parrafo(c, lectura.denuncia);
    for (const cat of archivosDe("denuncia")) await volcarGrupo(c, cat, archivos, ramo);
  }

  // --- 2. Siniestro: relato, descargo y cotejo (versión de trabajo) ---
  if (!informeFinal) {
    titulo("Siniestro");
    subtitulo(c, "Relato de la denuncia (ampliación del asegurado + denuncia del día del hecho)");
    parrafo(c, s.relatoDenuncia?.trim() || " ");
    if (lectura && lectura.cotejo.some(x => x.coincide === false)) {
      subtitulo(c, "Denuncia vs. datos del siniestro");
      for (const x of lectura.cotejo.filter(y => y.coincide === false)) {
        parrafo(c, `${x.dato}: siniestro "${x.siniestro ?? "—"}" / denuncia "${x.denuncia ?? "—"}"${x.nota ? ` (${x.nota})` : ""}`, 9);
      }
    }
    subtitulo(c, "Descargo del operador");
    parrafo(c, s.descargo?.trim() || "A completar.");
    subtitulo(c, "Cotejo denuncias / ampliación / relevado (informe técnico-legal)");
    parrafo(c, s.informe?.trim() || "Todavía no se generó el informe con IA.");
    if (notas.length > 0) {
      subtitulo(c, "Bitácora de gestiones");
      for (const nota of notas) parrafo(c, `${new Date(nota.fecha).toLocaleString("es-AR")} · ${nota.tipo}: ${nota.nota}`, 9);
    }
  }

  // --- 3. Domicilio del asegurado y lugar del hecho, con mapa ---
  if (s.domicilio || lugarTxt || tiene(archivosDe("lugar"))) {
    titulo("Domicilio y lugar del hecho");
    await bloqueDireccion(c, "Domicilio del asegurado", s.domicilio);
    await bloqueDireccion(c, "Lugar del hecho", lugarTxt);
    for (const cat of archivosDe("lugar")) await volcarGrupo(c, cat, archivos, ramo);
  }

  // --- 4 en adelante: inspección, documentación, pruebas digitales, otros ---
  for (const sec of secciones.filter(x => ["inspeccion", "documentacion", "digitales", "otros"].includes(x.id))) {
    if (!tiene(sec.categorias)) continue;
    titulo(sec.titulo);
    for (const cat of sec.categorias) await volcarGrupo(c, cat, archivos, ramo);
  }

  return pdf.save();
}
