import { asc, eq, sql } from "drizzle-orm";
import { AlignmentType, Document, ImageRun, LevelFormat, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { getDb } from "@/lib/db";
import { siniestros, evidencia, type SiniestroRow } from "@/lib/db/schema";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarEstadoInformeFinal } from "@/lib/db/asegurar-informe-final-estado";
import type { ItemAnexo } from "@/lib/informe-final";

// Legajo final en Word, como el que se manda a la aseguradora (modelo: stro
// 571673 de ATM): título del siniestro, relato del operador, el informe final
// y el anexo con una prueba por página y su título abajo (DP, Lugar del hecho,
// Llaves, Geo, Palabras filtro…). Las fotos se enderezan según el celular
// (EXIF) y los PDF se pasan a imagen página por página. En Word para que se
// pueda retocar antes de mandarlo.

// Títulos del anexo, con los nombres que usa el estudio.
const TITULO_ANEXO: Record<string, string> = {
  denuncia: "DP",
  ampliacion: "Ampliación del asegurado",
  foto_lugar: "Lugar del hecho",
  foto_siniestro: "Inspección del vehículo",
  dni: "DNI",
  dni_conductor: "DNI del conductor",
  registro_conducir: "Registro de conducir",
  cedula_vehiculo: "Cédula del vehículo",
  geolocalizacion: "Geo",
  llamadas: "Registro de llamadas",
  mensajes: "Conversaciones",
  palabras_clave: "Palabras filtro",
  foto_momento: "Fotos del momento del hecho",
  foto_previa: "Imagen previa del vehículo",
  llave: "Llaves",
  vtv: "VTV",
  recibo_sueldo: "Recibo de sueldo",
  desiste: "Desistimiento",
  fotos: "Fotos",
  otro: "Otros",
};

// Orden fijo del Word modelo, para los casos sin el orden que arma la IA.
const ORDEN_MODELO = [
  "ampliacion", "dni", "dni_conductor", "cedula_vehiculo", "registro_conducir", "denuncia", "llave",
  "foto_lugar", "foto_siniestro", "foto_momento", "llamadas", "foto_previa", "geolocalizacion",
  "palabras_clave", "mensajes", "vtv", "recibo_sueldo", "desiste", "fotos", "otro",
];

// Página A4 con los márgenes del modelo: 15 cm de ancho útil y ~24 de alto.
const ANCHO_MAX = 566, ALTO_MAX = 860;
const LADO_MAX_PX = 1600;
const MAX_PAGINAS_PDF = 10;

type Imagen = { data: Uint8Array; w: number; h: number };

// Lee la prueba con MuPDF (fotos, capturas y PDF) y devuelve JPEG ya
// derechos, con el tamaño acotado para que el Word no pese de más.
async function aImagenes(bytes: Uint8Array, tipo: string, nombre: string): Promise<Imagen[]> {
  const mupdf = await import("mupdf");
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  const mime = tipo === "application/pdf" || ext === "pdf" ? "application/pdf"
    : tipo.startsWith("image/") ? tipo
    : ["jpg", "jpeg", "jfif"].includes(ext) ? "image/jpeg"
    : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : null;
  if (!mime) return [];
  const doc = mupdf.Document.openDocument(bytes, mime);
  const out: Imagen[] = [];
  const paginas = Math.min(doc.countPages(), MAX_PAGINAS_PDF);
  for (let i = 0; i < paginas; i++) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    const base = mime === "application/pdf" ? 2 : 96 / 72; // PDF a ~144 dpi; foto a su tamaño real
    const esc = Math.min(base, LADO_MAX_PX / Math.max(x1 - x0, y1 - y0));
    const pix = page.toPixmap(mupdf.Matrix.scale(esc, esc), mupdf.ColorSpace.DeviceRGB, false, true);
    out.push({ data: pix.asJPEG(80), w: pix.getWidth(), h: pix.getHeight() });
  }
  return out;
}

const negrita = (t: string) => new TextRun({ text: t, bold: true });

// El informe es texto plano (títulos en mayúsculas, viñetas con "- "): se pasa
// a párrafos de Word con las negritas del modelo.
function parrafosDelInforme(texto: string): Paragraph[] {
  const salida: Paragraph[] = [];
  for (const crudo of texto.replace(/\*\*/g, "").split("\n")) {
    const linea = crudo.trimEnd();
    if (!linea.trim()) continue;
    const t = linea.trim();
    const vineta = /^[-•]\s+/.test(t);
    const cuerpo = vineta ? t.replace(/^[-•]\s+/, "") : t;
    const titulo = /^\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(cuerpo) || /^(INFORME DE INVESTIGACI|ACTA DE DECLARACI)/.test(cuerpo);
    const subtitulo = !vineta && cuerpo.endsWith(":") && cuerpo.length < 120;
    const rotulo = cuerpo.match(/^([^:]{3,60}):\s+(.+)$/);
    const runs = titulo || subtitulo ? [negrita(cuerpo)]
      : rotulo ? [negrita(`${rotulo[1]}: `), new TextRun(rotulo[2])]
      : [new TextRun(cuerpo)];
    salida.push(new Paragraph({
      children: runs,
      numbering: vineta ? { reference: "vinetas", level: 0 } : undefined,
      spacing: { before: titulo ? 240 : 0, after: 120 },
    }));
  }
  return salida;
}

export async function construirLegajoWord(siniestroId: string): Promise<{ siniestro: SiniestroRow; bytes: Buffer } | null> {
  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, siniestroId));
  if (!s) return null;
  await asegurarTablaEvidencia();
  const filas = await db.select().from(evidencia).where(eq(evidencia.siniestroId, s.id)).orderBy(asc(evidencia.creadoEn));
  // Orden del anexo: el que armó la IA siguiendo el relato (con un título por
  // prueba); si no hay, el del Word modelo. La carátula y el certificado de la
  // aseguradora no van (no están en el modelo).
  await asegurarEstadoInformeFinal();
  const guardado = ((await db.execute(sql`SELECT informe_final_anexo AS anexo FROM siniestros WHERE id = ${s.id}`)).rows[0] as { anexo: ItemAnexo[] | null } | undefined)?.anexo ?? [];
  const posicion = new Map(guardado.map((x, i) => [x.id, i]));
  const tituloIA = new Map(guardado.map(x => [x.id, x.titulo]));
  const pruebas = filas
    .filter(f => !/^(caratula|certif)/i.test(f.nombre))
    .map(f => ({ f, cat: f.categoria && ORDEN_MODELO.includes(f.categoria) ? f.categoria : "otro" }))
    .sort((a, b) => {
      const pa = posicion.get(a.f.id), pb = posicion.get(b.f.id);
      if (pa !== undefined || pb !== undefined) return (pa ?? 999) - (pb ?? 999);
      return ORDEN_MODELO.indexOf(a.cat) - ORDEN_MODELO.indexOf(b.cat);
    });

  // Se bajan todas a la vez (más rápido que de a una).
  const conBytes = await Promise.all(pruebas.map(async ({ f, cat }) => {
    let bytes: Uint8Array | null = null;
    try {
      const r = await fetch(f.url);
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
    } catch { /* la prueba que no se puede leer se nombra igual */ }
    return { bytes, tipo: f.tipo, nombre: f.nombre, cat, tituloIa: tituloIA.get(f.id) };
  }));

  const compania = (s.compania ?? "").replace(/\s*seguros?\s*/i, " ").trim() || "";
  const titulo = ["Stro", s.nroSiniestro ?? s.numeroGestion ?? "", s.asegurado ?? s.denunciante ?? "", compania].filter(Boolean).join(" ");
  const bytes = await armarDocx({ titulo, descargo: s.descargo, informe: s.informeFinal, pruebas: conBytes });
  return { siniestro: s, bytes };
}

export type PruebaLegajo = { bytes: Uint8Array | null; tipo: string; nombre: string; cat: string; tituloIa?: string };

export async function armarDocx(d: { titulo: string; descargo: string | null; informe: string | null; pruebas: PruebaLegajo[] }): Promise<Buffer> {
  const anexo: Paragraph[] = [];
  let categoriaAnterior = "";
  for (const { bytes, tipo, nombre, cat, tituloIa } of d.pruebas) {
    let imagenes: Imagen[] = [];
    try {
      if (bytes) imagenes = await aImagenes(bytes, tipo, nombre);
    } catch { /* formato que no se puede leer: se nombra igual */ }
    const tituloCat = tituloIa || (TITULO_ANEXO[cat] ?? "Otros");
    imagenes.forEach((img, i) => {
      const esc = Math.min(ANCHO_MAX / img.w, ALTO_MAX / img.h, 1);
      anexo.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: anexo.length > 0,
        children: [new ImageRun({ type: "jpg", data: img.data, transformation: { width: Math.round(img.w * esc), height: Math.round(img.h * esc) } })],
      }));
      // El título va abajo, como en el modelo: en la primera página de cada
      // grupo, y en las páginas de un PDF largo, una sola vez al final.
      const ultimaDelArchivo = i === imagenes.length - 1;
      // Con título de la IA, cada prueba lleva el suyo; con el genérico, uno por grupo.
      if (ultimaDelArchivo && (tituloIa ? tituloCat !== categoriaAnterior : cat !== categoriaAnterior)) {
        anexo.push(new Paragraph({ children: [new TextRun({ text: tituloCat, size: 20 })], spacing: { before: 80 } }));
        categoriaAnterior = tituloIa ? tituloCat : cat;
      }
    });
    if (!imagenes.length) {
      anexo.push(new Paragraph({ children: [new TextRun({ text: `${tituloCat}: ${nombre} (se adjunta aparte)`, italics: true, size: 20 })], spacing: { after: 120 } }));
    }
  }

  const titulo = d.titulo;
  const cuerpo: Paragraph[] = [
    new Paragraph({ children: [negrita(titulo)], spacing: { after: 120 } }),
    ...(d.descargo ?? "").split("\n").filter(l => l.trim()).map(l => new Paragraph({ children: [new TextRun(l.trim())], spacing: { after: 120 } })),
    new Paragraph({ children: [], spacing: { after: 120 } }),
    ...parrafosDelInforme(d.informe ?? "(Todavía no se generó el informe final.)"),
  ];
  if (anexo.length) cuerpo.push(new Paragraph({ children: [new PageBreak()] }));

  const doc = new Document({
    creator: "IDR Gestión",
    title: titulo,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: { config: [{ reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1701, bottom: 1417, left: 1701 } } },
      children: [...cuerpo, ...anexo],
    }],
  });
  return Packer.toBuffer(doc);
}
