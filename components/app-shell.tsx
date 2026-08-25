"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

const CLAVE = "crm_sidebar_colapsado";

export function AppShell({ nombre, rol, children }: { nombre: string; rol: string; children: React.ReactNode }) {
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
    <div className={`min-h-screen bg-paper transition-[padding] duration-200 ${colapsado ? "md:pl-16" : "md:pl-56"}`}>
      <Sidebar nombre={nombre} rol={rol} colapsado={colapsado} onToggleColapsado={toggle} />
      {children}
    </div>
  );
}
