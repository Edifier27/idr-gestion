"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, tarjeta } from "@/lib/ui";
import { notificar, confirmar } from "@/components/notificaciones";
import { mapsUrl, telUrl, whatsappUrl } from "@/lib/contacto";
import { MapaEmbed } from "@/components/mapa-embed";
import { IconWhatsApp } from "@/components/icon-whatsapp";

type DatoExtra = { id: string; etiqueta: string; valor: string };

// Datos del siniestro que la IA extrae del PDF de ATM, ahora editables por el
// admin — Dario pidió poder corregirlos a mano cuando la IA se equivoca o
// viene incompleta, y poder agregar datos sueltos que no tienen campo fijo
// (ej. "Chasis"). Va en tarjeta blanca con filas en grilla (etiqueta fija a
// la izquierda, valor editable a la derecha) en vez del <fieldset> angosto
// de antes — más aire, más fácil de escanear, y cada fila se resalta al
// pasar el mouse para que se note que es editable.
export function DatosCasoPanel({ siniestroId, dni, poliza, denunciante, domicilio, fechaOcurrencia, lugarInicial, telContacto, celContacto, emailContacto, fechaLimite, operador, datosExtraIniciales }: {
  siniestroId: string;
  dni: string | null; poliza: string | null; denunciante: string | null; domicilio: string | null;
  fechaOcurrencia: string | null; lugarInicial: string; telContacto: string | null; celContacto: string | null;
  emailContacto: string | null; fechaLimite: string | null; operador: string | null;
  datosExtraIniciales: DatoExtra[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    dni: dni ?? "", poliza: poliza ?? "", denunciante: denunciante ?? "", domicilio: domicilio ?? "",
    fechaOcurrencia: fechaOcurrencia ?? "", lugar: lugarInicial, telContacto: telContacto ?? "",
    celContacto: celContacto ?? "", emailContacto: emailContacto ?? "", fechaLimite: fechaLimite ?? "",
    operador: operador ?? "",
  });
  const [guardado, setGuardado] = useState({ ...form });
  const [guardando, setGuardando] = useState(false);
  const [datosExtra, setDatosExtra] = useState(datosExtraIniciales);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [nuevoValor, setNuevoValor] = useState("");
  const [agregando, setAgregando] = useState(false);

  const cambio = JSON.stringify(form) !== JSON.stringify(guardado);
  function set<K extends keyof typeof form>(campo: K, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni: form.dni, poliza: form.poliza, denunciante: form.denunciante, domicilio: form.domicilio,
          fecha_ocurrencia: form.fechaOcurrencia, tel_contacto: form.telContacto, cel_contacto: form.celContacto,
          email_contacto: form.emailContacto, fecha_limite: form.fechaLimite, operador: form.operador,
          lugar_siniestro: { calle1: form.lugar },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar.");
      setGuardado({ ...form });
      notificar.ok("Datos del siniestro actualizados.");
      router.refresh();
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarDato(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaEtiqueta.trim() || !nuevoValor.trim()) return;
    setAgregando(true);
    try {
      const res = await fetch("/api/dato-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siniestroId, etiqueta: nuevaEtiqueta, valor: nuevoValor }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo agregar.");
      setDatosExtra(d => [...d, data.dato]);
      setNuevaEtiqueta(""); setNuevoValor("");
    } catch (e) {
      notificar.error(e instanceof Error ? e.message : "Error al agregar el dato.");
    } finally {
      setAgregando(false);
    }
  }

  async function borrarDato(id: string) {
    const ok = await confirmar("¿Borrar este dato?", { textoConfirmar: "Borrar", peligroso: true });
    if (!ok) return;
    const res = await fetch(`/api/dato-extra/${id}`, { method: "DELETE" });
    if (res.ok) setDatosExtra(d => d.filter(x => x.id !== id));
    else notificar.error("No se pudo borrar.");
  }

  return (
    <div className="space-y-3">
      <div className={`min-w-0 ${tarjeta} p-4`}>
        <CabeceraTarjeta icono="📋" titulo="Datos del siniestro" />
        <div className="divide-y divide-dashed divide-line">
          <DatoInput k="DNI" value={form.dni} onChange={v => set("dni", v)} />
          <DatoInput k="Póliza" value={form.poliza} onChange={v => set("poliza", v)} />
          <DatoInput k="Denunciante" value={form.denunciante} onChange={v => set("denunciante", v)} />
          <DatoInput k="Domicilio" value={form.domicilio} onChange={v => set("domicilio", v)} extra={<BotonMaps direccion={form.domicilio} />} />
          <DatoInput k="Fecha ocurrencia" value={form.fechaOcurrencia} onChange={v => set("fechaOcurrencia", v)} />
          <DatoInput k="Lugar del hecho" value={form.lugar} onChange={v => set("lugar", v)} extra={<BotonMaps direccion={form.lugar} />} />
          <DatoInput k="Teléfono" value={form.telContacto} onChange={v => set("telContacto", v)} extra={<BotonesContacto numero={form.telContacto} />} />
          <DatoInput k="Celular" value={form.celContacto} onChange={v => set("celContacto", v)} extra={<BotonesContacto numero={form.celContacto} />} />
          <DatoInput k="Email" value={form.emailContacto} onChange={v => set("emailContacto", v)} type="email" />
          <DatoInput k="Vencimiento gestión" value={form.fechaLimite} onChange={v => set("fechaLimite", v)} />
          <DatoInput k="Operador" value={form.operador} onChange={v => set("operador", v.toUpperCase())} />
        </div>
      </div>

      {datosExtra.length > 0 && (
        <div className={`min-w-0 ${tarjeta} p-4`}>
          <CabeceraTarjeta icono="🏷️" titulo="Datos adicionales" />
          <div className="divide-y divide-dashed divide-line">
            {datosExtra.map(d => (
              <div key={d.id} className="group -mx-1.5 flex items-baseline gap-2 rounded-md px-1.5 py-2 font-mono text-[11px] transition hover:bg-paper/70">
                <span className="shrink-0 uppercase tracking-wide text-slate">{d.etiqueta}</span>
                <span className="min-w-0 flex-1 truncate text-right text-ink">{d.valor}</span>
                <button
                  onClick={() => borrarDato(d.id)}
                  title="Borrar dato"
                  className="shrink-0 text-fraude opacity-0 transition hover:text-fraude/70 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={agregarDato} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-line bg-paper/40 p-2.5">
        <input
          value={nuevaEtiqueta}
          onChange={e => setNuevaEtiqueta(e.target.value)}
          placeholder="Nuevo dato (ej: Chasis)"
          className={`w-32 flex-1 px-2 py-1 text-xs ${campo}`}
        />
        <input
          value={nuevoValor}
          onChange={e => setNuevoValor(e.target.value)}
          placeholder="Valor"
          className={`w-32 flex-1 px-2 py-1 text-xs ${campo}`}
        />
        <button type="submit" disabled={agregando || !nuevaEtiqueta.trim() || !nuevoValor.trim()} className={`${boton.ghost} shrink-0 border border-ink/15`}>
          + Agregar dato
        </button>
      </form>

      <MapaEmbed direccion={form.domicilio || form.lugar} />

      <div className="flex items-center gap-3 pt-1">
        <button onClick={guardar} disabled={guardando || !cambio} className={boton.primario}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {cambio && !guardando && <span className="text-xs text-amber">Cambios sin guardar</span>}
      </div>
    </div>
  );
}

function CabeceraTarjeta({ icono, titulo }: { icono: string; titulo: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-ink">
      <span className="text-sm leading-none">{icono}</span>
      <h3 className="text-[11px] font-bold uppercase tracking-wide">{titulo}</h3>
    </div>
  );
}

function DatoInput({ k, value, onChange, type = "text", extra }: { k: string; value: string; onChange: (v: string) => void; type?: string; extra?: React.ReactNode }) {
  return (
    <div className="-mx-1.5 grid grid-cols-[104px_1fr] items-center gap-2 rounded-md px-1.5 py-2 font-mono text-[11px] transition hover:bg-paper/70">
      <span className="truncate uppercase tracking-wide text-slate">{k}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="min-w-0 flex-1 rounded bg-transparent px-1 text-right text-ink outline-none transition focus:bg-white focus:shadow-sm"
        />
        {extra}
      </div>
    </div>
  );
}

// Abre el domicilio/lugar directo en Google Maps — sin tener que copiar y
// pegar la dirección a mano.
function BotonMaps({ direccion }: { direccion: string }) {
  const url = mapsUrl(direccion);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir en Google Maps"
      className="shrink-0 text-sm leading-none text-slate transition hover:text-ink"
    >
      📍
    </a>
  );
}

// Llamar o mandar WhatsApp directo al número cargado.
function BotonesContacto({ numero }: { numero: string }) {
  const wa = whatsappUrl(numero);
  const tel = telUrl(numero);
  if (!wa && !tel) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" title="Mandar WhatsApp" className="transition hover:opacity-70">
          <IconWhatsApp className="h-3.5 w-3.5" />
        </a>
      )}
      {tel && (
        <a href={tel} title="Llamar" className="text-sm leading-none text-slate transition hover:text-ink">
          📞
        </a>
      )}
    </span>
  );
}
