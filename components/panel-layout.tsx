"use client";

import { useEffect, useState } from "react";
import { InboxPanel } from "@/components/inbox-panel";

const CLAVE = "crm_mostrar_mail";

export function PanelLayout({ esAdmin, operadoresExistentes, children }: { esAdmin: boolean; operadoresExistentes: string[]; children: React.ReactNode }) {
  const [mostrarMail, setMostrarMail] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CLAVE) === "1") setMostrarMail(true);
  }, []);

  function toggle() {
    setMostrarMail(m => {
      const next = !m;
      localStorage.setItem(CLAVE, next ? "1" : "0");
      return next;
    });
  }

  if (!esAdmin) return <>{children}</>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-sm text-slate">Mostrar mail</span>
        <button
          type="button"
          role="switch"
          aria-checked={mostrarMail}
          onClick={toggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${mostrarMail ? "bg-azul" : "bg-line"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${mostrarMail ? "translate-x-5" : "translate-x-1"}`} />
        </button>
      </div>

      {mostrarMail ? (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">{children}</div>
          {/* min-w-0 acá también: en mobile los dos hijos de este grid
              comparten una única columna implícita — sin min-w-0 en AMBOS,
              si el contenido de la bandeja no se achica, esa columna
              compartida se ensancha y rompe el responsive de toda la
              página, no solo del panel de mail. */}
          <div className="min-w-0 lg:sticky lg:top-6">
            <InboxPanel operadoresExistentes={operadoresExistentes} />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
