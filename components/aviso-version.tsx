"use client";

import { useEffect, useState } from "react";

// Cuando se publica un cambio, las pestañas que ya estaban abiertas siguen con
// la versión vieja. Esto consulta cada minuto (y al volver a la pestaña) qué
// versión está publicada y, si cambió, muestra el botón "Actualizar".
const MIA = process.env.NEXT_PUBLIC_VERSION ?? "dev";

export function AvisoVersion() {
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    if (MIA === "dev") return;
    let vivo = true;
    const revisar = async () => {
      const r = await fetch("/api/version", { cache: "no-store" }).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (vivo && d?.version && d.version !== "dev" && d.version !== MIA) setNueva(true);
    };
    revisar();
    const t = setInterval(revisar, 60_000);
    const alVolver = () => { if (document.visibilityState === "visible") revisar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, []);

  if (!nueva) return null;
  return (
    <div className="fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">
      <span>Hay una versión nueva del CRM con cambios.</span>
      <button onClick={() => window.location.reload()} className="rounded-full bg-azul px-3 py-1 text-xs font-semibold text-paper hover:opacity-90">Actualizar</button>
    </div>
  );
}
