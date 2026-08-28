"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { etiquetaRol } from "@/lib/roles";

// "quick" distingue entre los dos accesos directos a /panel: Tablero abre en
// la bandeja de hoy, Cerrados manda directo a la pestaña de casos cerrados
// (mismo query param que ya lee TablaSiniestros al montar). undefined = sin
// query — cualquier otra pestaña activada a mano no rompe el resaltado.
const NAV = [
  { href: "/panel", label: "Tablero", icon: IconGrid, soloAdmin: false, quick: undefined as string | undefined },
  { href: "/panel?quick=cerrados", label: "Cerrados", icon: IconArchive, soloAdmin: false, quick: "cerrados" },
  { href: "/admin/usuarios", label: "Usuarios", icon: IconUsers, soloAdmin: true, quick: undefined as string | undefined },
  { href: "/admin/mail", label: "Mail", icon: IconMail, soloAdmin: true, quick: undefined as string | undefined },
  { href: "/admin/importar-caso", label: "Importar caso", icon: IconUpload, soloAdmin: true, quick: undefined as string | undefined },
];

export function Sidebar({ nombre, rol, colapsado = false, onToggleColapsado }: {
  nombre: string;
  rol: string;
  colapsado?: boolean;
  onToggleColapsado?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickActual = searchParams.get("quick") ?? undefined;
  const [abierto, setAbierto] = useState(false);
  const esAdmin = rol === "admin";

  // Los textos usan md:hidden condicionado a "colapsado" (en vez de sacarlos
  // del DOM) para que solo se oculten en la sidebar fija de desktop: el
  // drawer de mobile, que reusa este mismo bloque, siempre muestra todo.
  const ocultarEnDesktop = colapsado ? "md:hidden" : "";

  const contenido = (
    <>
      <div className={`flex items-center gap-2 px-5 pb-4 pt-5 ${colapsado ? "md:justify-center md:px-0" : ""}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber to-amber/70 text-sm font-bold text-ink shadow-sm">IDR</span>
        <span className={`text-sm font-semibold uppercase tracking-[0.15em] text-paper ${ocultarEnDesktop}`}>Gestión</span>
      </div>

      {onToggleColapsado && (
        <button
          onClick={onToggleColapsado}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="mx-3 mb-3 hidden items-center justify-center rounded-md border border-white/10 py-1.5 text-paper/60 transition hover:bg-white/5 hover:text-paper md:flex"
        >
          <IconChevron colapsado={colapsado} />
        </button>
      )}

      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter(item => !item.soloAdmin || esAdmin).map(item => {
          const activo = item.href.startsWith("/panel")
            ? pathname === "/panel" && quickActual === item.quick
            : pathname === item.href || pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              title={item.label}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                colapsado ? "md:justify-center md:px-0" : ""
              } ${activo ? "bg-white/10 text-paper" : "text-paper/60 hover:bg-white/5 hover:text-paper"}`}
            >
              {activo && <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-amber" />}
              <Icon />
              <span className={ocultarEnDesktop}>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <div className={`mb-3 px-2 ${ocultarEnDesktop}`}>
          <p className="truncate text-sm font-medium text-paper">{nombre}</p>
          <p className="text-xs uppercase tracking-wide text-paper/50">{etiquetaRol(rol)}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-paper/60 transition hover:bg-white/5 hover:text-paper ${
            colapsado ? "md:justify-center md:px-0" : ""
          }`}
        >
          <IconLogout />
          <span className={ocultarEnDesktop}>Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: barra superior con botón hamburguesa */}
      <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-amber text-xs font-bold text-ink">IDR</span>
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-paper">Gestión</span>
        </div>
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú" className="text-paper">
          <IconMenu />
        </button>
      </div>

      {/* Sidebar fija en desktop */}
      <aside className={`hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col md:bg-ink md:transition-[width] md:duration-200 ${
        colapsado ? "md:w-16" : "md:w-56"
      }`}>
        {contenido}
      </aside>

      {/* Drawer en mobile */}
      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setAbierto(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-ink" onClick={() => setAbierto(false)}>
            {contenido}
          </aside>
        </div>
      )}
    </>
  );
}

function IconChevron({ colapsado }: { colapsado: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-transform ${colapsado ? "rotate-180" : ""}`}>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGrid() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>;
}
function IconArchive() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><rect x="1.5" y="2" width="13" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2.3 5.2v7.3a1.5 1.5 0 001.5 1.5h8.4a1.5 1.5 0 001.5-1.5V5.2" stroke="currentColor" strokeWidth="1.4"/><path d="M6.2 8.3h3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function IconUsers() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><circle cx="6" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 8.2c1.9.2 3.5 1.5 3.5 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function IconMail() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><rect x="1.5" y="3" width="13" height="10" rx="1.3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconUpload() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><path d="M8 10.5V2M8 2L4.5 5.5M8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v1.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M10.5 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
