"use client";

import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string };

// Mini-navegación pegajosa del detalle del caso (admin), con "scroll-spy":
// a diferencia de una lista de anclas estática, acá la pestaña activa va
// cambiando sola a medida que scrolleás, marcando en qué sección estás
// parado — no solo la que tocaste último. Además, cuando cambia sola (por
// scroll, no por click) desliza esa pestaña a la vista dentro de la tira
// horizontal, para que en mobile no quede activa una pestaña fuera de
// pantalla sin que se note.
export function MiniNavScrollSpy({ items }: { items: Item[] }) {
  const [activo, setActivo] = useState(items[0]?.href ?? "");
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const secciones = items
      .map(i => document.getElementById(i.href.slice(1)))
      .filter((el): el is HTMLElement => !!el);
    if (secciones.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        // De las secciones visibles en la franja "de lectura" (justo debajo
        // de la barra pegajosa), la que está más arriba es la que estás
        // mirando en verdad.
        const visibles = entries.filter(e => e.isIntersecting);
        if (visibles.length === 0) return;
        const masArriba = visibles.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const href = `#${masArriba.target.id}`;
        setActivo(href);
        refs.current[href]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      },
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 }
    );
    secciones.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1.5 overflow-x-auto border-b border-line bg-paper/95 px-4 py-2 backdrop-blur-sm md:-mx-8 md:px-8">
      {items.map(item => (
        <a
          key={item.href}
          ref={el => { refs.current[item.href] = el; }}
          href={item.href}
          onClick={() => setActivo(item.href)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition duration-150 ${
            activo === item.href
              ? "border-ink bg-ink text-paper"
              : "border-ink/15 bg-white text-ink hover:-translate-y-0.5 hover:border-ink/30 hover:bg-paper hover:shadow-md"
          }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
