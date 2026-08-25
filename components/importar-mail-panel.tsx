"use client";

import { useState } from "react";

type Datos = {
  nro_siniestro: string | null;
  numero_gestion: string | null;
  compania: string | null;
  rama: string | null;
  tipo: string | null;
  poliza: string | null;
  asegurado: string | null;
  denunciante: string | null;
  dni: string | null;
  email_contacto: string | null;
  tel_contacto: string | null;
  cel_contacto: string | null;
  tel: string | null;
  domicilio: string | null;
  estado_origen: string | null;
  fecha_ingreso: string | null;
  fecha_ocurrencia: string | null;
  hora_ocurrencia: string | null;
  fecha_denuncia: string | null;
  lugar_siniestro: {
    calle1: string | null; altura1: string | null;
    calle2: string | null; altura2: string | null;
    localidad: string | null; provincia: string | null;
    comisaria: string | null; acta: string | null; sumario: string | null;
  };
};

const VACIO: Datos = {
  nro_siniestro: null, numero_gestion: null, compania: null, rama: null, tipo: null,
  poliza: null, asegurado: null, denunciante: null, dni: null, email_contacto: null,
  tel_contacto: null, cel_contacto: null, tel: null, domicilio: null, estado_origen: null,
  fecha_ingreso: null, fecha_ocurrencia: null, hora_ocurrencia: null, fecha_denuncia: null,
  lugar_siniestro: { calle1: null, altura1: null, calle2: null, altura2: null, localidad: null, provincia: null, comisaria: null, acta: null, sumario: null },
};

export function ImportarMailPanel({ operadoresExistentes }: { operadoresExistentes: string[] }) {
  const [texto, setTexto] = useState("");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [operador, setOperador] = useState("");
  const [extrayendo, setExtrayendo] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);

  async function extraer() {
    if (!texto.trim()) return;
    setExtrayendo(true);
    setError(null);
    setDatos(null);
    try {
      const res = await fetch("/api/extract-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer el mail.");
      setDatos({ ...VACIO, ...data.datos, lugar_siniestro: { ...VACIO.lugar_siniestro, ...data.datos.lugar_siniestro } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el mail.");
    } finally {
      setExtrayendo(false);
    }
  }

  function set<K extends keyof Datos>(k: K, v: string) {
    setDatos(d => d ? { ...d, [k]: v || null } : d);
  }
  function setLugar(k: keyof Datos["lugar_siniestro"], v: string) {
    setDatos(d => d ? { ...d, lugar_siniestro: { ...d.lugar_siniestro, [k]: v || null } } : d);
  }

  async function crear() {
    if (!datos) return;
    if (!operador.trim()) { setError("Elegí a qué operador se le asigna el caso."); return; }
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/siniestros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, operador: operador.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el caso.");
      setCreado(data.siniestro.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el caso.");
    } finally {
      setCreando(false);
    }
  }

  if (creado) {
    return (
      <div className="rounded-lg border border-ok/30 bg-ok/5 p-6 text-center">
        <p className="mb-3 text-sm text-ok">Caso creado correctamente.</p>
        <a href={`/siniestros/${creado}`} className="inline-block rounded bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90">
          Ver el caso
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Texto del mail (asunto + cuerpo)</span>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={10}
            placeholder="Pegá acá el mail completo..."
            className="w-full resize-y rounded border border-line px-3 py-2 font-mono text-xs focus:border-ink/40 focus:outline-none"
          />
        </label>
        <button
          onClick={extraer}
          disabled={extrayendo || !texto.trim()}
          className="mt-3 rounded bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
        >
          {extrayendo ? "Leyendo…" : "Extraer con IA"}
        </button>
      </div>

      {error && <p className="text-sm text-fraude">{error}</p>}

      {datos && (
        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Revisá los datos antes de crear el caso</h2>
          <div className="mb-4">
            <Campo label="Operador (a quién se asigna)">
              <input value={operador} onChange={e => setOperador(e.target.value)} required
                list="operadores-existentes" placeholder="Ej: NACHO"
                className="w-full rounded border border-amber/50 bg-amber/5 px-3 py-1.5 text-sm uppercase focus:border-ink/40 focus:outline-none" />
              <datalist id="operadores-existentes">
                {operadoresExistentes.map(o => <option key={o} value={o} />)}
              </datalist>
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="N° Siniestro"><Input v={datos.nro_siniestro} onChange={v => set("nro_siniestro", v)} /></Campo>
            <Campo label="N° Gestión"><Input v={datos.numero_gestion} onChange={v => set("numero_gestion", v)} /></Campo>
            <Campo label="Compañía"><Input v={datos.compania} onChange={v => set("compania", v)} /></Campo>
            <Campo label="Rama"><Input v={datos.rama} onChange={v => set("rama", v)} /></Campo>
            <Campo label="Tipo"><Input v={datos.tipo} onChange={v => set("tipo", v)} /></Campo>
            <Campo label="Póliza"><Input v={datos.poliza} onChange={v => set("poliza", v)} /></Campo>
            <Campo label="Asegurado"><Input v={datos.asegurado} onChange={v => set("asegurado", v)} /></Campo>
            <Campo label="Denunciante"><Input v={datos.denunciante} onChange={v => set("denunciante", v)} /></Campo>
            <Campo label="DNI"><Input v={datos.dni} onChange={v => set("dni", v)} /></Campo>
            <Campo label="Email de contacto"><Input v={datos.email_contacto} onChange={v => set("email_contacto", v)} /></Campo>
            <Campo label="Tel. contacto"><Input v={datos.tel_contacto} onChange={v => set("tel_contacto", v)} /></Campo>
            <Campo label="Cel. contacto"><Input v={datos.cel_contacto} onChange={v => set("cel_contacto", v)} /></Campo>
            <Campo label="Domicilio"><Input v={datos.domicilio} onChange={v => set("domicilio", v)} /></Campo>
            <Campo label="Fecha ocurrencia"><Input v={datos.fecha_ocurrencia} onChange={v => set("fecha_ocurrencia", v)} placeholder="YYYY-MM-DD" /></Campo>
            <Campo label="Localidad del hecho"><Input v={datos.lugar_siniestro.localidad} onChange={v => setLugar("localidad", v)} /></Campo>
            <Campo label="Provincia del hecho"><Input v={datos.lugar_siniestro.provincia} onChange={v => setLugar("provincia", v)} /></Campo>
          </div>
          <button
            onClick={crear}
            disabled={creando}
            className="mt-5 rounded bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
          >
            {creando ? "Creando…" : "Crear caso"}
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">{label}</span>
      {children}
    </label>
  );
}
function Input({ v, onChange, placeholder }: { v: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={v ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded border border-line px-3 py-1.5 text-sm focus:border-ink/40 focus:outline-none" />
  );
}
