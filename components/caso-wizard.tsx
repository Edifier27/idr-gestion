"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { boton, campo, tarjetaElevada } from "@/lib/ui";
import { plazoInforme } from "@/lib/etapa-contacto";
import { mapsUrl, telUrl, whatsappUrl } from "@/lib/contacto";
import { MapaEmbed } from "@/components/mapa-embed";
import { TextoPanel } from "@/components/texto-panel";
import { InformePanel } from "@/components/informe-panel";
import { EvidenciaPanel } from "@/components/evidencia-panel";
import { CerrarCasoBoton } from "@/components/cerrar-caso-boton";
import { notificar } from "@/components/notificaciones";

type Archivo = { id: string; nombre: string; url: string; tipo: string; categoria?: string | null; subidoPor: string | null; creadoEn: Date | string };
type Nota = { id: string; fecha: Date | string; tipo: string; nota: string };

type PasoId = "recibido" | "contacto" | "entrevista" | "informe";
const ORDEN: PasoId[] = ["recibido", "contacto", "entrevista", "informe"];
const ETIQUETA_PASO: Record<PasoId, string> = {
  recibido: "Recibido", contacto: "Contacto", entrevista: "Entrevista", informe: "Informe",
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
  const [fecha, setFecha] = useState(aInputLocal(fechaEntrevista));
  const [motivo, setMotivo] = useState(motivoContacto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cantArchivos, setCantArchivos] = useState(archivosIniciales.length);

  const plazo = plazoInforme(etapaContacto, fechaEntrevista);

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
                  activo ? "border-ink text-ink" : alcanzado ? "border-ok/50 text-ok hover:border-ok" : "border-line text-slate/40"
                } ${habilitado ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  alcanzado ? "bg-ok text-white" : activo ? "bg-ink text-white" : "bg-line text-slate"
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Datos del caso</h2>
          <fieldset className="rounded-md border border-ink/20 px-3 pb-2 pt-0.5">
            <legend className="px-1.5 text-[10px] font-bold uppercase tracking-wide text-ink">Siniestro</legend>
            <DatoForm k="DNI" v={dni} />
            <DatoForm k="Póliza" v={poliza} />
            <DatoForm k="Denunciante" v={denunciante} />
            <DatoForm k="Domicilio" v={domicilio} extra={domicilio && <BotonMaps direccion={domicilio} />} />
            <DatoForm k="Fecha ocurrencia" v={fechaOcurrencia} />
            <DatoForm k="Lugar del hecho" v={lugarTxt || null} extra={lugarTxt && <BotonMaps direccion={lugarTxt} />} />
            <DatoForm k="Contacto" v={telContacto ?? celContacto} extra={(telContacto ?? celContacto) && <BotonesContacto numero={(telContacto ?? celContacto)!} />} />
            <DatoForm k="Email" v={emailContacto} />
            <DatoForm k="Vencimiento gestión" v={fechaLimite} />
          </fieldset>

          <MapaEmbed direccion={domicilio || lugarTxt} />

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
          <button onClick={() => setPasoActivo("contacto")} className={boton.primario}>
            Siguiente: contactar →
          </button>
        </div>
      )}

      {/* Paso 2: Contacto — logra o falla el contacto. */}
      {pasoActivo === "contacto" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Contactar al denunciante</h2>
          <div className="rounded-md border border-line bg-paper p-3 text-sm">
            <p className="text-slate">Datos de contacto</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-ink">{telContacto ?? celContacto ?? "— sin teléfono cargado"}</p>
              {(telContacto ?? celContacto) && <BotonesContacto numero={(telContacto ?? celContacto)!} grande />}
            </div>
            {emailContacto && <p className="font-mono text-ink">{emailContacto}</p>}
          </div>

          {etapaContacto !== "contacto_fallido" && etapaContacto !== "contactado" ? (
            <div className="flex flex-wrap gap-2">
              <button disabled={guardando} onClick={() => guardar({ etapa_contacto: "contactado" })} className={boton.primario}>
                ✅ Lo contacté
              </button>
              <button
                disabled={guardando}
                onClick={() => guardar({ etapa_contacto: "contacto_fallido" })}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-fraude/30 bg-fraude/5 px-3.5 py-2 text-sm font-medium text-fraude shadow-sm transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                📵 No pude contactarlo
              </button>
            </div>
          ) : etapaContacto === "contacto_fallido" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-fraude">📵 Marcado como "sin contactar".</p>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Motivo (le avisa al admin)</span>
              <div className="flex gap-2">
                <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: no coincide el DNI, celular incorrecto…" className={`w-full ${campo}`} />
                <button type="button" disabled={guardando} onClick={() => guardar({ motivo_contacto: motivo })} className={boton.secundario}>Guardar</button>
              </div>

              {derivadoAdmin ? (
                <p className="rounded-md border border-fraude/30 bg-fraude/5 px-3 py-2 text-sm font-medium text-fraude">
                  🚩 Derivado al administrador — lo va a contactar directamente.
                </p>
              ) : (
                <button
                  disabled={guardando}
                  onClick={() => guardar({ derivado_admin: true, motivo_contacto: motivo })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-fraude/30 bg-fraude/5 px-3.5 py-2 text-sm font-semibold text-fraude shadow-sm transition hover:bg-fraude/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🚩 Derivar al administrador
                </button>
              )}

              <button disabled={guardando} onClick={() => guardar({ etapa_contacto: "contactado" })} className={boton.primario}>
                ✅ Ahora sí lo contacté
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ok">✅ Contactado.</p>
                <button
                  disabled={guardando}
                  onClick={() => guardar({ etapa_contacto: "contacto_fallido" })}
                  className="text-xs font-medium text-fraude underline decoration-dotted underline-offset-2 hover:text-fraude/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📵 En realidad no pude contactarlo
                </button>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">¿Ya quedó pactada la entrevista? Cargá fecha y hora acá</span>
                <div className="flex gap-2">
                  <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} className={`w-full ${campo}`} />
                  <button
                    type="button"
                    disabled={guardando || !fecha}
                    onClick={() => guardar({ etapa_contacto: "entrevista_pactada", fecha_entrevista: fecha ? new Date(fecha).toISOString() : null }, "entrevista")}
                    className={boton.primario}
                  >
                    📅 Pactar entrevista →
                  </button>
                </div>
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
              <button onClick={() => setPasoActivo("entrevista")} className={boton.ghost}>
                Todavía no tengo la fecha: pasar igual →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Entrevista — fecha + seguir cargando el descargo. */}
      {pasoActivo === "entrevista" && (
        <div className={`space-y-4 p-5 ${tarjetaElevada}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Entrevista</h2>
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate">Fecha y hora</span>
            <div className="flex gap-2">
              <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} className={`w-full ${campo}`} />
              <button
                type="button"
                disabled={guardando}
                onClick={() => guardar({ etapa_contacto: "entrevista_pactada", fecha_entrevista: fecha ? new Date(fecha).toISOString() : null })}
                className={boton.secundario}
              >
                Guardar
              </button>
            </div>
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
            className={boton.primario}
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">Pruebas e informe</h2>
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">Bitácora de {nombreOperador} ({notas.length} entradas)</h2>
        <div className="space-y-2">
          {notas.length === 0
            ? <p className="text-sm text-slate">Sin entradas todavía.</p>
            : notas.map(n => (
                <div key={n.id} className="border-b border-line pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-paper px-1.5 py-0.5 text-xs font-medium text-slate capitalize">{n.tipo}</span>
                    <span className="text-xs text-slate">{new Date(n.fecha).toLocaleString("es-AR")}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{n.nota}</p>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}

function DatoForm({ k, v, extra }: { k: string; v: string | null; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-ink/15 py-1 font-mono text-[11px] last:border-0">
      <span className="shrink-0 uppercase tracking-wide text-slate">{k}</span>
      <span className="min-w-[0.5rem] flex-1 border-b border-dotted border-ink/25" />
      <span className="shrink-0 max-w-[60%] truncate text-right text-ink" title={v ?? undefined}>{v ?? "—"}</span>
      {extra}
    </div>
  );
}

// Abre el domicilio/lugar directo en Google Maps.
function BotonMaps({ direccion }: { direccion: string }) {
  const url = mapsUrl(direccion);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en Google Maps" className="shrink-0 text-sm leading-none text-slate transition hover:text-ink">
      📍
    </a>
  );
}

// Llamar o mandar WhatsApp directo al número cargado. "grande" es la
// variante con look de botón para el bloque "Datos de contacto" del paso
// Contacto — ahí es LA acción que el operador va a tocar, no un ícono
// chico al costado.
function BotonesContacto({ numero, grande = false }: { numero: string; grande?: boolean }) {
  const wa = whatsappUrl(numero);
  const tel = telUrl(numero);
  if (!wa && !tel) return null;
  if (grande) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-ok/30 bg-ok/5 px-2.5 py-1 text-xs font-medium text-ok shadow-sm transition hover:bg-ok/10">
            💬 WhatsApp
          </a>
        )}
        {tel && (
          <a href={tel} className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm transition hover:bg-paper">
            📞 Llamar
          </a>
        )}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" title="Mandar WhatsApp" className="text-sm leading-none text-slate transition hover:text-ok">
          💬
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
