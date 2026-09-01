"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, tarjetaElevada } from "@/lib/ui";
import { plazoInforme } from "@/lib/etapa-contacto";
import { mapsUrl, telUrl, whatsappUrl } from "@/lib/contacto";
import { googleCalendarUrl } from "@/lib/calendario";
import { MapaEmbed } from "@/components/mapa-embed";
import { IconWhatsApp } from "@/components/icon-whatsapp";
import { BitacoraPanel, type EntradaBitacora } from "@/components/bitacora-panel";
import { TextoPanel } from "@/components/texto-panel";
import { InformePanel } from "@/components/informe-panel";
import { EvidenciaPanel } from "@/components/evidencia-panel";
import { CerrarCasoBoton } from "@/components/cerrar-caso-boton";
import { notificar } from "@/components/notificaciones";

type Archivo = { id: string; nombre: string; url: string; tipo: string; categoria?: string | null; subidoPor: string | null; creadoEn: Date | string };
type Nota = EntradaBitacora;

type PasoId = "recibido" | "contacto" | "entrevista" | "informe";
const ORDEN: PasoId[] = ["recibido", "contacto", "entrevista", "informe"];
const ETIQUETA_PASO: Record<PasoId, string> = {
  recibido: "Recibido", contacto: "Contacto", entrevista: "Entrevista", informe: "Informe",
};
const TITULO_PASO: Record<PasoId, string> = {
  recibido: "Datos del caso", contacto: "Contactar al denunciante", entrevista: "Entrevista", informe: "Pruebas e informe",
};

function pasoDesdeEtapa(etapaContacto: string | null): PasoId {
  if (!etapaContacto) return "recibido";
  if (etapaContacto === "contacto_fallido" || etapaContacto === "contactado") return "contacto";
  if (etapaContacto === "entrevista_pactada") return "entrevista";
  return "informe"; // informe_enviado
}

function aInputLocal(fecha: string | Date | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Vista guiada del caso para el operador: en vez de la página larga con todo
// junto, un carrusel que sigue el flujo real (recibido → contacto →
// entrevista → informe) y solo muestra lo que hace falta en cada paso. Puede
// volver libremente a pasos ya alcanzados para revisar o corregir — no es
// unidireccional. Mail, Bitácora y Acciones quedan siempre a mano abajo,
// porque no son parte de un paso puntual sino cosas que se usan en cualquier
// momento del caso.
//
// "ATB" (así lo llama Dario — apto para operadores sin ganas de pelearse
// con un CRM): cada paso arranca con un numerito grande + título, así nunca
// hay duda de en qué parte del flujo se está. Y las acciones que se tocan
// (llamar, whatsapear, ver el mapa) van SIEMPRE en su propia tarjeta
// separada de los datos de solo lectura — antes el ícono de WhatsApp vivía
// pegado en la misma fila apretada que el DNI o la fecha de ocurrencia, y
// costaba distinguir "esto lo puedo tocar" de "esto es solo para leer".
export function CasoWizard({
  siniestroId, dni, poliza, denunciante, domicilio, fechaOcurrencia, lugarTxt,
  telContacto, celContacto, emailContacto, fechaLimite, relatoDenuncia,
  etapaContacto, fechaEntrevista, motivoContacto, derivadoAdmin, descargoInicial, informeInicial,
  archivosIniciales, notas, nombreOperador, yaClosed,
}: {
  siniestroId: string;
  dni: string | null; poliza: string | null; denunciante: string | null; domicilio: string | null;
  fechaOcurrencia: string | null; lugarTxt: string; telContacto: string | null; celContacto: string | null;
  emailContacto: string | null; fechaLimite: string | null; relatoDenuncia: string | null;
  etapaContacto: string | null; fechaEntrevista: string | Date | null; motivoContacto: string | null;
  derivadoAdmin: boolean;
  descargoInicial: string | null; informeInicial: string | null;
  archivosIniciales: Archivo[]; notas: Nota[]; nombreOperador: string; yaClosed: boolean;
}) {
  const router = useRouter();
  const pasoAlcanzado = pasoDesdeEtapa(etapaContacto);
  const indiceAlcanzado = ORDEN.indexOf(pasoAlcanzado);
  const [pasoActivo, setPasoActivo] = useState<PasoId>(pasoAlcanzado);
  // Arranca vacío (no aInputLocal(fechaEntrevista) directo): el server de
  // Vercel corre en UTC y el navegador en hora de Argentina — calcular la
  // fecha local durante el render de servidor y el de cliente da resultados
  // distintos (desfasan 3hs), y React puede quedarse con el valor del
  // servidor pegado en algunos atributos (le pasó al link de Google
  // Calendar: mostraba bien la hora en el input pero el link salía 3hs
  // corrido). Se carga posta recién en el cliente, vía useEffect.
  const [fecha, setFecha] = useState("");
  useEffect(() => { setFecha(aInputLocal(fechaEntrevista)); }, [fechaEntrevista]);
  const [motivo, setMotivo] = useState(motivoContacto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cantArchivos, setCantArchivos] = useState(archivosIniciales.length);

  const plazo = plazoInforme(etapaContacto, fechaEntrevista);
  const telUno = telContacto ?? celContacto;
  const direccionMapa = domicilio || lugarTxt;

  // Link para agregar la entrevista a Google Calendar con un clic — a Dario
  // se le ocurrió que en vez de solo guardar la fecha en el CRM, se pueda
  // abrir directo el calendario. Se recalcula solo con lo que ya hay en
  // pantalla (fecha cargada + datos del caso), sin pegarle a ninguna API.
  const linkCalendario = fecha ? googleCalendarUrl({
    titulo: `Entrevista — ${denunciante ?? "denunciante"}`,
    inicioLocal: fecha,
    ubicacion: domicilio || lugarTxt || undefined,
    detalles: `Caso de ${denunciante ?? "—"}.${telUno ? ` Contacto: ${telUno}.` : ""}`,
  }) : null;

  async function guardar(patch: Record<string, unknown>, siguiente?: PasoId) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/siniestros/${siniestroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar.");
      if (siguiente) setPasoActivo(siguiente);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar.";
      setError(msg);
      notificar.error(msg);
    } finally {
      setGuardando(false);
    }
  }

  // Puede ir a cualquier paso ya alcanzado, y también un paso más allá (el
  // siguiente inmediato) — así entra a "completar" el paso que sigue sin
  // poder saltearse ninguno.
  function irA(paso: PasoId) {
    if (ORDEN.indexOf(paso) <= indiceAlcanzado + 1) setPasoActivo(paso);
  }

  return (
    <div className="space-y-4">
      {/* Progreso: chips clickeables, uno por paso */}
      <div className={`overflow-hidden ${tarjetaElevada}`}>
        <div className="flex">
          {ORDEN.map((paso, i) => {
            const alcanzado = i <= indiceAlcanzado;
            const activo = paso === pasoActivo;
            const habilitado = i <= indiceAlcanzado + 1;
            return (
              <button
                key={paso}
                onClick={() => irA(paso)}
                disabled={!habilitado}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-xs font-semibold uppercase tracking-wide transition ${
                  activo ? "border-azul text-azul" : alcanzado ? "border-ok/50 text-ok hover:border-ok" : "border-line text-slate/40"
                } ${habilitado ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  alcanzado ? "bg-ok text-white" : activo ? "bg-azul text-white" : "bg-line text-slate"
                }`}>
                  {alcanzado && paso !== pasoActivo ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{ETIQUETA_PASO[paso]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="rounded-md border border-fraude/30 bg-fraude/5 px-3 py-2 text-sm text-fraude">{error}</p>}

      {/* Paso 1: Recibido — solo mirar los datos, nada para guardar acá. */}
      {pasoActivo === "recibido" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <PasoHeader numero={1} titulo={TITULO_PASO.recibido} />

          {/* Tarjeta de acción, separada a propósito de la lista de datos de
              abajo: lo primero que hace falta acá es poder llamar/escribir,
              no leer 9 campos. */}
          <div className="rounded-lg border border-line bg-paper p-3.5">
            <p className="min-w-0 truncate text-sm font-semibold text-ink">{denunciante ?? "Sin denunciante cargado"}</p>
            <p className="truncate font-mono text-xs text-slate">{telUno ?? "Sin teléfono cargado"}</p>
            {(telUno || direccionMapa) && (
              <div className="mt-3 flex gap-2">
                <AccionIcono href={direccionMapa ? mapsUrl(direccionMapa) : null} icono="📍" label="Maps" />
                <AccionIcono href={telUno ? whatsappUrl(telUno) : null} icono={<IconWhatsApp className="h-4 w-4" />} label="WhatsApp" />
                <AccionIcono href={telUno ? telUrl(telUno) : null} icono="📞" label="Llamar" />
              </div>
            )}
          </div>

          <fieldset className="min-w-0 rounded-md border border-ink/20 px-3 pb-2 pt-0.5">
            <legend className="px-1.5 text-[10px] font-bold uppercase tracking-wide text-ink">Siniestro</legend>
            <DatoForm k="DNI" v={dni} />
            <DatoForm k="Póliza" v={poliza} />
            <DatoForm k="Denunciante" v={denunciante} />
            <DatoForm k="Domicilio" v={domicilio} />
            <DatoForm k="Fecha ocurrencia" v={fechaOcurrencia} />
            <DatoForm k="Lugar del hecho" v={lugarTxt || null} />
            <DatoForm k="Contacto" v={telUno} />
            <DatoForm k="Email" v={emailContacto} />
            <DatoForm k="Vencimiento gestión" v={fechaLimite} />
          </fieldset>

          <MapaEmbed direccion={direccionMapa} />

          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate">Relato de la denuncia</h3>
            <TextoPanel
              siniestroId={siniestroId}
              campo="relato_denuncia"
              valorInicial={relatoDenuncia}
              placeholder="Qué dice la denuncia que pasó: si no se extrajo solo del PDF, cargalo a mano acá…"
              etiquetaGuardar="Guardar relato"
            />
          </div>
          <button onClick={() => setPasoActivo("contacto")} className={`w-full py-3 text-base ${boton.primario}`}>
            Siguiente: contactar →
          </button>
        </div>
      )}

      {/* Paso 2: Contacto — logra o falla el contacto. */}
      {pasoActivo === "contacto" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <PasoHeader numero={2} titulo={TITULO_PASO.contacto} />

          <div className="rounded-lg border border-line bg-paper p-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Datos de contacto</p>
            <p className="mt-0.5 font-mono text-sm text-ink">{telUno ?? "— sin teléfono cargado"}</p>
            {emailContacto && <p className="font-mono text-xs text-slate">{emailContacto}</p>}
            {/* Sin "Agendar" acá — Dario prefirió sacarlo: es un link de
                una sola vía (arma un evento en Google Calendar a partir de
                lo cargado en el CRM, pero si después lo cambian allá el CRM
                no se entera), y confundía. Sigue estando donde sí hace
                falta: el link de texto del paso Entrevista, al lado del
                campo de fecha. */}
            <div className="mt-3 flex gap-2">
              <AccionIcono href={direccionMapa ? mapsUrl(direccionMapa) : null} icono="📍" label="Maps" />
              <AccionIcono href={telUno ? whatsappUrl(telUno) : null} icono={<IconWhatsApp className="h-4 w-4" />} label="WhatsApp" />
              <AccionIcono href={telUno ? telUrl(telUno) : null} icono="📞" label="Llamar" />
            </div>
          </div>

          {etapaContacto !== "contacto_fallido" && etapaContacto !== "contactado" ? (
            <div className="rounded-lg border border-line p-3.5">
              <p className="mb-2.5 text-sm font-medium text-ink">¿Pudiste contactarlo?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button disabled={guardando} onClick={() => guardar({ etapa_contacto: "contactado" })} className={`py-3 text-base ${boton.primario}`}>
                  ✅ Sí, lo contacté
                </button>
                <button
                  disabled={guardando}
                  onClick={() => guardar({ etapa_contacto: "contacto_fallido" })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-fraude/30 bg-fraude/5 px-3.5 py-3 text-base font-medium text-fraude shadow-sm transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📵 No pude contactarlo
                </button>
              </div>
            </div>
          ) : etapaContacto === "contacto_fallido" ? (
            <div className="space-y-3 rounded-lg border border-fraude/30 bg-fraude/5 p-3.5">
              <p className="text-sm font-medium text-fraude">📵 Marcado como "sin contactar".</p>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Motivo (le avisa al admin)</span>
                <div className="flex gap-2">
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: no coincide el DNI, celular incorrecto…" className={`w-full bg-white ${campo}`} />
                  <button type="button" disabled={guardando} onClick={() => guardar({ motivo_contacto: motivo })} className={boton.secundario}>Guardar</button>
                </div>
              </div>

              <button disabled={guardando} onClick={() => guardar({ etapa_contacto: "contactado" })} className={`w-full py-3 text-base ${boton.primario}`}>
                ✅ Ahora sí lo contacté
              </button>

              {derivadoAdmin ? (
                <p className="rounded-md border border-fraude/30 bg-white px-3 py-2 text-sm font-medium text-fraude">
                  🚩 Derivado al administrador — lo va a contactar directamente.
                </p>
              ) : (
                <button
                  disabled={guardando}
                  onClick={() => guardar({ derivado_admin: true, motivo_contacto: motivo })}
                  className="w-full text-center text-xs font-medium text-fraude underline decoration-dotted underline-offset-2 hover:text-fraude/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🚩 No puedo con este caso: derivar al administrador
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ok/30 bg-ok/5 p-3.5">
                <p className="text-sm font-medium text-ok">✅ Contactado.</p>
                <button
                  disabled={guardando}
                  onClick={() => guardar({ etapa_contacto: "contacto_fallido" })}
                  className="text-xs font-medium text-fraude underline decoration-dotted underline-offset-2 hover:text-fraude/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📵 En realidad no pude contactarlo
                </button>
              </div>

              <div className="rounded-lg border border-line p-3.5">
                <span className="mb-1.5 block text-sm font-medium text-ink">¿Ya quedó pactada la entrevista?</span>
                <div className="flex flex-wrap gap-2">
                  <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} className={`w-full flex-1 ${campo}`} />
                  <button
                    type="button"
                    disabled={guardando || !fecha}
                    onClick={() => guardar({ etapa_contacto: "entrevista_pactada", fecha_entrevista: fecha ? new Date(fecha).toISOString() : null }, "entrevista")}
                    className={boton.primario}
                  >
                    📅 Pactar →
                  </button>
                </div>
                {/* El link de texto "Agregar a Google Calendar" que estaba
                    acá se sacó — ahora es el ícono "Agendar" de la tarjeta
                    de arriba, que se activa solo apenas se carga la fecha
                    (mismo linkCalendario). Repetirlo acá abajo era la misma
                    acción dos veces en la misma pantalla. */}
                <button onClick={() => setPasoActivo("entrevista")} className={`mt-2.5 w-full text-center text-xs font-medium text-slate underline decoration-dotted underline-offset-2 hover:text-ink`}>
                  Todavía no tengo la fecha: pasar igual →
                </button>
              </div>

              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate">Descargo</h3>
                <TextoPanel
                  siniestroId={siniestroId}
                  campo="descargo"
                  valorInicial={descargoInicial}
                  placeholder="Qué encontraste, qué te dijeron, cómo se compara con la denuncia…"
                  etiquetaGuardar="Guardar descargo"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Paso 3: Entrevista — fecha + seguir cargando el descargo. */}
      {pasoActivo === "entrevista" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <PasoHeader numero={3} titulo={TITULO_PASO.entrevista} />

          <div className="rounded-lg border border-line p-3.5">
            <span className="mb-1.5 block text-sm font-medium text-ink">Fecha y hora</span>
            <div className="flex flex-wrap gap-2">
              <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} className={`w-full flex-1 ${campo}`} />
              <button
                type="button"
                disabled={guardando}
                onClick={() => guardar({ etapa_contacto: "entrevista_pactada", fecha_entrevista: fecha ? new Date(fecha).toISOString() : null })}
                className={boton.secundario}
              >
                Guardar
              </button>
            </div>
            {linkCalendario && (
              <a href={linkCalendario} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-ink hover:underline">
                🗓️ Agregar a Google Calendar
              </a>
            )}
            {plazo && (
              <p className={`mt-1.5 text-xs font-medium ${plazo === "vencido" ? "text-fraude" : plazo === "atencion" ? "text-amber" : "text-slate"}`}>
                {plazo === "vencido" && "⚠ Vencido — pasaron más de 48hs de la entrevista sin informe."}
                {plazo === "atencion" && "⏰ Atención — se cumplen 48hs pronto, todavía sin informe."}
                {plazo === "ok" && "En plazo: tenés 48hs desde la entrevista para cargar el informe."}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate">Descargo</h3>
            <TextoPanel
              siniestroId={siniestroId}
              campo="descargo"
              valorInicial={descargoInicial}
              placeholder="Qué encontraste, qué te dijeron, cómo se compara con la denuncia…"
              etiquetaGuardar="Guardar descargo"
            />
          </div>
          <button
            onClick={() => setPasoActivo("informe")}
            className={`w-full py-3 text-base ${boton.primario}`}
            disabled={!fechaEntrevista}
            title={!fechaEntrevista ? "Guardá la fecha de la entrevista primero" : undefined}
          >
            Ya entrevisté: siguiente →
          </button>
        </div>
      )}

      {/* Paso 4: Informe — obligatorio subir al menos una prueba antes de
          poder cerrar esta etapa. */}
      {pasoActivo === "informe" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <PasoHeader numero={4} titulo={TITULO_PASO.informe} />
          <div>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate">
              Evidencia {cantArchivos === 0 && <span className="rounded-full bg-fraude/10 px-1.5 py-0.5 text-[10px] font-bold normal-case text-fraude">Obligatorio subir al menos 1</span>}
            </h3>
            <EvidenciaPanel siniestroId={siniestroId} archivosIniciales={archivosIniciales} onArchivosChange={a => setCantArchivos(a.length)} />
          </div>
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate">Informe técnico-legal</h3>
            <InformePanel siniestroId={siniestroId} informeInicial={informeInicial} />
          </div>
          {etapaContacto !== "informe_enviado" ? (
            <div className="space-y-1.5 border-t border-line pt-4">
              <button
                disabled={guardando || cantArchivos === 0}
                onClick={() => guardar({ etapa_contacto: "informe_enviado" })}
                className={`w-full py-3 text-base ${boton.exito}`}
                title={cantArchivos === 0 ? "Subí al menos una prueba para poder enviarlo" : undefined}
              >
                📤 {guardando ? "Enviando…" : "Enviar informe"}
              </button>
              <p className="text-center text-xs text-slate">
                {cantArchivos === 0
                  ? "Subí al menos una prueba para poder enviarlo."
                  : "Esto termina el caso de tu lado y se lo manda al admin."}
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-ok/30 bg-ok/5 px-3 py-2 text-sm font-medium text-ok">✅ Informe enviado — caso al día.</p>
          )}
        </div>
      )}

      {/* Siempre a mano, sin importar en qué paso está: ver la bitácora, y
          las acciones de PDF/cerrar caso. El operador no manda mail — eso
          queda solo para el admin, que es quien tiene la casilla. */}
      <div className={`p-5 ${tarjetaElevada}`}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Acciones</h2>
        <div className="grid grid-cols-1 gap-2 sm:max-w-sm">
          <a href={`/api/expediente-pdf?id=${siniestroId}`} className={`${boton.secundario} w-full`}>🗂️ Expediente PDF</a>
        </div>
        <div className="mt-2">
          <CerrarCasoBoton siniestroId={siniestroId} yaClosed={yaClosed} />
        </div>
      </div>

      <div className={`p-5 ${tarjetaElevada}`}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Chat de {nombreOperador} ({notas.length} entradas)</h2>
        <BitacoraPanel siniestroId={siniestroId} entradasIniciales={notas} esAdmin={false} nombreOperador={nombreOperador} />
      </div>
    </div>
  );
}

// Encabezado de cada paso: número grande + título, siempre en el mismo
// lugar y con el mismo look — para que nunca haya duda de en qué parte del
// flujo de 4 pasos se está parado (el chip de arriba ya lo marca, esto lo
// repite en grande justo donde el operador está mirando).
function PasoHeader({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul text-sm font-bold text-paper">{numero}</span>
      <h2 className="text-base font-bold text-ink">{titulo}</h2>
    </div>
  );
}

function DatoForm({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-ink/15 py-1 font-mono text-[11px] last:border-0">
      <span className="shrink-0 uppercase tracking-wide text-slate">{k}</span>
      <span className="min-w-[0.5rem] flex-1 border-b border-dotted border-ink/25" />
      <span className="shrink-0 max-w-[60%] truncate text-right text-ink" title={v ?? undefined}>{v ?? "—"}</span>
    </div>
  );
}

// Grilla de acciones rápidas (Maps/WhatsApp/Llamar) — mismo lenguaje que la
// maqueta de diseño: ícono en caja blanca + etiqueta abajo, en vez de un
// botón de texto. Si no hay dato para esa acción (ej. sin teléfono
// cargado), el botón queda deshabilitado en vez de desaparecer — así la
// grilla no se desarma ni "salta" un lugar.
function AccionIcono({ href, icono, label }: { href: string | null; icono: React.ReactNode; label: string }) {
  const contenido = (
    <>
      <span className="text-lg leading-none">{icono}</span>
      {label}
    </>
  );
  const clases = "flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-semibold shadow-sm transition";
  if (!href) {
    return <span className={`${clases} border-line bg-white text-slate/40`}>{contenido}</span>;
  }
  return (
    <a
      href={href}
      target={href.startsWith("tel:") ? undefined : "_blank"}
      rel="noopener noreferrer"
      className={`${clases} border-line bg-white text-ink hover:border-azul/30 hover:bg-azul/5`}
    >
      {contenido}
    </a>
  );
}

