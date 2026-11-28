/** @type {import('next').NextConfig} */
const nextConfig = {
  // MuPDF (WebAssembly) se carga desde node_modules en el servidor, sin empaquetar.
  experimental: { serverComponentsExternalPackages: ["mupdf"] },
  // Versión con la que se armó esta página: si la que está publicada es otra,
  // el CRM muestra "Hay una versión nueva — Actualizar" (components/aviso-version.tsx).
  env: { NEXT_PUBLIC_VERSION: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
};
export default nextConfig;
