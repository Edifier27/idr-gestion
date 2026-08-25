import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SiniestroRow, EvidenciaRow } from "./db/schema";
import { desgloseFacturacion } from "./facturacion";

const INK = rgb(0.08, 0.11, 0.18);
const GREY = rgb(0.35, 0.38, 0.42);

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
    page.drawText(t, { x: 50, y, size, font: f, color });
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
    page.drawText(k, { x: 50, y, size: 10, font: bold, color: GREY });
    page.drawText(v ?? "-", { x: 200, y, size: 10, font, color: INK });
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

function agregarBloqueTexto(pdf: PDFDocument, titulo: string, texto: string, font: FontDoc, bold: FontDoc) {
  let page = pdf.addPage(A4);
  let y = 792;
  page.drawText(titulo, { x: 50, y, size: 14, font: bold, color: INK });
  y -= 30;
  for (const linea of envolverTexto(texto, font, 10, 495)) {
    if (y < 50) { page = pdf.addPage(A4); y = 792; }
    page.drawText(linea, { x: 50, y, size: 10, font, color: INK });
    y -= 14;
  }
}

/**
 * Expediente completo: carátula → descargo → informe técnico-legal → fotos
 * → documental. Las fotos van como JPG/PNG (lo único que pdf-lib puede
 * incrustar); el resto de los adjuntos (Word, HEIC, etc.) quedan listados
 * al final, no incrustados — siguen disponibles para descargar desde el CRM.
 */
export async function expedientePDF(s: SiniestroRow, archivos: ArchivoConBytes[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const bold = await merged.embedFont(StandardFonts.HelveticaBold);

  // 1. Carátula
  const caratula = await PDFDocument.load(await caratulaPDF(s));
  (await merged.copyPages(caratula, caratula.getPageIndices())).forEach(p => merged.addPage(p));

  // 2. Descargo (relato del vendedor)
  if (s.descargo?.trim()) {
    agregarBloqueTexto(merged, "DESCARGO", s.descargo, font, bold);
  }

  // 3. Informe técnico-legal
  if (s.informe?.trim()) {
    agregarBloqueTexto(merged, "INFORME TÉCNICO-LEGAL", s.informe, font, bold);
  }

  // 4. Fotos (solo JPG/PNG, que es lo que pdf-lib sabe incrustar)
  const fotos = archivos.filter(a => (a.row.tipo === "image/jpeg" || a.row.tipo === "image/png") && a.bytes);
  if (fotos.length > 0) {
    merged.addPage(A4).drawText("FOTOGRAFÍAS", { x: 50, y: 792, size: 14, font: bold, color: INK });
    for (const { row, bytes } of fotos) {
      const img = row.tipo === "image/png" ? await merged.embedPng(bytes!) : await merged.embedJpg(bytes!);
      const maxW = 495, maxH = 700;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      const page = merged.addPage(A4);
      page.drawImage(img, { x: (A4[0] - w) / 2, y: 792 - h, width: w, height: h });
      page.drawText(row.nombre, { x: 50, y: 792 - h - 18, size: 8, font, color: GREY });
    }
  }

  // 5. Documental (otros PDFs adjuntos, se copian tal cual)
  const documentos = archivos.filter(a => a.row.tipo === "application/pdf" && a.bytes);
  if (documentos.length > 0) {
    merged.addPage(A4).drawText("DOCUMENTAL", { x: 50, y: 792, size: 14, font: bold, color: INK });
    for (const { bytes } of documentos) {
      const doc = await PDFDocument.load(bytes!, { ignoreEncryption: true });
      (await merged.copyPages(doc, doc.getPageIndices())).forEach(p => merged.addPage(p));
    }
  }

  // Adjuntos que no se pudieron incrustar (Word, HEIC, etc.) — quedan listados.
  const otros = archivos.filter(a => !fotos.includes(a) && !documentos.includes(a));
  if (otros.length > 0) {
    const page = merged.addPage(A4);
    let y = 792;
    page.drawText("OTROS ADJUNTOS (descargar desde el CRM)", { x: 50, y, size: 12, font: bold, color: INK });
    y -= 24;
    for (const { row } of otros) {
      page.drawText(`· ${row.nombre}`, { x: 50, y, size: 10, font, color: GREY });
      y -= 16;
    }
  }

  return merged.save();
}
