"use client";

import { useEffect, useState } from "react";
import { InboxPanel } from "@/components/inbox-panel";

const CLAVE = "crm_mostrar_mail";

export function PanelLayout({ esAdmin, children }: { esAdmin: boolean; children: React.ReactNode }) {
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
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${mostrarMail ? "bg-ink" : "bg-line"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${mostrarMail ? "translate-x-5" : "translate-x-1"}`} />
        </button>
      </div>

      {mostrarMail ? (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">{children}</div>
          <div className="lg:sticky lg:top-6">
            <InboxPanel />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
