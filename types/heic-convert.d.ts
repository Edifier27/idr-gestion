// heic-convert no trae tipos: lo que usa lib/normalizar-archivo.ts.
declare module "heic-convert" {
  const convertir: (o: { buffer: Buffer; format: "JPEG" | "PNG"; quality?: number }) => Promise<ArrayBuffer>;
  export default convertir;
}
