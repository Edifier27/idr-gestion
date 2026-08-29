"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { NotificacionesHost } from "@/components/notificaciones";

const CLAVE = "crm_sidebar_colapsado";

export function AppShell({ nombre, rol, derivados = 0, children }: { nombre: string; rol: string; derivados?: number; children: React.ReactNode }) {
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CLAVE) === "1") setColapsado(true);
  }, []);

  function toggle() {
    setColapsado(c => {
      const next = !c;
      localStorage.setItem(CLAVE, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className={`relative min-h-screen bg-paper transition-[padding] duration-200 ${colapsado ? "md:pl-16" : "md:pl-56"}`}>
      {/* Fondo decorativo: dos manchas de color muy tenues, fijas al viewport,
          para que el CRM no se sienta un formulario plano. No interactivo ni
          parte del layout (position: fixed + pointer-events-none). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-ink/[0.04] blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-amber/[0.06] blur-3xl" />
      </div>
      <Sidebar nombre={nombre} rol={rol} derivados={derivados} colapsado={colapsado} onToggleColapsado={toggle} />
      {children}
      <NotificacionesHost />
    </div>
  );
}
