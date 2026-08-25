import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SiniestroRow } from "./db/schema";
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
