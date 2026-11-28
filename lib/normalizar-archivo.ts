// Formatos de imagen "raros" pasados a JPG al subirlos, para que se vean en
// el CRM, en el visor, en el PDF del legajo y los pueda leer la IA:
// .jfif/.jpe (ya son JPEG: solo se corrige el tipo y la extensión), .heic/.heif
// (fotos de iPhone), .webp, .avif, .bmp, .tif/.tiff y .gif. Las fotos salen
// derechas (EXIF). Si algo falla, el archivo queda como vino.

export type ArchivoNormalizado = { bytes: Uint8Array; nombre: string; tipo: string; convertido: boolean };

const JPEG = ["jpg", "jpeg", "jfif", "jpe", "pjpeg", "pjp"];
const CONVERTIR = ["heic", "heif", "webp", "avif", "bmp", "tif", "tiff", "gif"];

const extension = (nombre: string) => (nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
const conJpg = (nombre: string) => (/\.[a-z0-9]+$/i.test(nombre) ? nombre.replace(/\.[a-z0-9]+$/i, ".jpg") : `${nombre}.jpg`);

function esJpeg(b: Uint8Array) { return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }
function esHeic(b: Uint8Array) {
  const marca = String.fromCharCode(...Array.from(b.slice(4, 12)));
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(marca);
}

/** ¿Hace falta revisarlo? (sin bajar el archivo): todo lo que no es JPG, PNG ni PDF bien marcado. */
export function hayQueNormalizar(nombre: string, tipo: string) {
  const ext = extension(nombre);
  if (tipo === "application/pdf" || ext === "pdf") return false;
  if (tipo === "image/png" && ext === "png") return false;
  if (tipo === "image/jpeg" && (ext === "jpg" || ext === "jpeg")) return false;
  return JPEG.includes(ext) || CONVERTIR.includes(ext) || tipo.startsWith("image/") || tipo === "application/octet-stream";
}

export async function normalizarArchivo(bytes: Uint8Array, nombre: string, tipo: string): Promise<ArchivoNormalizado> {
  const ext = extension(nombre);
  try {
    // Ya es JPEG por dentro (.jfif, .jpe, o subido como "octet-stream"): solo el tipo y la extensión.
    if (esJpeg(bytes)) {
      const cambia = tipo !== "image/jpeg" || !["jpg", "jpeg"].includes(ext);
      return { bytes, nombre: cambia ? conJpg(nombre) : nombre, tipo: "image/jpeg", convertido: cambia };
    }
    if (esHeic(bytes) || ext === "heic" || ext === "heif") {
      const convertir = (await import("heic-convert")).default as unknown as (o: { buffer: Buffer; format: "JPEG"; quality: number }) => Promise<ArrayBuffer>;
      const salida = new Uint8Array(await convertir({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.88 }));
      return { bytes: salida, nombre: conJpg(nombre), tipo: "image/jpeg", convertido: true };
    }
    if (CONVERTIR.includes(ext) || (tipo.startsWith("image/") && !["image/png", "image/jpeg"].includes(tipo))) {
      let salida: Uint8Array;
      try {
        const sharp = (await import("sharp")).default;
        salida = new Uint8Array(await sharp(Buffer.from(bytes), { animated: false }).rotate().jpeg({ quality: 88 }).toBuffer());
      } catch {
        // BMP y otros que sharp no lee: MuPDF.
        const mupdf = await import("mupdf");
        const mime = ext === "bmp" ? "image/bmp" : ext.startsWith("tif") ? "image/tiff" : ext === "gif" ? "image/gif" : tipo;
        const pix = mupdf.Document.openDocument(bytes, mime).loadPage(0).toPixmap(mupdf.Matrix.scale(96 / 72, 96 / 72), mupdf.ColorSpace.DeviceRGB, false, true);
        salida = pix.asJPEG(88);
      }
      return { bytes: salida, nombre: conJpg(nombre), tipo: "image/jpeg", convertido: true };
    }
  } catch {
    // formato que no se pudo convertir: queda como vino
  }
  return { bytes, nombre, tipo, convertido: false };
}
