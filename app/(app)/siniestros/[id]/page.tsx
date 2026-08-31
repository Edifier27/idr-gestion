import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora, evidencia, datoExtra } from "@/lib/db/schema";
import { desgloseFacturacion, formatARS } from "@/lib/facturacion";
import { puedeVerCaso, puedeVerFacturacion, puedeVerInformeFinal } from "@/lib/acceso";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";
import { DatosCasoPanel } from "@/components/datos-caso-panel";
import { BitacoraPanel } from "@/components/bitacora-panel";
import { EstadoBadge } from "@/components/estado-badge";
import { ResultadoBadge } from "@/components/resultado-badge";
import { EvidenciaPanel } from "@/components/evidencia-panel";
import { TextoPanel } from "@/components/texto-panel";
import { MailPanel } from "@/components/mail-panel";
import { KmPanel } from "@/components/km-panel";
import { InformePanel } from "@/components/informe-panel";
import { InformeFinalPanel } from "@/components/informe-final-panel";
import { EstadoResultadoPanel } from "@/components/estado-resultado-panel";
import { EtapaContactoPanel } from "@/components/etapa-contacto-panel";
import { EtapaContactoBadge } from "@/components/etapa-contacto-badge";
import { CerrarCasoBoton } from "@/components/cerrar-caso-boton";
import { CasoWizard } from "@/components/caso-wizard";
import { MiniNavScrollSpy } from "@/components/mini-nav-scroll-spy";
import { boton, tarjetaElevada, colorPorTexto } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Dario pidió ocultar "Estado del caso" (Estado/Resultado/Cobro) para todos
// por ahora, mientras repiensa ese flujo — capaz vuelve más adelante.
const MOSTRAR_ESTADO_CASO = false;

// Guía para que el operador no se olvide de ningún paso al escribir la
// ampliación: antes/durante/después del hecho + qué se verificó. Se precarga
// en el textarea cuando el caso todavía no tiene descargo cargado.
const PLANTILLA_DESCARGO = `ANTES DEL HECHO (de dónde venía, hacia dónde iba, qué estaba haciendo):


DURANTE EL HECHO (qué pasó — cotejar con la denuncia):


DESPUÉS DEL HECHO (cómo reaccionó, a quién llamó/avisó, a quién no):


VERIFICACIONES REALIZADAS:
- Llamados verificados:
- Mensajes revisados:
- Fotos/comprobantes:
- Geolocalización:
`;

export default async function Detalle({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!dbConfigurada()) return <p className="p-10 text-slate">Conectá la base de datos.</p>;
  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!s) notFound();
  if (!puedeVerCaso(session, s.operador)) notFound();
  const esAdmin = session.user.rol === "admin";
  const verFacturacion = puedeVerFacturacion(session);
  const verInformeFinal = puedeVerInformeFinal(session);
  await asegurarColumnasComunicacion();
  const notas = await db.select().from(bitacora)
    .where(eq(bitacora.siniestroId, params.id))
    .orderBy(desc(bitacora.fecha));
  // Marca como leídas (para la próxima vez) las entradas del OTRO rol que
  // todavía no se habían visto — recién acá, DESPUÉS de leer `notas`, para
  // que en esta misma carga se vea resaltado lo que era nuevo de verdad.
  await db.update(bitacora)
    .set({ leida: true })
    .where(and(eq(bitacora.siniestroId, params.id), eq(bitacora.leida, false), eq(bitacora.autorEsAdmin, !esAdmin)));
  await asegurarTablaEvidencia();
  const archivos = await db.select().from(evidencia)
    .where(eq(evidencia.siniestroId, params.id))
    .orderBy(desc(evidencia.creadoEn));
  await asegurarTablaDatoExtra();
  const datosExtra = await db.select().from(datoExtra)
    .where(eq(datoExtra.siniestroId, params.id))
    .orderBy(datoExtra.creadoEn);
  const lugar = (s.lugarSiniestro ?? {}) as Record<string,string>;
  const lugarTxt = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" ");
  const desg = desgloseFacturacion(s.kmTotal);
  const nombreOperador = s.operador || "Sin operador";
  const colorOperador = colorPorTexto(nombreOperador);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <a href="/panel" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <span aria-hidden>←</span> Tablero
      </a>

      {/* Cabecera: tarjeta azul con degradé — de un vistazo, el caso y en qué
          etapa está (mismo lenguaje que la maqueta de diseño que aprobó
          Dario). Estado/Resultado necesitan buen contraste para el admin,
          así que van en una tira aparte debajo, sobre fondo claro — un
          badge tintado (bg-amber/15) se pierde contra un fondo oscuro. */}
      <div className="relative mb-3 overflow-hidden rounded-xl bg-gradient-to-br from-azul to-azul/80 p-5 pt-6 text-paper shadow-sm">
        <p className="font-mono text-xs text-paper/70">Gestión {s.numeroGestion ?? "—"} · Siniestro {s.nroSiniestro ?? "—"}</p>
        <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{s.asegurado ?? "Sin asegurado"}</h1>
        <p className="text-sm text-paper/70">{s.tipo ?? "—"} · {s.compania ?? "—"}</p>
        {s.etapaContacto && (
          <div className="mt-3">
            <EtapaContactoBadge etapaContacto={s.etapaContacto} fechaEntrevista={s.fechaEntrevista} variante="hero" />
          </div>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EstadoBadge estado={s.estado} />
        <ResultadoBadge resultado={s.resultado} />
        {s.derivadoAdmin && (
          <span className="rounded-full border border-fraude/30 bg-fraude/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fraude">
            🚩 Derivado
          </span>
        )}
      </div>

      {/* Resumen para el admin: de un vistazo, qué falta para poder armar el
          informe — sin tener que scrollear toda la página para averiguarlo.
          Cada chip salta directo a la sección correspondiente. */}
      {esAdmin && (
        <ChecklistInforme
          datosOk={Boolean(s.dni && (s.domicilio || lugarTxt) && (s.telContacto || s.celContacto))}
          descargoOk={Boolean(s.descargo)}
          evidenciaOk={archivos.length > 0}
          informeOk={Boolean(s.informe)}
          resolucionOk={verInformeFinal ? Boolean(s.informeFinal) : undefined}
        />
      )}

      {/* El operador ve el carrusel guiado (recibido → contacto → entrevista
          → informe): un paso a la vez, con lo justo y necesario en cada uno,
          en vez de la página larga de abajo — esa queda solo para el admin,
          que necesita ver/tocar todo junto (cotejo, resolución final, etc). */}
      {!esAdmin ? (
        <CasoWizard
          siniestroId={s.id}
          dni={s.dni}
          poliza={s.poliza}
          denunciante={s.denunciante}
          domicilio={s.domicilio}
          fechaOcurrencia={s.fechaOcurrencia}
          lugarTxt={lugarTxt}
          telContacto={s.telContacto}
          celContacto={s.celContacto}
          emailContacto={s.emailContacto}
          fechaLimite={s.fechaLimite}
          relatoDenuncia={s.relatoDenuncia}
          etapaContacto={s.etapaContacto}
          fechaEntrevista={s.fechaEntrevista}
          motivoContacto={s.motivoContacto}
          derivadoAdmin={s.derivadoAdmin}
          descargoInicial={s.descargo}
          informeInicial={s.informe}
          archivosIniciales={archivos}
          notas={notas}
          nombreOperador={nombreOperador}
          yaClosed={s.estado === "cerrado"}
        />
      ) : (
        <>
      {/* Mini-navegación pegajosa con scroll-spy: la página es larga, esto
          deja saltar directo a cualquier sección, y la pestaña activa va
          cambiando sola a medida que scrolleás. */}
      <MiniNavScrollSpy
        items={[
          { href: "#datos", label: "Datos" },
          { href: "#etapa", label: "Etapa" },
          ...(verFacturacion ? [{ href: "#facturacion", label: "Facturación" }] : []),
          { href: "#acciones", label: "Acciones" },
          { href: "#mail", label: "Mail" },
          { href: "#evidencia", label: "Evidencia" },
          { href: "#cotejo", label: "Cotejo" },
          ...(verInformeFinal ? [{ href: "#resolucion", label: "Resolución" }] : []),
          { href: "#bitacora", label: "Bitácora" },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {/* Datos del siniestro — con look de formulario/comprobante de
            denuncia (recuadros con título en la solapa, filas con puntitos),
            a pedido de Dario, comparando con el comprobante real de ATM
            Seguros. Abajo del todo, la descripción de la denuncia. */}
        <Bloque id="datos" titulo="Datos del siniestro">
          <DatosCasoPanel
            siniestroId={s.id}
            dni={s.dni}
            poliza={s.poliza}
            denunciante={s.denunciante}
            domicilio={s.domicilio}
            fechaOcurrencia={s.fechaOcurrencia}
            lugarInicial={lugarTxt}
            telContacto={s.telContacto}
            celContacto={s.celContacto}
            emailContacto={s.emailContacto}
            fechaLimite={s.fechaLimite}
            operador={s.operador}
            datosExtraIniciales={datosExtra}
          />

          {s.relatoDenuncia && (
            <fieldset className="mt-3 rounded-md border border-ink/20 px-3 pb-2.5 pt-0.5">
              <legend className="px-1.5 text-[10px] font-bold uppercase tracking-wide text-ink">Descripción</legend>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">{s.relatoDenuncia}</p>
            </fieldset>
          )}
        </Bloque>

        {/* Estado, resultado y cobro del caso — oculto por ahora a pedido de
            Dario (para todos, admin incluido), mientras repiensa ese flujo.
            Fácil de reactivar: MOSTRAR_ESTADO_CASO = true. */}
        <div className="space-y-4">
          {MOSTRAR_ESTADO_CASO && esAdmin && (
            <Bloque titulo="Estado del caso" accento="ink">
              <EstadoResultadoPanel
                siniestroId={s.id}
                estado={s.estado}
                resultado={s.resultado}
              />
            </Bloque>
          )}

          <Bloque id="etapa" titulo="Etapa de contacto" accento="slate">
            <EtapaContactoPanel
              siniestroId={s.id}
              etapaContacto={s.etapaContacto}
              fechaEntrevista={s.fechaEntrevista}
              motivoContacto={s.motivoContacto}
              derivadoAdmin={s.derivadoAdmin}
              derivadoEn={s.derivadoEn}
              denunciante={s.denunciante}
              domicilio={s.domicilio || lugarTxt}
            />
          </Bloque>

          {verFacturacion && (
            <Bloque id="facturacion" titulo="Facturación" accento="amber">
              <KmPanel siniestroId={s.id} kmTotal={s.kmTotal} domicilio={s.domicilio} lugarHecho={lugarTxt} />
              <Dato k="Km bonificados" v={`${desg.kmBonificados} km`} />
              <Dato k="Km facturables" v={`${desg.kmFacturables} km × $650`} />
              <Dato k="Gasto km" v={formatARS(desg.montoKm)} />
              <Dato k="Informe" v={formatARS(desg.montoInforme)} />
              <div className="flex items-center justify-between border-t border-line pt-3 mt-2">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="tnum text-lg font-bold text-amber">{formatARS(desg.total)}</span>
              </div>
            </Bloque>
          )}

          {/* Botones de acción */}
          <Bloque id="acciones" titulo="Acciones" accento="slate">
            <div className="grid grid-cols-1 gap-2 sm:max-w-xs">
              <BtnLink href={`/api/expediente-pdf?id=${s.id}`} label="🗂️ Expediente PDF" />
            </div>
            <div className="mt-2">
              <CerrarCasoBoton siniestroId={s.id} yaClosed={s.estado === "cerrado"} />
            </div>
          </Bloque>

          {/* Nuevo mensaje */}
          <Bloque id="mail" titulo="Enviar mail" accento="slate">
            <MailPanel
              siniestroId={s.id}
              destinatarioSugerido={s.emailContacto}
              archivos={archivos.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }))}
            />
          </Bloque>
        </div>

        {/* Evidencia */}
        <div className="md:col-span-2">
          <Bloque id="evidencia" titulo="Evidencia" accento="ok">
            <EvidenciaPanel siniestroId={s.id} archivosIniciales={archivos} />
          </Bloque>
        </div>

        {/* Las 3 ventanas para cotejar el caso: lo que dice la denuncia, lo
            que dice el operador, y el borrador con IA que arma comparando
            las dos (herramienta compartida, visible para operador y admin). */}
        <div id="cotejo" className="scroll-mt-16 md:col-span-2">
          <p className="mb-3 text-sm text-slate">
            <span className="font-semibold text-ink">Cotejo:</span> comparás lo que dice la denuncia contra lo que relevó el operador.
            {verInformeFinal && " La resolución final que se manda por mail (paso 4, más abajo) la armás vos aparte — el operador no la ve."}
          </p>
          <div className="grid gap-5 lg:grid-cols-3">
            <Bloque
              titulo="Relato de la denuncia"
              numero={1}
              accento="slate"
              extra={<span className="rounded-full bg-slate/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate">Según la aseguradora</span>}
            >
              <TextoPanel
                siniestroId={s.id}
                campo="relato_denuncia"
                valorInicial={s.relatoDenuncia}
                placeholder="Qué dice la denuncia que pasó: si no se extrajo solo del PDF, cargalo a mano acá…"
                etiquetaGuardar="Guardar relato"
              />
            </Bloque>
            <Bloque
              titulo={`Descargo de ${nombreOperador}`}
              numero={2}
              colorOperador={colorOperador}
              extra={
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ background: colorOperador }}
                >
                  {nombreOperador}
                </span>
              }
            >
              <TextoPanel
                siniestroId={s.id}
                campo="descargo"
                valorInicial={s.descargo}
                placeholder="Relato de lo sucedido: qué encontraste, qué te dijeron, cómo se compara con la denuncia…"
                etiquetaGuardar="Guardar descargo"
                plantilla={PLANTILLA_DESCARGO}
              />
            </Bloque>
            <Bloque
              titulo="Informe técnico-legal"
              numero={3}
              colorOperador={colorOperador}
              extra={
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ background: colorOperador }}
                >
                  ✨ Borrador de {nombreOperador}
                </span>
              }
            >
              <InformePanel siniestroId={s.id} informeInicial={s.informe} />
            </Bloque>
          </div>
        </div>

        {/* Resolución final: privada, solo para el admin (puedeVerInformeFinal).
            El operador no ve este bloque ni el contenido del campo informe_final. */}
        {verInformeFinal && (
          <div className="md:col-span-2">
            <Bloque
              id="resolucion"
              titulo="Resolución final"
              numero={4}
              accento="ink"
              extra={<span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber to-amber/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">🔒 Solo vos — para el mail</span>}
            >
              <InformeFinalPanel siniestroId={s.id} informeInicial={s.informeFinal} />
            </Bloque>
          </div>
        )}

        {/* Bitácora */}
        <div className="md:col-span-2">
          <Bloque id="bitacora" titulo={`Bitácora de ${nombreOperador} (${notas.length} entradas)`} colorOperador={colorOperador}>
            <BitacoraPanel siniestroId={s.id} entradasIniciales={notas} esAdmin={esAdmin} nombreOperador={nombreOperador} />
          </Bloque>
        </div>
      </div>
      </>
      )}
    </main>
  );
}

const ACENTO_BARRA: Record<string, string> = {
  ink: "bg-azul", slate: "bg-slate", amber: "bg-amber", ok: "bg-ok", fraude: "bg-fraude",
};

// colorOperador (si viene) pisa el accento fijo — así el bloque queda con
// el mismo color determinístico que ese operador tiene en todo el resto del
// CRM (tablero, tarjetas "Por operador", usuarios — todos usan colorPorTexto).
// numero (si viene) dibuja una bandita redonda con el paso del cotejo, en vez
// del caracter unicode "①②③④" suelto que traía el título antes.
function Bloque({ titulo, children, accento = "ink", colorOperador, extra, numero, id }: {
  titulo: string; children: React.ReactNode; accento?: keyof typeof ACENTO_BARRA; colorOperador?: string; extra?: React.ReactNode; numero?: number; id?: string;
}) {
  return (
    // scroll-mt-16: para que el ancla no quede tapada detrás de la
    // mini-navegación pegajosa de arriba al hacer scroll hasta acá.
    <section id={id} className={`relative scroll-mt-16 overflow-hidden p-5 pl-6 ${tarjetaElevada}`}>
      <span
        className={`absolute inset-y-0 left-0 w-1 ${colorOperador ? "" : ACENTO_BARRA[accento]}`}
        style={colorOperador ? { background: colorOperador } : undefined}
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate">
          {numero !== undefined && (
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${colorOperador ? "" : ACENTO_BARRA[accento]}`}
              style={colorOperador ? { background: colorOperador } : undefined}
            >
              {numero}
            </span>
          )}
          {titulo}
        </h2>
        {extra}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
// De un vistazo: qué le falta al admin para poder armar el informe de este
// caso — sin tener que scrollear toda la página larga de abajo para
// averiguarlo. Cada chip es un link directo a la sección que corresponde.
function ChecklistInforme({ datosOk, descargoOk, evidenciaOk, informeOk, resolucionOk }: {
  datosOk: boolean; descargoOk: boolean; evidenciaOk: boolean; informeOk: boolean; resolucionOk?: boolean;
}) {
  const items: { href: string; label: string; ok: boolean }[] = [
    { href: "#datos", label: "Datos", ok: datosOk },
    { href: "#cotejo", label: "Descargo del operador", ok: descargoOk },
    { href: "#evidencia", label: "Evidencia", ok: evidenciaOk },
    { href: "#cotejo", label: "Informe técnico", ok: informeOk },
  ];
  if (resolucionOk !== undefined) items.push({ href: "#resolucion", label: "Resolución final", ok: resolucionOk });
  const faltan = items.filter(i => !i.ok).length;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-3">
      <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate">
        {faltan === 0 ? "✅ Todo listo para el informe" : `Falta para el informe (${faltan})`}
      </span>
      {items.map(i => (
        <a
          key={i.label}
          href={i.href}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            i.ok ? "bg-ok/10 text-ok hover:bg-ok/15" : "bg-fraude/10 text-fraude hover:bg-fraude/15"
          }`}
        >
          {i.ok ? "✓" : "○"} {i.label}
        </a>
      ))}
    </div>
  );
}

function Dato({ k, v }: { k:string; v:string|null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate">{k}</span>
      <span className="text-right text-ink">{v ?? "—"}</span>
    </div>
  );
}
function BtnLink({ href, label }: { href:string; label:string }) {
  return (
    <a href={href} className={`${boton.secundario} w-full`}>
      {label}
    </a>
  );
}
