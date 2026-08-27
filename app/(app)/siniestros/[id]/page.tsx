import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora, evidencia } from "@/lib/db/schema";
import { desgloseFacturacion, formatARS } from "@/lib/facturacion";
import { puedeVerCaso, puedeVerFacturacion } from "@/lib/acceso";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";
import { ResultadoBadge } from "@/components/resultado-badge";
import { EvidenciaPanel } from "@/components/evidencia-panel";
import { TextoPanel } from "@/components/texto-panel";
import { MailPanel } from "@/components/mail-panel";
import { KmPanel } from "@/components/km-panel";
import { InformePanel } from "@/components/informe-panel";
import { EstadoResultadoPanel } from "@/components/estado-resultado-panel";
import { boton, tarjetaElevada, RESULTADO_ACENTO } from "@/lib/ui";

export const dynamic = "force-dynamic";

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
  const verFacturacion = puedeVerFacturacion(session);
  const notas = await db.select().from(bitacora)
    .where(eq(bitacora.siniestroId, params.id))
    .orderBy(desc(bitacora.fecha));
  await asegurarTablaEvidencia();
  const archivos = await db.select().from(evidencia)
    .where(eq(evidencia.siniestroId, params.id))
    .orderBy(desc(evidencia.creadoEn));
  const lugar = (s.lugarSiniestro ?? {}) as Record<string,string>;
  const lugarTxt = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" ");
  const desg = desgloseFacturacion(s.kmTotal);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <a href="/panel" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <span aria-hidden>←</span> Tablero
      </a>

      {/* Cabecera */}
      <div className={`relative mb-6 overflow-hidden ${tarjetaElevada}`}>
        <span className={`absolute inset-x-0 top-0 h-1.5 ${RESULTADO_ACENTO[s.resultado] ?? "bg-slate"}`} />
        <div className="flex items-start justify-between gap-3 p-5 pt-6">
          <div>
            <p className="font-mono text-xs text-slate">Gestión {s.numeroGestion ?? "—"} · Siniestro {s.nroSiniestro ?? "—"}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{s.asegurado ?? "Sin asegurado"}</h1>
            <p className="text-sm text-slate">{s.tipo ?? "—"} · {s.compania ?? "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EstadoBadge estado={s.estado} />
            <ResultadoBadge resultado={s.resultado} />
            {verFacturacion && <CobroBadge estado={s.estadoCobro} />}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Datos del siniestro */}
        <Bloque titulo="Datos del siniestro">
          <Dato k="DNI" v={s.dni} /><Dato k="Póliza" v={s.poliza} />
          <Dato k="Denunciante" v={s.denunciante} /><Dato k="Domicilio" v={s.domicilio} />
          <Dato k="Fecha ocurrencia" v={s.fechaOcurrencia} /><Dato k="Lugar del hecho" v={lugarTxt} />
          <Dato k="Contacto" v={s.telContacto ?? s.celContacto} /><Dato k="Email" v={s.emailContacto} />
          <Dato k="Vencimiento gestión" v={s.fechaLimite} /><Dato k="Operador" v={s.operador} />
        </Bloque>

        {/* Estado, resultado y cobro del caso */}
        <div className="space-y-4">
          <Bloque titulo="Estado del caso" accento="ink">
            <EstadoResultadoPanel
              siniestroId={s.id}
              estado={s.estado}
              resultado={s.resultado}
              estadoCobro={s.estadoCobro}
              verFacturacion={verFacturacion}
            />
          </Bloque>

          {verFacturacion && (
            <Bloque titulo="Facturación" accento="amber">
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
          <Bloque titulo="Acciones" accento="slate">
            <div className="grid grid-cols-2 gap-2">
              {verFacturacion && <BtnLink href={`/api/factura-pdf?id=${s.id}`} label="📄 Factura PDF" />}
              <BtnLink href={`/api/caratula-pdf?id=${s.id}`} label="📋 Carátula PDF" />
              <BtnLink href={`/api/expediente-pdf?id=${s.id}`} label="🗂️ Expediente PDF" />
            </div>
          </Bloque>

          {/* Nuevo mensaje */}
          <Bloque titulo="Enviar mail" accento="slate">
            <MailPanel
              siniestroId={s.id}
              destinatarioSugerido={s.emailContacto}
              archivos={archivos.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }))}
            />
          </Bloque>
        </div>

        {/* Evidencia */}
        <div className="md:col-span-2">
          <Bloque titulo="Evidencia" accento="ok">
            <EvidenciaPanel siniestroId={s.id} archivosIniciales={archivos} />
          </Bloque>
        </div>

        {/* Las 3 ventanas del cierre del caso: lo que dice la denuncia, lo que
            dice el operador, y la resolución armada con IA comparando las
            dos — lista para copiar al mail de cierre a la aseguradora. */}
        <div className="md:col-span-2">
          <p className="mb-3 text-sm text-slate">
            <span className="font-semibold text-ink">Cierre del caso:</span> comparás lo que dice la denuncia contra lo que relevó el operador, y con eso armás la resolución que le mandás a la aseguradora por mail.
          </p>
          <div className="grid gap-5 lg:grid-cols-3">
            <Bloque
              titulo="① Relato de la denuncia"
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
              titulo="② Descargo / Ampliación"
              accento="amber"
              extra={<span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">Según el operador</span>}
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
              titulo="③ Informe técnico-legal"
              accento="ink"
              extra={<span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber to-amber/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">✨ Resolución para el mail</span>}
            >
              <InformePanel siniestroId={s.id} informeInicial={s.informe} />
            </Bloque>
          </div>
        </div>

        {/* Bitácora */}
        <div className="md:col-span-2">
          <Bloque titulo={`Bitácora (${notas.length} entradas)`} accento="slate">
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
          </Bloque>
        </div>
      </div>
    </main>
  );
}

const ACENTO_BARRA: Record<string, string> = {
  ink: "bg-ink", slate: "bg-slate", amber: "bg-amber", ok: "bg-ok", fraude: "bg-fraude",
};

function Bloque({ titulo, children, accento = "ink", extra }: {
  titulo: string; children: React.ReactNode; accento?: keyof typeof ACENTO_BARRA; extra?: React.ReactNode;
}) {
  return (
    <section className={`relative overflow-hidden p-5 pl-6 ${tarjetaElevada}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${ACENTO_BARRA[accento]}`} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate">{titulo}</h2>
        {extra}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
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
