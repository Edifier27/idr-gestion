import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDR Gestión · Investigación de siniestros",
  description: "Informes e investigaciones de siniestros para compañías aseguradoras.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
