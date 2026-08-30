import { tarjetaElevada } from "@/lib/ui";
import { mapsUrl } from "@/lib/contacto";

// Mapa embebido de la dirección del caso — a Dario se le ocurrió que además
// del botón que abre Google Maps en otra pestaña, quede un cuadro con el
// mapa a la vista directo en el CRM. Usa el embed público de Google Maps
// (maps?...&output=embed): no hace falta API key ni tocar variables de
// entorno — la que ya está cargada (GOOGLE_MAPS_API_KEY) es server-only,
// para el cálculo de km, y no convenía exponerla al cliente solo para esto.
export function MapaEmbed({ direccion }: { direccion: string | null }) {
  if (!direccion || !direccion.trim()) return null;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;
  const linkExterno = mapsUrl(direccion);
  return (
    <div className={`overflow-hidden ${tarjetaElevada}`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate" title={direccion}>📍 {direccion}</p>
        {linkExterno && (
          <a href={linkExterno} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] font-medium text-ok hover:underline">
            Abrir en Maps ↗
          </a>
        )}
      </div>
      <iframe
        title={`Mapa: ${direccion}`}
        src={src}
        className="h-40 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
