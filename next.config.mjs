/** @type {import('next').NextConfig} */
const nextConfig = {
  // MuPDF (WebAssembly) se carga desde node_modules en el servidor, sin empaquetar.
  experimental: { serverComponentsExternalPackages: ["mupdf"] },
};
export default nextConfig;
